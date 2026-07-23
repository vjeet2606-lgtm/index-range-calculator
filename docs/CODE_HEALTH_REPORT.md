# LYNX ONE — Code Health Report
**Phase 5, Workstream 3.** Read-only analysis. Nothing in this report was auto-deleted or auto-fixed — every finding below is a report, not an action.

## Circular Dependency Check ✅
Run via `npx madge --circular` across `lib/`, `store/`, `hooks/`, `components/`, `app/` (190 files).

**Result: zero circular dependencies found.** The layered architecture (`lib/quant` → `lib/calculators` → `lib/analytics`/`lib/timeHorizon`/`lib/marketSession`/`lib/snapshot`/`lib/validation` → `store` → `hooks` → `components`) holds structurally, not just by convention.

## Unused Exports / Dead Code Candidates
Run via `npx madge --orphans` (files nothing else imports). Most of the 47 flagged files are expected orphans by design — test files (never imported by other source), Next.js framework entry points (`app/layout.tsx`, `app/page.tsx`, API routes Next.js calls directly). Three are genuine dead-code candidates:

| File | Finding |
|---|---|
| `components/ui/Skeleton.tsx` | Zero references anywhere in the codebase, including comments. Built per the original architecture plan's Phase 4 ("loading placeholder for live-data mode") but never wired into any component. |
| `hooks/useDelayedLoading.ts` | Zero references except being named in a comment inside `hooks/useMinimumDurationVisible.ts` ("Mirrors useDelayedLoading.ts's proven shape") — that hook is its actively-used successor (wired into `components/ResultDashboard.tsx`). This one appears fully superseded. |
| `lib/ai/types.ts` | Confirms a finding from the Phase 3 independent audit: this "future AI Explanation Engine" placeholder documents a shape (`volume`, `openInterestChange`, `maxPain`, flat `greeks`) that no longer matches what `MarketDNA` (Phase 3) or `SessionSnapshot` (Phase 5) actually provide. Genuinely orphaned — nothing imports it. |

**Recommendation:** delete `Skeleton.tsx` and `useDelayedLoading.ts` if a follow-up is authorized (not done here — "do not automatically delete code"); update or remove `lib/ai/types.ts` in favor of `MarketDNA`/`SessionSnapshot` as the actual future-AI contract.

## Module Dependency / Folder Summary
```
lib/quant/core          — frozen pricing primitives (BSM, Black-76, IV solver, normal dist, day count)
lib/calculators          — frozen engine orchestration (calculationEngine, expectedLevels, premiumBreakdown, ivEngine)
lib/timeHorizon           ─┐
lib/marketSession          ├─ session/time layer, each importable independently, no cross-imports between them
lib/analytics              ├─ 7 intelligence modules, each independently testable, no imports of each other
lib/snapshot                ├─ NEW (Phase 5) — imports lib/analytics/types only
lib/validation              └─ NEW (Phase 5) — imports lib/snapshot/types only, one-directional
store/marketStore.ts      — imports from all of the above; nothing above imports back (confirmed acyclic)
hooks/*                   — the only layer that imports store + lib together
components/*               — the only layer that imports hooks + store together
```
Layering is clean and one-directional. `lib/analytics`, `lib/snapshot`, and `lib/validation` in particular have zero mutual imports despite being conceptually related — each was deliberately built to depend only on what it structurally needs (documented in each module's own file header).

## Bundle Size Summary
From a clean production build (`rm -rf .next && npm run build`):
- Client-side JS chunks total: **~1.0 MB** (`​.next/static/chunks`)
- Largest single chunk: **276 KB**
- Total `.next` build output (includes server code/cache): **11 MB**

No single dependency dominates unreasonably; Framer Motion and the six Capacitor native plugins are the heaviest third-party contributors, both already load-bearing (animation system, native mobile bridge) rather than incidental.

## Performance Hotspots / Expensive Recalculations / Duplicate State Updates / Memory / Re-renders
Carried forward from the Phase 3 independent audit (still accurate — none of the audited files changed since), plus new Phase 5-specific notes:

- **No circular/duplicate calculation paths** — confirmed structurally by the dependency graph above, not just by inspection.
- **`hooks/useMarketIntelligence.ts` fully recomputes on every fresh result** (all 7 analytics modules + now a snapshot), by design ("every refresh is a fresh calculation"). At current data volumes (≤10 legs) this is sub-millisecond (see Benchmark Results) — not a real bottleneck today, but the pattern doesn't memoize incrementally, worth revisiting if a future module operates over a much larger dataset.
- **NEW (Phase 5): `store.snapshots` is an unbounded-growth risk without the cap already built in** — `addSnapshot` slices to the most recent 200 entries (`MAX_SNAPSHOTS`) specifically to address this before it could become a real memory concern; each `SessionSnapshot` is deep-frozen (a real, if small, per-snapshot allocation/traversal cost — acceptable given snapshots are created at most once per refresh, not per render).
- **"Remaining Session" countdown still doesn't tick live between refreshes** (unchanged from the earlier audit) — still a real, if minor, staleness gap.
- **`store/marketStore.ts` continues to grow** (now ~340 lines across 6 phases of additive work) — still functionally fine (Zustand selectors prevent unrelated re-renders) but the "God Store" maintainability trend flagged earlier remains true and is now more pronounced.

## What's New and Healthy Since the Last Audit
- Phase 4/5 added the first-ever unit tests for `useSessionLock.ts`, `useMarketIntelligence.ts`, and `useLiveRange.ts` — closing the exact test-coverage gap the Phase 3 audit flagged as its most serious finding (these hooks had already produced two real, shipped bugs with zero regression protection).
- `lib/snapshot/**` and `lib/validation/**` were built with zero circular imports and 100% test coverage from day one.
