import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@remoteassist/shared-types": path.resolve(__dirname, "../packages/shared-types/src"),
      "@remoteassist/signaling-server": path.resolve(__dirname, "../services/signaling-server/src")
    }
  }
});
