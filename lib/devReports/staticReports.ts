/**
 * Phase 5 — static analysis results, captured from real tool runs at commit
 * time (not live-computed by the running app: coverage/bundle-size/madge
 * all require running the test suite or build offline, not something a
 * deployed page can compute about itself). Every number here is real
 * output from an actual command run during this phase, not invented — see
 * docs/CODE_HEALTH_REPORT.md for the full report these summarize.
 */

export const CAPTURED_AT = "2026-07-23 (Phase 5 commit)";

export const CODE_HEALTH_SUMMARY = {
  circularDependencies: 0,
  filesScanned: 190,
  deadCodeCandidates: ["components/ui/Skeleton.tsx", "hooks/useDelayedLoading.ts", "lib/ai/types.ts"],
  clientBundleTotalKB: 1010,
  largestChunkKB: 276,
};

export const COVERAGE_SUMMARY = {
  quantitativeCore: {
    label: "Quantitative core (lib/quant, lib/calculators, lib/analytics, lib/validation, lib/snapshot, lib/marketSession, lib/timeHorizon)",
    statementsPercent: 96.86,
    branchesPercent: 93.05,
    functionsPercent: 99,
    linesPercent: 98,
  },
  fullScope: {
    label: "Full scope (all of lib/, store/, hooks/ — including untested broker/search/security modules outside quant scope)",
    statementsPercent: 36.14,
    branchesPercent: 41.33,
    functionsPercent: 43.29,
    linesPercent: 36.69,
  },
  totalTests: 327,
  totalTestFiles: 30,
};

export const BENCHMARK_SUMMARY = {
  note: "Single-machine timings, dev-container hardware — relative comparisons are more meaningful than absolute numbers, which will vary by machine.",
  results: [
    { name: "Black-Scholes-Merton: price() only", opsPerSecond: 11_441_372, meanMicroseconds: 0.1 },
    { name: "Black-Scholes-Merton: full evaluate() (fair value + all Greeks)", opsPerSecond: 5_621_257, meanMicroseconds: 0.2 },
    { name: "Black-76: full evaluate() (fair value + all Greeks)", opsPerSecond: 5_598_217, meanMicroseconds: 0.2 },
    { name: "IV Solver (Newton-Raphson, ATM convergent case)", opsPerSecond: 135_831, meanMicroseconds: 7.4 },
    { name: "calculateIvExpectedMove()", opsPerSecond: 22_670_717, meanMicroseconds: 0.04 },
    { name: "Realistic per-refresh workload: 10 legs, evaluate() only", opsPerSecond: 478_038, meanMicroseconds: 2.1 },
    {
      name: "Realistic per-refresh workload: 10 legs, IV-solve + evaluate() (the actual production workload)",
      opsPerSecond: 11_651,
      meanMicroseconds: 85.8,
    },
  ],
};
