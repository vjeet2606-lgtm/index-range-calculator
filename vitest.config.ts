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
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "html"],
      // Scoped deliberately to the logic layers this test suite actually
      // targets — lib/**, store/**, hooks/** — not components/** or app/**.
      // Phase 4/5's "Quantitative Test Infrastructure" is about the
      // mathematical/state layer; React component rendering coverage is a
      // separate concern this suite was never asked to (and doesn't)
      // exercise. Reporting a blended number across both would understate
      // the logic layer's real coverage and overstate the UI layer's.
      include: ["lib/**/*.ts", "store/**/*.ts", "hooks/**/*.ts"],
      exclude: [
        "**/__tests__/**",
        "**/*.test.ts",
        "**/*.bench.ts",
        "lib/quant/core/__tests__/referenceMath.ts",
      ],
    },
  },
});
