"use client";

interface AxisDotProps {
  significance: string;
}

export default function AxisDot({ significance }: AxisDotProps) {
  if (significance === "revolutionary") {
    return (
      <span className="relative flex items-center justify-center">
        <span className="absolute h-5 w-5 rounded-full bg-chrono-revolutionary/15 animate-pulse" />
        <span className="relative h-3 w-3 rounded-full bg-chrono-revolutionary shadow-[0_0_10px_2px_rgba(240,192,96,.5)]" />
      </span>
    );
  }
  if (significance === "high") {
    return (
      <span className="h-2.5 w-2.5 rounded-full bg-chrono-high ring-4 ring-chrono-bg" />
    );
  }
  return (
    <span className="h-1.5 w-1.5 rounded-full bg-chrono-medium ring-4 ring-chrono-bg" />
  );
}
