import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";
import { ScrollReveal } from "./ScrollReveal";

interface Props {
  locale: Locale;
}

const levelLabels: Record<Locale, [string, string, string, string]> = {
  en: ["Light", "Medium", "Deep", "Epic"],
  zh: ["轻量", "中等", "深度", "史诗"],
};

const nodeLabel: Record<Locale, string> = { en: "nodes", zh: "节点" };

function DepthLevels({ locale }: { locale: Locale }) {
  const labels = levelLabels[locale];
  const levels = [
    { label: labels[0], nodes: "15-25", width: "w-1/4", color: "bg-chrono-level-light" },
    { label: labels[1], nodes: "25-45", width: "w-2/4", color: "bg-chrono-level-medium" },
    { label: labels[2], nodes: "50-80", width: "w-3/4", color: "bg-chrono-level-deep" },
    { label: labels[3], nodes: "80-150+", width: "w-full", color: "bg-chrono-level-epic" },
  ];
  return (
    <div className="space-y-3 p-6 rounded-xl border border-chrono-border/50 bg-chrono-surface/30">
      {levels.map((l) => (
        <div key={l.label} className="flex items-center gap-3">
          <span className="text-chrono-tiny font-medium text-chrono-text-secondary w-14">
            {l.label}
          </span>
          <div className="flex-1 h-2.5 rounded-full bg-chrono-bg/50 overflow-hidden">
            <div className={`h-full rounded-full ${l.width} ${l.color} transition-all`} />
          </div>
          <span className="text-chrono-tiny text-chrono-text-muted w-20 text-right">
            {l.nodes} {nodeLabel[locale]}
          </span>
        </div>
      ))}
    </div>
  );
}

const connectionTexts: Record<Locale, { caused: string; inspired: string; eventA: string; eventADesc: string; eventB: string; eventBDesc: string; eventC: string; eventCDesc: string }> = {
  en: {
    caused: "caused",
    inspired: "inspired",
    eventA: "Event A",
    eventADesc: "Revolutionary milestone",
    eventB: "Event B",
    eventBDesc: "Direct consequence",
    eventC: "Event C",
    eventCDesc: "Inspired innovation",
  },
  zh: {
    caused: "导致",
    inspired: "启发",
    eventA: "事件 A",
    eventADesc: "革命性里程碑",
    eventB: "事件 B",
    eventBDesc: "直接结果",
    eventC: "事件 C",
    eventCDesc: "受启发的创新",
  },
};

function ConnectionsDiagram({ locale }: { locale: Locale }) {
  const t = connectionTexts[locale];
  return (
    <div className="relative p-6 rounded-xl border border-chrono-border/50 bg-chrono-surface/30">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        style={{ left: 0, top: 0 }}
      >
        {/* A→B: caused */}
        <path
          d="M 32 46 C 60 46, 60 106, 32 106"
          stroke="var(--color-chrono-caused)"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="4 3"
          opacity="0.7"
        />
        <text x="64" y="79" fill="var(--color-chrono-caused)" fontSize="10" fontFamily="inherit" opacity="0.8">
          {t.caused}
        </text>
        {/* A→C: inspired */}
        <path
          d="M 32 46 C 72 46, 72 166, 32 166"
          stroke="var(--color-chrono-inspired)"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="4 3"
          opacity="0.7"
        />
        <text x="76" y="118" fill="var(--color-chrono-inspired)" fontSize="10" fontFamily="inherit" opacity="0.8">
          {t.inspired}
        </text>
      </svg>
      <div className="relative flex flex-col gap-4">
        <div className="rounded-lg border-l-2 border-chrono-revolutionary bg-chrono-bg/60 px-4 py-2.5">
          <div className="text-chrono-caption font-medium text-chrono-text">
            {t.eventA}
          </div>
          <div className="text-chrono-tiny text-chrono-text-muted">
            {t.eventADesc}
          </div>
        </div>
        <div className="rounded-lg border-l-2 border-chrono-high bg-chrono-bg/60 px-4 py-2.5">
          <div className="text-chrono-caption font-medium text-chrono-text">
            {t.eventB}
          </div>
          <div className="text-chrono-tiny text-chrono-text-muted">
            {t.eventBDesc}
          </div>
        </div>
        <div className="rounded-lg border-l-2 border-chrono-inspired bg-chrono-bg/60 px-4 py-2.5">
          <div className="text-chrono-caption font-medium text-chrono-text">
            {t.eventC}
          </div>
          <div className="text-chrono-tiny text-chrono-text-muted">
            {t.eventCDesc}
          </div>
        </div>
      </div>
    </div>
  );
}

function MultiLangPreview() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-chrono-border/50 bg-chrono-surface/30 p-4">
        <div className="text-chrono-tiny font-medium text-chrono-accent/70 mb-3 uppercase tracking-wider">
          English
        </div>
        <div className="space-y-2.5 text-chrono-caption text-chrono-text-secondary">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-chrono-revolutionary" />
            iPhone Announcement
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-chrono-high" />
            App Store Launch
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-chrono-revolutionary" />
            iPhone X &amp; Face ID
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-chrono-border/50 bg-chrono-surface/30 p-4">
        <div className="text-chrono-tiny font-medium text-chrono-accent/70 mb-3 uppercase tracking-wider">
          中文
        </div>
        <div className="space-y-2.5 text-chrono-caption text-chrono-text-secondary">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-chrono-revolutionary" />
            iPhone 发布会
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-chrono-high" />
            App Store 上线
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-chrono-revolutionary" />
            iPhone X 与 Face ID
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureIllustration({ index, locale }: { index: number; locale: Locale }) {
  switch (index) {
    case 0:
      return <DepthLevels locale={locale} />;
    case 1:
      return <ConnectionsDiagram locale={locale} />;
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
                <FeatureIllustration index={i} locale={locale} />
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
