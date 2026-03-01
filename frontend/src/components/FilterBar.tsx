"use client";

import { useRef } from "react";
import type { FilterState, SignificanceLevel } from "@/types";
import type { PhaseGroup } from "@/utils/timeline";

interface Props {
  filterState: FilterState;
  onFilterChange: (state: FilterState) => void;
  phaseGroups: PhaseGroup[];
  yearBounds: [number, number] | null;
  language: string;
  matchCount: number;
  totalCount: number;
  currentMatchIndex: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;
}

const SIGNIFICANCE_LEVELS: SignificanceLevel[] = ["revolutionary", "high", "medium"];

function isDefaultFilter(f: FilterState, yearBounds: [number, number] | null): boolean {
  if (f.significance.size !== 3) return false;
  if (f.phase !== null) return false;
  if (f.searchQuery !== "") return false;
  if (f.yearRange && yearBounds && (f.yearRange[0] !== yearBounds[0] || f.yearRange[1] !== yearBounds[1])) return false;
  return true;
}

export function FilterBar({
  filterState,
  onFilterChange,
  phaseGroups,
  yearBounds,
  language,
  matchCount,
  totalCount,
  currentMatchIndex,
  onPrevMatch,
  onNextMatch,
}: Props) {
  const isZh = language.startsWith("zh");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  function updateSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilterChange({ ...filterState, searchQuery: value });
    }, 300);
  }

  function toggleSignificance(level: SignificanceLevel) {
    const next = new Set(filterState.significance);
    if (next.has(level)) {
      if (next.size <= 1) return;
      next.delete(level);
    } else {
      next.add(level);
    }
    onFilterChange({ ...filterState, significance: next });
  }

  function setPhase(phase: string | null) {
    onFilterChange({ ...filterState, phase });
  }

  function setYearMin(min: number) {
    if (!yearBounds) return;
    const max = filterState.yearRange?.[1] ?? yearBounds[1];
    onFilterChange({ ...filterState, yearRange: [Math.min(min, max), max] });
  }

  function setYearMax(max: number) {
    if (!yearBounds) return;
    const min = filterState.yearRange?.[0] ?? yearBounds[0];
    onFilterChange({ ...filterState, yearRange: [min, Math.max(min, max)] });
  }

  function resetFilters() {
    if (searchInputRef.current) searchInputRef.current.value = "";
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onFilterChange({
      significance: new Set<SignificanceLevel>(["revolutionary", "high", "medium"]),
      phase: null,
      yearRange: yearBounds ? [...yearBounds] : null,
      searchQuery: "",
    });
  }

  const hasActiveFilter = !isDefaultFilter(filterState, yearBounds);
  const hasSearch = filterState.searchQuery.length > 0;

  const effectiveYearRange = filterState.yearRange ?? yearBounds;

  return (
    <div
      className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center gap-2 px-4"
      data-export-hide
    >
      {/* Significance toggles */}
      <div className="flex gap-1">
        {SIGNIFICANCE_LEVELS.map((level) => {
          const active = filterState.significance.has(level);
          let activeClass = "";
          const inactiveClass = "bg-chrono-surface text-chrono-text-muted";
          if (level === "revolutionary") {
            activeClass = "bg-chrono-revolutionary/20 text-chrono-revolutionary";
          } else if (level === "high") {
            activeClass = "bg-chrono-high/20 text-chrono-high";
          } else {
            activeClass = "bg-chrono-medium/20 text-chrono-medium";
          }
          const label = level === "revolutionary"
            ? (isZh ? "革命性" : "Rev")
            : level === "high"
              ? (isZh ? "重要" : "High")
              : (isZh ? "一般" : "Med");
          return (
            <button
              key={level}
              onClick={() => toggleSignificance(level)}
              className={`rounded px-2 py-0.5 text-chrono-tiny transition-colors ${active ? activeClass : inactiveClass}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Phase dropdown */}
      {phaseGroups.length > 0 && (
        <select
          value={filterState.phase ?? ""}
          onChange={(e) => setPhase(e.target.value || null)}
          className="rounded border border-chrono-border bg-chrono-surface px-2 py-0.5 text-chrono-tiny text-chrono-text-secondary outline-none"
        >
          <option value="">{isZh ? "全部阶段" : "All phases"}</option>
          {phaseGroups.map((g) => (
            <option key={g.name} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>
      )}

      {/* Year range slider */}
      {yearBounds && effectiveYearRange && (
        <div className="flex items-center gap-1.5">
          <span className="text-chrono-tiny text-chrono-text-muted">
            {effectiveYearRange[0]}
          </span>
          <div className="relative h-4 w-24">
            <input
              type="range"
              min={yearBounds[0]}
              max={yearBounds[1]}
              value={effectiveYearRange[0]}
              onChange={(e) => setYearMin(parseInt(e.target.value, 10))}
              className="chrono-range-slider absolute inset-0 w-full"
            />
            <input
              type="range"
              min={yearBounds[0]}
              max={yearBounds[1]}
              value={effectiveYearRange[1]}
              onChange={(e) => setYearMax(parseInt(e.target.value, 10))}
              className="chrono-range-slider absolute inset-0 w-full"
            />
          </div>
          <span className="text-chrono-tiny text-chrono-text-muted">
            {effectiveYearRange[1]}
          </span>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          ref={searchInputRef}
          type="text"
          defaultValue={filterState.searchQuery}
          onChange={(e) => updateSearch(e.target.value)}
          placeholder={isZh ? "搜索…" : "Search…"}
          className="w-40 rounded border border-chrono-border bg-chrono-surface px-2 py-0.5 text-chrono-tiny text-chrono-text placeholder:text-chrono-text-muted outline-none focus:border-chrono-border-active"
        />
      </div>

      {/* Match navigation */}
      {hasSearch && (
        <div className="flex items-center gap-1 text-chrono-tiny text-chrono-text-muted">
          <span>
            {matchCount > 0
              ? `${currentMatchIndex + 1} / ${matchCount}`
              : isZh ? "无匹配" : "No match"}
          </span>
          {matchCount > 1 && (
            <>
              <button
                onClick={onPrevMatch}
                className="rounded px-1 transition-colors hover:text-chrono-text-secondary"
              >
                ▲
              </button>
              <button
                onClick={onNextMatch}
                className="rounded px-1 transition-colors hover:text-chrono-text-secondary"
              >
                ▼
              </button>
            </>
          )}
        </div>
      )}

      {/* Active filter indicator + reset */}
      {hasActiveFilter && (
        <>
          <span className="text-chrono-tiny text-chrono-text-muted">
            {totalCount} {isZh ? "个节点" : "nodes"}
          </span>
          <button
            onClick={resetFilters}
            className="rounded border border-chrono-border px-1.5 py-0.5 text-chrono-tiny text-chrono-text-muted transition-colors hover:border-chrono-border-active hover:text-chrono-text-secondary"
          >
            {isZh ? "重置" : "Reset"}
          </button>
        </>
      )}
    </div>
  );
}
