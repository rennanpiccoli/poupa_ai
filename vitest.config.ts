import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    globalSetup: ["tests/setup/global-db.ts"],
    // Integration tests share one test DB → run files one at a time.
    fileParallelism: false,
  },
});
