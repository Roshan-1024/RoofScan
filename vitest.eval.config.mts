import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Evaluations call the real Meta Model API, cost money and need
 * MODEL_API_KEY, so they are kept out of `npm test`. Run with
 * `npm run eval:bills`. Aliases match vitest.config.mts.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.eval.ts"],
    environment: "node",
    testTimeout: 10 * 60 * 1000,
    // Show the results table even when the evaluation passes.
    silent: false,
  },
});
