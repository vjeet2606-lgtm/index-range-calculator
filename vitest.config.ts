import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    // jsdom (not "node") — required for store tests that exercise Zustand's
    // persist middleware against real localStorage, and for hook tests that
    // use @testing-library/react's renderHook. Pure-function tests (the
    // large majority of this suite) are unaffected either way.
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
