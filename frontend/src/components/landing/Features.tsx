import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";
import { ScrollReveal } from "./ScrollReveal";

interface Props {
  locale: Locale;
}

function DepthLevels() {
  const levels = [
    { label: "Light", width: "w-1/4", color: "bg-chrono-text-muted" },
    { label: "Medium", width: "w-2/4", color: "bg-chrono-high" },
    { label: "Deep", width: "w-3/4", color: "bg-chrono-accent/70" },
    { label: "Epic", width: "w-full", color: "bg-chrono-accent" },
  ];
  return (
    <div className="space-y-3 p-6 rounded-xl border border-chrono-border bg-chrono-surface/50">
      {levels.map((l) => (
        <div key={l.label} className="flex items-center gap-3">
          <span className="text-chrono-tiny text-chrono-text-muted w-14">
            {l.label}
          </span>
          <div className={`h-2 rounded-full ${l.width} ${l.color}`} />
        </div>
      ))}
    </div>
  );
}

function ConnectionsDiagram() {
  return (
    <div className="relative p-6 rounded-xl border border-chrono-border bg-chrono-surface/50">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 300 200"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d="M 40 45 C 80 45, 80 100, 40 100"
          stroke="var(--color-chrono-caused)"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="4 3"
        />
        <text
          x="85"
          y="75"
          fill="var(--color-chrono-caused)"
          fontSize="9"
          fontFamily="inherit"
        >
          caused
        </text>
        <path
          d="M 40 45 C 80 45, 80 155, 40 155"
          stroke="var(--color-chrono-inspired)"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="4 3"
        />
        <text
          x="85"
          y="130"
          fill="var(--color-chrono-inspired)"
          fontSize="9"
          fontFamily="inherit"
        >
          inspired
        </text>
      </svg>
      <div className="relative space-y-6">
        <div className="rounded-lg border-l-2 border-chrono-revolutionary bg-chrono-bg/50 px-4 py-2">
          <div className="text-chrono-caption font-medium text-chrono-text">
            Event A
          </div>
          <div className="text-chrono-tiny text-chrono-text-muted">
            Revolutionary milestone
          </div>
        </div>
        <div className="rounded-lg border-l-2 border-chrono-high bg-chrono-bg/50 px-4 py-2">
          <div className="text-chrono-caption font-medium text-chrono-text">
            Event B
          </div>
          <div className="text-chrono-tiny text-chrono-text-muted">
            Direct consequence
          </div>
        </div>
        <div className="rounded-lg border-l-2 border-chrono-high bg-chrono-bg/50 px-4 py-2">
          <div className="text-chrono-caption font-medium text-chrono-text">
            Event C
          </div>
          <div className="text-chrono-tiny text-chrono-text-muted">
            Inspired innovation
          </div>
        </div>
      </div>
    </div>
  );
}

function MultiLangPreview() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-chrono-border bg-chrono-surface/50 p-4">
        <div className="text-chrono-tiny text-chrono-text-muted mb-2">
          English
        </div>
        <div className="space-y-2 text-chrono-caption text-chrono-text-secondary">
          <div>iPhone Announcement</div>
          <div>App Store Launch</div>
          <div>iPhone X & Face ID</div>
        </div>
      </div>
      <div className="rounded-xl border border-chrono-border bg-chrono-surface/50 p-4">
        <div className="text-chrono-tiny text-chrono-text-muted mb-2">
          {"\u4e2d\u6587"}
        </div>
        <div className="space-y-2 text-chrono-caption text-chrono-text-secondary">
          <div>iPhone {"\u53d1\u5e03\u4f1a"}</div>
          <div>App Store {"\u4e0a\u7ebf"}</div>
          <div>iPhone X {"\u4e0e"} Face ID</div>
        </div>
      </div>
    </div>
  );
}

function FeatureIllustration({ index }: { index: number }) {
  switch (index) {
    case 0:
      return <DepthLevels />;
    case 1:
      return <ConnectionsDiagram />;
    case 2:
      return <MultiLangPreview />;
    default:
      return null;
  }
}

export function Features({ locale }: Props) {
  const t = messages[locale].features;

  return (
    <section className="py-24 sm:py-32 px-4">
      <div className="mx-auto max-w-5xl">
        <ScrollReveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-chrono-text text-center">
            {t.heading}
          </h2>
        </ScrollReveal>
        {t.items.map((item, i) => (
          <ScrollReveal key={i}>
            <div
              className={`mt-20 flex flex-col ${i % 2 ? "sm:flex-row-reverse" : "sm:flex-row"} gap-12 items-center`}
            >
              <div className="flex-1">
                <h3 className="text-chrono-title font-semibold text-chrono-text mb-3">
                  {item.title}
                </h3>
                <p className="text-chrono-body text-chrono-text-secondary">
                  {item.description}
                </p>
              </div>
              <div className="flex-1 w-full">
                <FeatureIllustration index={i} />
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
