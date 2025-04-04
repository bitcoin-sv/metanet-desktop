#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

// Standard library imports.
use std::{
    convert::Infallible,
    net::SocketAddr,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};

// Third-party imports.
use dashmap::DashMap;
use hyper::{
    service::{make_service_fn, service_fn},
    Body, Request, Response, Server, StatusCode,
};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Listener, Manager, Window};
use tokio::sync::oneshot;

static MAIN_WINDOW_NAME: &str = "main";

/// Payload sent from Rust to the frontend for each HTTP request.
#[derive(Serialize)]
struct HttpRequestEvent {
    method: String,
    path: String,
    headers: Vec<(String, String)>,
    body: String,
    request_id: u64,
}

/// Expected payload sent back from the frontend.
#[derive(Deserialize, Debug)]
struct TsResponse {
    request_id: u64,
    status: u16,
    body: String,
}

/// A type alias for our concurrent map of pending responses.
type PendingMap = DashMap<u64, oneshot::Sender<TsResponse>>;

/// -----
/// Tauri COMMANDS for focus management
/// -----

#[tauri::command]
fn is_focused(window: Window) -> bool {
    match window.is_focused() {
        Ok(focused) => focused,
        Err(_) => false,
    }
}

#[tauri::command]
fn request_focus(window: Window) {
    #[cfg(target_os = "macos")]
    {
        // 1. "Unminimize" if necessary.
        if let Err(e) = window.unminimize() {
            eprintln!("(macOS) unminimize error: {}", e);
        }
        // 2. Request user attention (bounces Dock icon).
        if let Err(e) = window.request_user_attention(Some(tauri::UserAttentionType::Critical)) {
            eprintln!("(macOS) request_user_attention error: {}", e);
        }
        // 3. Attempt to focus the window.
        if let Err(e) = window.set_focus() {
            eprintln!("(macOS) set_focus error: {}", e);
        }
    }

    #[cfg(target_os = "windows")]
    {
        // 1. Attempt to focus the window directly.
        if let Err(e) = window.set_focus() {
            eprintln!("(Windows) set_focus error: {}", e);
        }
    }

    #[cfg(target_os = "linux")]
    {
        // 1. Attempt to focus.
        if let Err(e) = window.set_focus() {
            eprintln!("(Linux) set_focus error: {}", e);
        }
        // 2. Possibly unminimize as fallback.
        if let Err(e) = window.unminimize() {
            eprintln!("(Linux) unminimize error: {}", e);
        }
    }
}

/// Attempt to move the window out of the user's way so they can resume
/// other tasks. The exact behavior (minimize/hide) differs per platform.
#[tauri::command]
fn relinquish_focus(window: Window) {
    #[cfg(target_os = "macos")]
    {
        // Hide (removes from screen, user’s focus returns to previous app).
        if let Err(e) = window.minimize() {
            eprintln!("(macOS) hide error: {}", e);
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Minimizing is the typical approach on Windows.
        if let Err(e) = window.minimize() {
            eprintln!("(Windows) minimize error: {}", e);
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Minimizing is also typical on Linux WMs.
        if let Err(e) = window.minimize() {
            eprintln!("(Linux) minimize error: {}", e);
        }
    }
}

fn main() {
    tauri::Builder::default()
        .setup(move |app| {
            // Retrieve the main window (we only want to communicate with this window).
            let main_window = app.get_webview_window(MAIN_WINDOW_NAME)
                .expect("Main window not found");

            // Shared, concurrent map to store pending responses.
            let pending_requests: Arc<PendingMap> = Arc::new(DashMap::new());
            // Atomic counter to generate unique request IDs.
            let request_counter = Arc::new(AtomicU64::new(1));

            {
                // Set up a listener for "ts-response" events coming from the frontend.
                // We attach the listener to the main window (not globally) for security.
                let pending_requests = pending_requests.clone();
                main_window.listen("ts-response", move |event| {
                    let payload = event.payload();
                    if payload.len() > 0 {
                        match serde_json::from_str::<TsResponse>(payload) {
                            Ok(ts_response) => {
                                if let Some((req_id, tx)) = pending_requests.remove(&ts_response.request_id) {
                                    if let Err(err) = tx.send(ts_response) {
                                        eprintln!(
                                            "Failed to send response via oneshot channel for request {}: {:?}",
                                            req_id, err
                                        );
                                    }
                                } else {
                                    eprintln!("Received ts-response for unknown request_id: {}", ts_response.request_id);
                                }
                            }
                            Err(err) => {
                                eprintln!("Failed to parse ts-response payload: {:?}", err);
                            }
                        }
                    } else {
                        eprintln!("ts-response event did not include a payload");
                    }
                });
            }

            // Spawn a separate thread to run our asynchronous HTTP server.
            let main_window_clone = main_window.clone();
            let pending_requests_clone = pending_requests.clone();
            let request_counter_clone = request_counter.clone();
            std::thread::spawn(move || {
                // Build a multi-threaded Tokio runtime.
                let rt = tokio::runtime::Builder::new_multi_thread()
                    .enable_all()
                    .build()
                    .expect("Failed to create Tokio runtime");

                rt.block_on(async move {
                    // Bind the Hyper server to 127.0.0.1:3321.
                    let addr: SocketAddr = "127.0.0.1:3321".parse().expect("Invalid socket address");
                    println!("HTTP server listening on http://{}", addr);

                    // Create our Hyper service.
                    let make_svc = make_service_fn(move |_conn| {
                        // Clone handles for each connection.
                        let pending_requests = pending_requests_clone.clone();
                        let main_window = main_window_clone.clone();
                        let request_counter = request_counter_clone.clone();

                        async move {
                            Ok::<_, Infallible>(service_fn(move |req: Request<Body>| {
                                // Clone per-request handles.
                                let pending_requests = pending_requests.clone();
                                let main_window = main_window.clone();
                                let request_counter = request_counter.clone();

                                async move {

                                    // Intercept any OPTIONS requests
                                    if req.method() == hyper::Method::OPTIONS {
                                        let mut res = Response::new(Body::empty());
                                        res.headers_mut().insert("Access-Control-Allow-Origin", "*".parse().unwrap());
                                        res.headers_mut().insert("Access-Control-Allow-Headers", "*".parse().unwrap());
                                        res.headers_mut().insert("Access-Control-Allow-Methods", "*".parse().unwrap());
                                        res.headers_mut().insert("Access-Control-Expose-Headers", "*".parse().unwrap());
                                        res.headers_mut().insert("Access-Control-Allow-Private-Network", "true".parse().unwrap());
                                        return Ok::<_, Infallible>(res);
                                    }

                                    // Generate a unique request ID.
                                    let request_id = request_counter.fetch_add(1, Ordering::Relaxed);

                                    // Extract the HTTP method, URI, and headers.
                                    let method = req.method().clone();
                                    let uri = req.uri().clone();
                                    let headers = req.headers().iter()
                                        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                                        .collect::<Vec<(String, String)>>();

                                    // Read the full request body.
                                    let whole_body = hyper::body::to_bytes(req.into_body()).await.unwrap_or_default();
                                    let body_str = String::from_utf8_lossy(&whole_body).to_string();

                                    // Create a oneshot channel for awaiting the frontend response.
                                    let (tx, rx) = oneshot::channel::<TsResponse>();
                                    pending_requests.insert(request_id, tx);

                                    // Prepare the event payload.
                                    let event_payload = HttpRequestEvent {
                                        method: method.to_string(),
                                        path: uri.to_string(),
                                        headers,
                                        body: body_str,
                                        request_id,
                                    };

                                    // Serialize the payload to JSON.
                                    let event_json = match serde_json::to_string(&event_payload) {
                                        Ok(json) => json,
                                        Err(e) => {
                                            eprintln!("Failed to serialize HTTP event: {:?}", e);
                                            let mut res = Response::new(Body::from("Internal Server Error"));
                                            *res.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
                                            // Append CORS headers
                                            res.headers_mut().insert("Access-Control-Allow-Origin", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Allow-Headers", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Allow-Methods", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Expose-Headers", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Allow-Private-Network", "true".parse().unwrap());
                                            // Remove pending request since we cannot proceed.
                                            pending_requests.remove(&request_id);
                                            return Ok::<_, Infallible>(res);
                                        }
                                    };

                                    // Emit the "http-request" event to the main window.
                                    if let Err(err) = main_window.emit("http-request", event_json) {
                                        eprintln!("Failed to emit http-request event: {:?}", err);
                                        pending_requests.remove(&request_id);
                                        let mut res = Response::new(Body::from("Internal Server Error"));
                                        *res.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
                                        // Append CORS headers
                                        res.headers_mut().insert("Access-Control-Allow-Origin", "*".parse().unwrap());
                                        res.headers_mut().insert("Access-Control-Allow-Headers", "*".parse().unwrap());
                                        res.headers_mut().insert("Access-Control-Allow-Methods", "*".parse().unwrap());
                                        res.headers_mut().insert("Access-Control-Expose-Headers", "*".parse().unwrap());
                                        res.headers_mut().insert("Access-Control-Allow-Private-Network", "true".parse().unwrap());
                                        return Ok::<_, Infallible>(res);
                                    }

                                    // Wait asynchronously for the frontend's response.
                                    match rx.await {
                                        Ok(ts_response) => {
                                            let mut res = Response::new(Body::from(ts_response.body));
                                            *res.status_mut() = StatusCode::from_u16(ts_response.status)
                                                .unwrap_or(StatusCode::OK);
                                            // Append CORS headers
                                            res.headers_mut().insert("Access-Control-Allow-Origin", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Allow-Headers", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Allow-Methods", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Expose-Headers", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Allow-Private-Network", "true".parse().unwrap());
                                            Ok::<_, Infallible>(res)
                                        }
                                        Err(err) => {
                                            eprintln!("Error awaiting frontend response for request {}: {:?}", request_id, err);
                                            let mut res = Response::new(Body::from("Gateway Timeout"));
                                            *res.status_mut() = StatusCode::GATEWAY_TIMEOUT;
                                            // Append CORS headers
                                            res.headers_mut().insert("Access-Control-Allow-Origin", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Allow-Headers", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Allow-Methods", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Expose-Headers", "*".parse().unwrap());
                                            res.headers_mut().insert("Access-Control-Allow-Private-Network", "true".parse().unwrap());
                                            Ok::<_, Infallible>(res)
                                        }
                                    }
                                }
                            }))
                        }
                    });

                    // Build and run the Hyper server.
                    let server = Server::bind(&addr).serve(make_svc);

                    if let Err(e) = server.await {
                        eprintln!("Server error: {}", e);
                    }
                });
            });

            #[cfg(target_os = "macos")]
                       {
                           let app_handle = app.handle().clone();
                           app.listen_any("tauri://reopen", move |_event| {
                               if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_NAME) {
                                   // Show the hidden window again
                                   if let Err(e) = window.show() {
                                       eprintln!("(macOS) show error: {}", e);
                                   }
                                   // Optionally, also focus it:
                                   if let Err(e) = window.set_focus() {
                                       eprintln!("(macOS) set_focus error: {}", e);
                                   }
                               }
                           });
                       }

            Ok(())
        })
        // IMPORTANT: Register our Tauri commands here
        .invoke_handler(tauri::generate_handler![
            is_focused,
            request_focus,
            relinquish_focus
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
