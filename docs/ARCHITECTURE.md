# LYNX ONE — Architecture & Developer Documentation

**Version 1.0.0 — Feature Complete**

LYNX ONE is a quantitative analytics platform for options traders: an Expected Range Calculator covering NSE and MCX, backed by Black-Scholes-Merton / Black-76 pricing, an IV solver, Greeks, live market data intelligence, a deterministic explainability layer, and local historical persistence. It produces **descriptive, mathematical output only** — no Buy/Sell signals, no recommendations, no trade advice, no AI, no portfolio, no order placement.

---

## 1. Architecture Overview

LYNX ONE is a single Next.js 16 (App Router) application — a client-heavy SPA-like experience with a thin server layer (API routes that proxy the Dhan broker API, never touching the browser directly with credentials). There is no application database; all state is either ephemeral (React/Zustand, in-memory) or persisted client-side (`localStorage`, for user preferences and historical snapshots).

The system is built in strict, layered phases, each one **frozen** once complete — later phases only ever consume earlier layers' output, never modify their internals:

```
Broker / Exchange Data (Dhan v2 API)
        │
        ▼
Market Data Adapter          (lib/dhan/**)
        │
        ▼
Normalization Layer          (lib/marketData/normalize.ts)
        │
        ▼
Market Data Intelligence     (lib/marketData/**)   OHLC · Volume · OI · OI Change · Option Chain · Max Pain · IV · Session Stats
        │
        ▼
Universal Market Engine      (lib/markets/** · lib/marketSession/** · lib/timeHorizon/**)
        │
        ▼
Quantitative Engine          (lib/quant/core/** · lib/calculators/**)   — FROZEN, never modified since Phase 1
        │
        ▼
Market Intelligence          (lib/analytics/**)   Volatility · Greeks · Premium · Time · Structure · Liquidity · Risk · Confidence
        │
        ▼
Snapshot Engine              (lib/snapshot/**)     immutable, deep-frozen, per-calculation record
        │
        ├──▶ Validation Engine       (lib/validation/**)        realized-vs-implied error, drift, contraction
        ├──▶ Context Engine          (lib/context/**)            per-metric current/previous/change/trend/confidence
        ├──▶ Explanation Engine      (lib/explanation/**)        deterministic, template-based "what does this mean"
        └──▶ Historical Storage      (lib/history/**)            multi-day localStorage archive, retention-managed
        │
        ▼
UI (components/**, app/**)   Dashboard · Developer Panel · Market Context Panel · Application Health page
```

Every arrow is one-directional. Nothing downstream ever writes back upstream; nothing recomputes a number an earlier layer already produced.

---

## 2. Module Diagram

```
lib/
├── quant/core/          Black-Scholes-Merton, Black-76, IV Solver, Greeks — FROZEN
├── quant/scenarios/      Grid evaluator for the two calculation scenarios
├── calculators/          calculationEngine, expectedLevels, premiumBreakdown, ivEngine — FROZEN
├── markets/              MarketProfile registry (NSE/MCX/CURRENCY/GLOBAL/CRYPTO) + ContractProfile
├── marketSession/        Market Session Service — open/close/status/progress from a MarketProfile
├── timeHorizon/          Intraday vs Expiry Horizon Provider
├── dhan/                 Broker adapter — client, scripMaster, rangeService (Market Data Adapter)
├── marketData/           Normalization Layer + OHLC/Volume/OI/OIChange/MaxPain/IV/SessionStats Intelligence
├── analytics/            Market Intelligence Engine (7 modules) + Live Explanation narrator
├── snapshot/             Snapshot Engine — createSnapshot(), compareSnapshots()
├── validation/           Validation Engine — summarizeValidation() + explanationValidation checks
├── context/              Context Intelligence Engine — buildMetricContext(), observations, data quality
├── explanation/          Explanation Engine — one deterministic explain* function per metric
├── history/              Historical Snapshot Storage, comparison, export, retention
├── devReports/           Static, offline-captured coverage/benchmark/code-health figures
└── version.ts            App version / build metadata

store/marketStore.ts       The one Zustand store — selection, manual inputs, live extras, session lock,
                            snapshots (in-session ring buffer), toasts, wizard step
hooks/                     useCalculationEngine, useLiveRange, useSessionLock, useMarketIntelligence
                            (the single place every analytics/marketData/snapshot/history call happens)
components/                ui/ (design-system primitives), forms/, cards/, layout/, dev/, context/
app/                       page.tsx (calculator), health/page.tsx (diagnostics), api/** (Dhan proxy routes)
```

---

## 3. Data Flow Diagram

```
User selects Market + Instrument
        │
        ▼
useLiveRange (or manual entry)  ──▶  /api/dhan/range  ──▶  rangeService.getLiveRange()
        │                                                        │
        │  spot, CE/PE premium, ATM strike, expiry, IV, OI,      │
        │  strikeWindow, fullChain                               ▼
        │◀───────────────────────────────────────────  Dhan v2 Option Chain API
        ▼
store.manualInputs / store.liveExtras
        │
        ▼
useCalculationEngine  ──▶  runCalculationEngine()  ──▶  store.result
        │  (Black-Scholes-Merton / Black-76, IV Solver, Greeks — frozen math)
        ▼
useSessionLock  ──▶  store.lockedSession (Daily Mathematical Expected Range, locked once per day/instrument)
        │
        ▼
useMarketIntelligence (the single orchestration hook)
        │
        ├─▶ lib/analytics/**        → MarketDNA
        ├─▶ lib/marketData/**       → MarketDataIntelligence (normalizes liveExtras.fullChain)
        ├─▶ lib/snapshot/**         → SessionSnapshot (frozen, timestamped)
        │        ├─▶ lib/context/**       → per-metric context (attached to the snapshot)
        │        └─▶ lib/explanation/**   → per-metric explanation (attached to the snapshot)
        ├─▶ store.snapshots.push()  (in-session ring buffer, capped at 200)
        └─▶ lib/history/registry.ts → historyStore.save() (multi-day localStorage archive)
        │
        ▼
UI renders: UnderlyingCalculation, LiveMarketStatus, MarketIntelligence, OptionPremiumCalculation,
            MarketContextPanel (Phase 8 cards), DeveloperPanel (dev-only), /health (public diagnostics)
```

---

## 4. Project Structure

```
frontend/
  app/                    Next.js App Router pages + API routes
  components/             React components (ui/, forms/, cards/, layout/, dev/, context/, ...)
  hooks/                  Orchestration hooks — the seam between store state and lib/** engines
  lib/                    All business logic — see Module Diagram above
  store/                  The single Zustand store
  types/                  Shared TypeScript types not owned by a specific lib/** module
  docs/                   This file + CODE_HEALTH_REPORT.md
  .github/workflows/      CI (typecheck, lint, coverage, build)
  next.config.ts          Next.js config (exposes commit SHA/build time to the client bundle)
  vitest.config.ts        Test runner config (coverage scoped to lib/store/hooks)
```

---

## 5. Calculation Pipeline

```
Inputs: spot, ATM CE/PE premium, implied volatility, time-to-expiry (days)
   │
   ▼
IV Solver (Newton-Raphson) ── only when live IV isn't directly available
   │
   ▼
Pricing Model selection: Black-Scholes-Merton (NSE) or Black-76 (MCX) — lib/quant/core/modelSelector.ts
   │
   ▼
Fair Value + Greeks (Delta, Gamma, Theta, Vega) evaluated at current spot/IV/time
   │
   ▼
Expected Range = Spot ± (ATM Call Premium + ATM Put Premium)   [lib/calculators/expectedLevels.ts]
   │
   ▼
Two scenarios (Upper/Lower boundary) re-evaluate the SAME frozen pricing functions at the
projected spot, producing the Option Premium Calculation table's per-leg breakdown
```

This pipeline (`lib/quant/core/**`, `lib/calculators/**`) has been **frozen since Phase 1** — every later phase (Market Intelligence, Snapshot/Validation/Context/Explanation Engines, Historical Storage) is a read-only consumer of its output, never a modifier.

---

## 6. Market Flow

```
MarketId (NSE | MCX | CURRENCY | GLOBAL | CRYPTO)
   │
   ▼
MarketProfile (lib/markets/registry.ts)  — tradingHours, tradingDays, supportedHorizons,
                                            calendarOverrides, supportedInstruments
   │
   ▼
Market Session Service (resolveSessionProfile) — open/close/status/progress, IST-anchored
   │
   ▼
Time Horizon Provider — Intraday (now → session close) or Expiry (now → contract expiry),
                         gated by MarketProfile.supportedHorizons, never a hardcoded market check
   │
   ▼
ContractProfile (lib/markets/contracts.ts) — tick size, price precision, contract size,
                                              expiry convention (display-only, never an engine input)
```

Adding a new market (BSE/COMEX/CME/FOREX/CRYPTO) means adding one `MarketConfig` entry + `ContractProfile` rows — no session/horizon/UI code branches on a market id string anywhere in the codebase.

---

## 7. Snapshot Flow

```
useMarketIntelligence, once per fresh calculation:
   │
   ▼
createSnapshot({ ...already-computed MarketDNA, MarketDataIntelligence, locked boundaries... })
   │
   ├─ deep-freezes the result (Object.freeze, recursively) — read-only at runtime, not just by convention
   ├─ optionally computes `explainability` (context + observations + explanations), gated by
   │  `computeExplainability: true` — opt-in, so every earlier-phase call site is unaffected
   │
   ▼
store.snapshots.push()          (in-session, capped at 200, reset on market/symbol/horizon change)
   │
   ▼
historyStore.save()             (multi-day, localStorage, retention-pruned, optionChain stripped)
```

A `SessionSnapshot` is the single canonical "what did the app know at this instant" record — every later system (Validation, Context, Explanation, Historical Comparison, Export) reads from it; none of them recompute a price, Greek, IV, OI, or Max Pain value it didn't already carry.

---

## 8. Validation Flow

```
summarizeValidation(snapshots[])          Mean/Median realized-vs-implied error, max drift,
                                           expected-move contraction, IV drift, theta decay,
                                           OI change, range expansion, session volatility
        │
        ▼
partitionSnapshotsByMarket() / summarizeValidationByMarket()   never mixes NSE and MCX statistics
        │
        ▼
checkExplanationCompleteness() / checkExplanationDeterminism() / checkNoContradictions()
   (lib/validation/explanationValidation.ts — Phase 8's own consistency guards, kept in a
    separate file so validationEngine.ts's existing, tested statistics are never touched)
```

---

## 9. Developer Guide

**Setup**: `npm install`, `npm run dev` (Turbopack dev server), visit `http://localhost:3000`.

**Testing**: `npm test` (vitest, 480+ tests), `npm run test:coverage` (v8 coverage, scoped to `lib/store/hooks`), `npm run test:bench` (vitest bench, pricing engine throughput).

**Adding a new quantitative metric to the Context/Explanation Engines**: add a `MetricId`, wire a `buildMetricContext()` call in `contextEngine.ts`'s `buildAllMetricContexts()`, write one `explain*` function in `explanationEngine.ts` following the existing pattern (check `currentValue === undefined` first, return `unavailableExplanation()`), add it to both `AllMetricContexts`/`AllMetricExplanations`.

**Adding a new market**: add a `MarketConfig` to `lib/markets/*.ts` + register it in `lib/markets/registry.ts`; add `ContractProfile` rows in `lib/markets/contracts.ts` if instrument metadata is needed. No other file needs a market-id branch.

**Never touch** (frozen, additive-only from here): `lib/quant/core/**`, `lib/calculators/{calculationEngine,expectedLevels,premiumBreakdown,ivEngine}.ts`, `types/calculationEngine.ts`, `lib/snapshot/snapshotEngine.ts`'s existing field computations, `lib/validation/validationEngine.ts`'s existing statistics, `lib/context/**`'s core arithmetic, `lib/explanation/**`'s core template logic.

**Regulatory discipline**: no Buy/Sell/Entry/Exit/Target/Stop-Loss/Signal/Recommendation/Prediction/Probability-of-success language anywhere in generated text, except as an explicit compliant disclaimer ("not a hedging recommendation") — enforced by a dedicated negation-aware test in `lib/explanation/__tests__/explanationEngine.test.ts`.

---

## 10. Deployment Guide

- **Hosting**: Vercel. Production URL: `https://index-range-calculator.vercel.app`.
- **Build**: `next build` (Turbopack). CI (`.github/workflows/ci.yml`) runs on every push/PR to `main`: `npm ci` → `tsc --noEmit` → `npm run lint` → `npm run test:coverage` → `npm run build`.
- **Deploy**: `vercel deploy --prod --token=$VERCEL_TOKEN --yes` from the `frontend/` directory (the real, GitHub-connected git root — NOT the outer repo).
- **Environment**: Vercel automatically sets `VERCEL_GIT_COMMIT_SHA`; `next.config.ts` re-exposes it (and a build timestamp) to the client bundle as `NEXT_PUBLIC_COMMIT_SHA` / `NEXT_PUBLIC_BUILD_TIME` for the `/health` page. Dhan broker credentials are supplied per-user at runtime via the connect flow (httpOnly session cookie) — never build-time secrets.
- **Post-deploy verification**: confirm the Developer Panel is absent (`NODE_ENV=production` gate), confirm `/health` loads and reports the correct version/commit.

---

## 11. Maintenance Guide

- **Coverage**: quantitative core (`lib/quant`, `lib/calculators`, `lib/analytics`, `lib/validation`, `lib/snapshot`, `lib/marketSession`, `lib/timeHorizon`, `lib/marketData`, `lib/context`, `lib/explanation`) is tracked against a 90%+ target — see `lib/devReports/staticReports.ts` for the last captured numbers.
- **Dead code**: `npx madge --orphans --ts-config tsconfig.json --extensions ts,tsx app components hooks lib store types` (excluding test files and Next.js page/route entry points, which always show as "orphans" to static analysis). Known, intentionally-not-deleted candidates: `components/ui/Skeleton.tsx`, `hooks/useDelayedLoading.ts`, `lib/ai/types.ts`, `types/market.ts` — reported, not removed, per this project's "report findings, don't auto-delete" discipline.
- **Circular dependencies**: `npx madge --circular --extensions ts,tsx lib components hooks store app` — zero, verified after every phase.
- **Retention**: historical snapshots self-prune per the configured `RetentionPolicy` (default 30 days) on every save; a 500-snapshot-per-day safety cap applies regardless of policy.
- **Storage growth**: `marketData.optionChain` is deliberately stripped before historical persistence (kept only in the in-session, capped-at-200 ring buffer) — the single biggest lever on `localStorage` quota.

---

## 12. Future Extension Guide

- **Historical IV / IV Rank / Percentile / Historical Max Pain**: now that `lib/history/**` persists real multi-day snapshots, a future phase could compute these from `historyStore.getRange()` instead of leaving them `undefined` — the `DataQuality` seam (`lib/context/dataQuality.ts`) already has the "historical" status ready for exactly this.
- **Volume Intelligence**: wire in a data source that reports volume (Dhan's current integration doesn't); flip `lib/marketData/volumeIntelligence.ts` from always-undefined to real values — no downstream consumer needs to change.
- **A remote database replacing `localStorage`**: implement the `HistoryStore` interface (`lib/history/types.ts`) with a new class, swap what `lib/history/registry.ts` instantiates — `historicalComparison.ts`, `export.ts`, and the `/health` page are unaffected.
- **New markets** (BSE/COMEX/CME/FOREX/CRYPTO): see Market Flow above.
- **A live-ticking countdown / real-time push updates**: still an open, previously-documented limitation across every phase — the app is refresh-driven (manual or interval), not push-driven.
