"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Card from "@/components/ui/Card";
import { useFnoStockUniverse, type FnoStockInfo } from "@/hooks/useFnoStockUniverse";
import { searchInstruments, findClosestMatches, type MatchRange, type SearchResult } from "@/lib/search/fuzzySearch";
import { formatDate } from "@/lib/format";
import { triggerHaptic } from "@/lib/haptics";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (symbol: string) => void;
};

const DEBOUNCE_MS = 200;
const RESULT_LIMIT = 8;

function HighlightedText({ text, ranges }: { text: string; ranges: MatchRange[] }) {
  if (ranges.length === 0) return <>{text}</>;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) nodes.push(<span key={`plain-${i}`}>{text.slice(cursor, start)}</span>);
    nodes.push(
      <span key={`match-${i}`} className="font-extrabold text-primary">
        {text.slice(start, end)}
      </span>,
    );
    cursor = end;
  });
  if (cursor < text.length) nodes.push(<span key="plain-end">{text.slice(cursor)}</span>);
  return <>{nodes}</>;
}

function ResultRow({
  result,
  isActive,
  onPick,
  onHover,
}: {
  result: SearchResult<FnoStockInfo>;
  isActive: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  const { item } = result;
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      // Prevents the input from blurring (and the dropdown closing) before
      // the click's onClick has a chance to register.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      onMouseEnter={onHover}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
        isActive ? "bg-primary/15" : "hover:bg-card/60"
      }`}
    >
      {/* Company logo placeholder — no logo source exists, so a monogram
          badge, matching the same convention used for broker avatars. */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-bold text-foreground">
        {item.symbol.slice(0, 2)}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-foreground">
            <HighlightedText text={item.symbol} ranges={result.symbolRanges} />
          </span>
          {!result.isClosestMatchFallback && (
            <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
              F&amp;O
            </span>
          )}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          <HighlightedText text={item.name} ranges={result.nameRanges} />
        </span>
        <span className="truncate text-[10px] text-muted-foreground/70">
          {item.category} · Expiry {formatDate(item.nearestExpiry)}
        </span>
      </span>
    </button>
  );
}

/**
 * Searchable stock-option symbol entry — ranked, typo-tolerant, multi-word
 * suggestions drawn from the complete, live NSE F&O stock universe
 * (lib/dhan/scripMaster.ts, never a static list). Enter/click selects a real,
 * verified symbol; arbitrary unmatched text can't advance, since there's
 * nothing honest to calculate against an unverified ticker.
 */
export default function StockSearchInput({ label, value, onChange, onSelect }: Props) {
  const { stocks, isLoading, error } = useFnoStockUniverse();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Live search feel (the input itself updates every keystroke) with the
  // actual re-ranking debounced 200ms, per spec — avoids re-scoring the full
  // universe on every keystroke for fast typists.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const results = useMemo(() => searchInstruments(debouncedValue, stocks, RESULT_LIMIT), [debouncedValue, stocks]);
  const closestMatches = useMemo(
    () => (results.length === 0 ? findClosestMatches(debouncedValue, stocks, 4) : []),
    [results.length, debouncedValue, stocks],
  );
  const displayedResults = results.length > 0 ? results : closestMatches;

  function selectResult(sym: string) {
    triggerHaptic("normal");
    onChange(sym);
    setIsOpen(false);
    onSelect(sym);
  }

  return (
    <div className="relative">
      <Card
        variant="glass"
        className="h-full transition-[border-color,box-shadow] duration-300 focus-within:border-primary/60 focus-within:shadow-[0_0_30px_-8px_rgba(182,255,34,0.5)]"
      >
        <label className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">{label}</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => {
              onChange(event.target.value.toUpperCase());
              setIsOpen(true);
              setActiveIndex(0);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIsOpen(true);
                setActiveIndex((i) => Math.min(i + 1, Math.max(displayedResults.length - 1, 0)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const active = displayedResults[activeIndex];
                if (active && !active.isClosestMatchFallback) selectResult(active.item.symbol);
              } else if (event.key === "Escape" && isOpen) {
                // Stop here so the wizard's global ESC-back handler doesn't also
                // fire and navigate away while the suggestion list is open.
                event.stopPropagation();
                setIsOpen(false);
              }
            }}
            placeholder="Company name, symbol, or sector — e.g. RELIANCE, TATA, BANK"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-label={label}
            className="w-full min-w-0 bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </label>
      </Card>

      {isOpen && value && (
        <div
          id={listboxId}
          role="listbox"
          className="glass-premium absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-80 overflow-y-auto rounded-[18px] p-2 backdrop-blur-xl"
        >
          {isLoading && stocks.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Loading F&amp;O stock list…</p>
          ) : error ? (
            <p className="px-3 py-3 text-sm text-bearish">{error}</p>
          ) : results.length === 0 ? (
            <div className="flex flex-col gap-1">
              <p className="px-3 py-2 text-sm font-semibold text-foreground">No matching F&amp;O stock found.</p>
              {closestMatches.length > 0 && (
                <>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Closest matches
                  </p>
                  {closestMatches.map((result, i) => (
                    <ResultRow
                      key={result.item.symbol}
                      result={result}
                      isActive={i === activeIndex}
                      onPick={() => selectResult(result.item.symbol)}
                      onHover={() => setActiveIndex(i)}
                    />
                  ))}
                </>
              )}
            </div>
          ) : (
            results.map((result, i) => (
              <ResultRow
                key={result.item.symbol}
                result={result}
                isActive={i === activeIndex}
                onPick={() => selectResult(result.item.symbol)}
                onHover={() => setActiveIndex(i)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
