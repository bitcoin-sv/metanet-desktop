import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;
const linkedPackagePath = path.resolve(__dirname, "../brc100-ui-react-components/src");

export default defineConfig({
  plugins: [
    react({
      include: [
        "**/*.{jsx,tsx,js,ts}",                                // your app
        `${linkedPackagePath}/**/*.{jsx,tsx,js,ts}`            // your linked package
      ],
    }),
  ],

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
      // (optional) if you ever see missed updates on macOS:
      // usePolling: true,
      // interval: 100
    },
    fs: {
      allow: [
        path.resolve(__dirname),
        linkedPackagePath
      ],
    },
  },

  resolve: {
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
    preserveSymlinks: true,
    dedupe: ["react", "react-dom"],
    alias: {
      "@bsv/brc100-ui-react-components": linkedPackagePath
    },
  },

  optimizeDeps: {
    exclude: ["@bsv/brc100-ui-react-components"],
  },
});
