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
use tauri::{Emitter, Listener, Window};
use tokio::sync::oneshot;

use std::path::{Path, PathBuf};
use tauri::{command, AppHandle, Manager};

use std::fs;

// Import the Tauri plugins
use tauri_plugin_dialog;

// Add a command to save files using the standard Rust fs module
#[tauri::command]
async fn save_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    use std::fs::File;
    use std::io::Write;

    println!("Saving file to: {}", path);

    // Create the file
    let mut file = File::create(&path).map_err(|e| e.to_string())?;

    // Write the contents
    file.write_all(&contents).map_err(|e| e.to_string())?;

    println!("File saved successfully");
    Ok(())
}

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

#[cfg(target_os = "macos")]
use once_cell::sync::Lazy;
/// -----
/// Tauri COMMANDS for focus management
/// -----

#[cfg(target_os = "macos")]
use std::sync::Mutex;

#[cfg(target_os = "macos")]
static PREV_BUNDLE_ID: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

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
        // Make window visible first - critical for macOS
        use std::process::Command;
        // 0. Capture the bundle id of the currently focused app
        if let Ok(output) = Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to get the bundle identifier of the first process whose frontmost is true")
            .output()
        {
            if output.status.success() {
                if let Ok(bundle_id) = String::from_utf8(output.stdout) {
                    let bundle_id = bundle_id.trim().to_string();
                    let mut prev = PREV_BUNDLE_ID.lock().unwrap();
                    *prev = Some(bundle_id);
                }
            }
        }
        // 1. "Unminimize" if necessary.
        if let Err(e) = window.unminimize() {
            eprintln!("(macOS) unminimize error: {}", e);
        }

        // Ensure the window is shown
        if let Err(e) = window.show() {
            eprintln!("(macOS) show error: {}", e);
        }

        // Request user attention (bounces Dock icon)
        if let Err(e) = window.request_user_attention(Some(tauri::UserAttentionType::Informational))
        {
            eprintln!("(macOS) request_user_attention error: {}", e);
        }

        // Focus the window - try multiple times with delays if needed
        for i in 0..3 {
            if let Ok(focused) = window.is_focused() {
                if focused {
                    break;
                }
            }

            if let Err(e) = window.set_focus() {
                eprintln!("(macOS) set_focus attempt {} error: {}", i, e);
            }

            // Small delay to allow macOS to process the focus request
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Show the window if it's hidden
        if let Err(e) = window.show() {
            eprintln!("(Windows) show error: {}", e);
        }
        // Unminimize the window (important!)
        if let Err(e) = window.unminimize() {
            eprintln!("(Windows) unminimize error: {}", e);
        }
        // Attempt to focus the window directly
        if let Err(e) = window.set_focus() {
            eprintln!("(Windows) set_focus error: {}", e);
        }
        // Temporarily set always-on-top to force focus
        if let Err(e) = window.set_always_on_top(true) {
            eprintln!("(Windows) set_always_on_top(true) error: {}", e);
        }
        // Remove always-on-top after focusing
        if let Err(e) = window.set_always_on_top(false) {
            eprintln!("(Windows) set_always_on_top(false) error: {}", e);
        }
    }

    #[cfg(target_os = "linux")]
    {
        // First, unminimize the window if it's minimized
        if let Err(e) = window.unminimize() {
            eprintln!("(Linux) unminimize error: {}", e);
        }

        // Show the window if it's hidden
        if let Err(e) = window.show() {
            eprintln!("(Linux) show error: {}", e);
        }

        // Attempt to focus the window
        if let Err(e) = window.set_focus() {
            eprintln!("(Linux) set_focus error: {}", e);
        }

        // On Linux, sometimes we need multiple focus attempts
        std::thread::sleep(std::time::Duration::from_millis(30));
        if let Ok(focused) = window.is_focused() {
            if !focused {
                if let Err(e) = window.set_focus() {
                    eprintln!("(Linux) set_focus retry error: {}", e);
                }
            }
        }
    }
}

/// Attempt to move the window out of the user's way so they can resume
/// other tasks. The exact behavior (switch/minimize) differs per platform.
#[tauri::command]
fn relinquish_focus(window: Window) {
    #[cfg(target_os = "linux")]
    {
        // Minimize the window instead of hiding
        if let Err(e) = window.minimize() {
            eprintln!("Linux minimize error: {}", e);
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Minimize the window instead of hiding
        if let Err(e) = window.minimize() {
            eprintln!("Windows minimize error: {}", e);
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        // Try to restore focus to previous app
        let prev_bundle_id = {
            let prev = PREV_BUNDLE_ID.lock().unwrap();
            prev.clone()
        };
        if let Some(bundle_id) = prev_bundle_id {
            if !bundle_id.is_empty() && bundle_id != "com.apple.finder" {
                let script = format!("tell application id \"{}\" to activate", bundle_id);
                if let Err(e) = Command::new("osascript").arg("-e").arg(&script).output() {
                    eprintln!("MacOS failed to re-activate previous app: {}", e);
                }
            }
        }
        _ = window.is_focused();
    }
}

#[command]
async fn download(app_handle: AppHandle, filename: String, content: Vec<u8>) -> Result<(), String> {
    let downloads_dir = app_handle
        .path()
        .download_dir()
        .map_err(|e| e.to_string())?;
    let path = PathBuf::from(downloads_dir);

    // Split the filename into stem and extension (if any)
    let path_obj = Path::new(&filename);
    let stem = path_obj
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let ext = path_obj.extension().and_then(|e| e.to_str()).unwrap_or("");

    // Initial path attempt
    let mut final_path = path.clone();
    final_path.push(&filename);

    // Check if file exists and increment if necessary
    let mut counter = 1;
    while final_path.exists() {
        let new_filename = if ext.is_empty() {
            format!("{} ({}).{}", stem, counter, ext)
        } else {
            format!("{} ({}).{}", stem, counter, ext)
        };
        final_path = path.clone();
        final_path.push(new_filename);
        counter += 1;
    }

    fs::write(&final_path, content).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Extract the main window.
            let main_window = app.get_webview_window(MAIN_WINDOW_NAME).unwrap();

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

                    // Attempt to bind the server and check for address in use error
                    match Server::try_bind(&addr) {
                        Ok(builder) => {
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
                            let server = builder.serve(make_svc);

                            if let Err(e) = server.await {
                                eprintln!("Server error: {}", e);
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to bind server: {}", e);
                            std::process::exit(1);
                        }
                    }
                });
            });

            // The macOS dock click handling is now done directly in the RunEvent::Reopen handler below
            // No additional event listeners are needed here

            Ok(())
        })
        // IMPORTANT: Register our Tauri commands here
        .invoke_handler(tauri::generate_handler![
            is_focused,
            request_focus,
            relinquish_focus,
            download,
            save_file
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
