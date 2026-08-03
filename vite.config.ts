import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills"; // 1. Import plugin

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(), // 2. Enable Node.js polyfills
  ],
  define: {
    global: "window",
  },
});
