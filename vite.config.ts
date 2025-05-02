import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;
const projectRoot = __dirname; // e.g. "/Users/braydenlangley/Projects/Babbage/metanet-desktop"
const brc100Path = path.resolve(projectRoot, "../brc100-ui-react-components");

export default defineConfig({
  // … your other config …

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,

    watch: {
      ignored: [
        "**/node_modules/**",
        `!${brc100Path}/**`,
      ],
    },

    fs: {
      // ← allow both the app root and the linked component folder
      allow: [
        projectRoot,
        brc100Path,
      ],
    },
  },

  resolve: {
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
    // 4. ensure we keep the symlink and don't dedupe it away
    preserveSymlinks: true,
    dedupe: ["react", "react-dom"],

    // 5. optional alias so you can import directly from source,
    //    e.g. import { Button } from "@brc100/Button"
    alias: {
      "@bsv/brc100-ui-react-components": path.join(brc100Path, "src"),
    },
  },

  optimizeDeps: {
    // 1. do NOT prebundle this — serve it as raw ESM so HMR sees your edits
    exclude: ["@bsv/brc100-ui-react-components"],

    // optional: always bypass any stale cache when Vite starts
    force: true,
  },

  build: {
    sourcemap: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },

  // if you really want to turn off Vite’s own cache dir – 
  // you can override cacheDir (though it’ll still store things somewhere):
  cacheDir: ".vite-cache",
});
