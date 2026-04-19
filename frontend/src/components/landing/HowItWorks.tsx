"use client";

import type { Locale } from "@/data/landing";
import { Icon } from "@/components/ui/Icon";

interface Props {
  locale: Locale;
}

interface Step {
  icon: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  detail: string;
  detailZh: string;
  chips: string[];
  chipsZh: string[];
}

const STEPS: Step[] = [
  {
    icon: "search",
    title: "You enter a topic",
    titleZh: "输入主题",
    description: "Type anything — a person, event, technology, or idea. The orchestrator analyzes complexity and creates a research plan.",
    descriptionZh: "输入任何内容 — 人物、事件、技术或概念。编排器分析复杂度并生成调研计划。",
    detail: "The system assesses topic scope, selects research dimensions, and estimates the timeline depth.",
    detailZh: "系统评估主题范围，选择调研维度，并预估时间线深度。",
    chips: ["Complexity analysis", "Auto-planning"],
    chipsZh: ["复杂度分析", "自动规划"],
  },
  {
    icon: "layers",
    title: "Agents research in parallel",
    titleZh: "智能体并行调研",
    description: "Milestone, Detail, and Gap agents work simultaneously — searching the web, deduplicating, and enriching every node.",
    descriptionZh: "里程碑、细节和补充智能体同时工作 — 搜索网络、去重并丰富每个节点。",
    detail: "Each agent specializes: milestones find key events, detail agents add depth, gap agents fill missing periods.",
    detailZh: "每个智能体各有专长：里程碑发现关键事件，细节智能体增添深度，补充智能体填补空白。",
    chips: ["Tavily search", "LLM synthesis", "Deduplication"],
    chipsZh: ["Tavily 搜索", "LLM 综合", "去重机制"],
  },
  {
    icon: "bolt",
    title: "A live timeline streams in",
    titleZh: "时间线实时呈现",
    description: "Nodes appear as they're discovered. Connections draw between related events. A final synthesis distills the narrative.",
    descriptionZh: "节点在发现时即时展示。关联事件之间绘制连接线。最终综述提炼核心叙事。",
    detail: "SSE streaming delivers each node in real-time — no waiting for the full result before exploring.",
    detailZh: "SSE 流式传输实时交付每个节点 — 无需等待完整结果即可开始探索。",
    chips: ["SSE streaming", "Causal links", "Source-backed"],
    chipsZh: ["SSE 流式传输", "因果关联", "来源引证"],
  },
];

const PHASES = [
  { label: "Skeleton", labelZh: "构建骨架", color: "bg-chrono-level-light" },
  { label: "Enrich", labelZh: "深度补充", color: "bg-chrono-level-medium" },
  { label: "Gap fill", labelZh: "空白填补", color: "bg-chrono-level-deep" },
  { label: "Synthesis", labelZh: "智能综述", color: "bg-chrono-accent" },
];

export function HowItWorks({ locale }: Props) {
  const isZh = locale === "zh";

  return (
    <section id="how" className="py-24 sm:py-32 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-chrono-tiny font-medium text-chrono-accent/70 uppercase tracking-wider">
            {isZh ? "工作原理" : "How it works"}
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-chrono-text">
            {isZh ? "三步生成完整时间线" : "Three steps to a complete timeline"}
          </h2>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {/* Connector line */}
          <div className="hidden md:block absolute top-14 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px bg-chrono-border/40" />

          {STEPS.map((step, i) => (
            <div key={i} className="relative text-center">
              {/* Icon circle */}
              <div className="relative mx-auto mb-6 flex size-14 items-center justify-center rounded-full border border-chrono-accent/30 bg-chrono-bg">
                <div className="absolute inset-0 rounded-full bg-chrono-accent/[0.06] blur-md" />
                <Icon name={step.icon} size={22} className="relative text-chrono-accent" />
              </div>

              {/* Step number */}
              <span className="text-chrono-tiny font-bold text-chrono-accent/50 mb-1 block">
                0{i + 1}
              </span>

              {/* Title */}
              <h3 className="text-chrono-body font-semibold text-chrono-text mb-2">
                {isZh ? step.titleZh : step.title}
              </h3>

              {/* Description */}
              <p className="text-chrono-caption text-chrono-text-secondary mb-2">
                {isZh ? step.descriptionZh : step.description}
              </p>

              {/* Detail */}
              <p className="text-chrono-tiny text-chrono-text-muted mb-3">
                {isZh ? step.detailZh : step.detail}
              </p>

              {/* Chips */}
              <div className="flex flex-wrap justify-center gap-1.5">
                {(isZh ? step.chipsZh : step.chips).map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-chrono-border/40 bg-chrono-surface/30 px-2.5 py-0.5 text-chrono-tiny text-chrono-text-muted"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Phase stepper */}
        <div className="mt-16 mx-auto max-w-lg rounded-xl border border-chrono-border/40 bg-chrono-surface/20 p-5">
          <p className="text-chrono-tiny text-chrono-text-muted text-center mb-4 uppercase tracking-wider">
            {isZh ? "调研阶段" : "Research phases"}
          </p>
          <div className="flex items-center gap-2">
            {PHASES.map((phase, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className={`h-1.5 w-full rounded-full ${phase.color}/30`}>
                  <div className={`h-full rounded-full ${phase.color} w-full`} />
                </div>
                <span className="text-chrono-tiny text-chrono-text-muted">
                  {isZh ? phase.labelZh : phase.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
