/**
 * Phase 5 — static analysis results, captured from real tool runs at commit
 * time (not live-computed by the running app: coverage/bundle-size/madge
 * all require running the test suite or build offline, not something a
 * deployed page can compute about itself). Every number here is real
 * output from an actual command run during this phase, not invented — see
 * docs/CODE_HEALTH_REPORT.md for the full report these summarize.
 */

export const CAPTURED_AT = "2026-07-23 (Final Phase — Version 1.0.0 commit)";

export const CODE_HEALTH_SUMMARY = {
  circularDependencies: 0,
  filesScanned: 233,
  deadCodeCandidates: ["components/ui/Skeleton.tsx", "hooks/useDelayedLoading.ts", "lib/ai/types.ts", "types/market.ts"],
  clientBundleTotalKB: 1118,
  largestChunkKB: 224,
};

export const COVERAGE_SUMMARY = {
  quantitativeCore: {
    label:
      "Quantitative core (lib/quant, lib/calculators, lib/analytics, lib/validation, lib/snapshot, lib/marketSession, lib/timeHorizon, lib/marketData, lib/context, lib/explanation, lib/history, lib/markets)",
    statementsPercent: 95.76,
    branchesPercent: 93.32,
    functionsPercent: 98.98,
    linesPercent: 96.65,
  },
  fullScope: {
    label: "Full scope (all of lib/, store/, hooks/ — including untested broker/search/security modules outside quant scope)",
    statementsPercent: 49.1,
    branchesPercent: 56.5,
    functionsPercent: 57.69,
    linesPercent: 49.54,
  },
  totalTests: 480,
  totalTestFiles: 50,
};

export const BENCHMARK_SUMMARY = {
  note: "Single-machine timings, dev-container hardware — relative comparisons are more meaningful than absolute numbers, which will vary by machine.",
  results: [
    { name: "Black-Scholes-Merton: price() only", opsPerSecond: 8_146_502, meanMicroseconds: 0.1 },
    { name: "Black-Scholes-Merton: full evaluate() (fair value + all Greeks)", opsPerSecond: 1_506_959, meanMicroseconds: 0.7 },
    { name: "Black-76: full evaluate() (fair value + all Greeks)", opsPerSecond: 1_310_601, meanMicroseconds: 0.8 },
    { name: "IV Solver (Newton-Raphson, ATM convergent case)", opsPerSecond: 36_815, meanMicroseconds: 27.2 },
    { name: "calculateIvExpectedMove()", opsPerSecond: 2_908_322, meanMicroseconds: 0.3 },
    { name: "Realistic per-refresh workload: 10 legs, evaluate() only", opsPerSecond: 113_079, meanMicroseconds: 8.8 },
    {
      name: "Realistic per-refresh workload: 10 legs, IV-solve + evaluate() (the actual production workload)",
      opsPerSecond: 3_530,
      meanMicroseconds: 283.3,
    },
  ],
};
