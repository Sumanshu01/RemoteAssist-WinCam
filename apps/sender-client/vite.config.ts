import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true
  },
  resolve: {
    alias: {
      "@remoteassist/shared-types": path.resolve(__dirname, "../../packages/shared-types/src")
    }
  }
});
