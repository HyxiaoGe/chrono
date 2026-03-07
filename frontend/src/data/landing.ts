import { useSyncExternalStore, useCallback } from "react";

export type Locale = "en" | "zh";

const LOCALE_KEY = "chrono-locale";

const subscribers = new Set<() => void>();

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => { subscribers.delete(callback); };
}

export function getLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(LOCALE_KEY);
  if (stored === "zh" || stored === "en") return stored;
  return navigator.language.startsWith("zh") ? "zh" : "en";
}

export function persistLocale(locale: Locale) {
  localStorage.setItem(LOCALE_KEY, locale);
  subscribers.forEach((cb) => cb());
}

export function useLocale(): [Locale, () => void] {
  const locale = useSyncExternalStore(
    subscribe,
    getLocale,
    () => "en" as Locale,
  );
  const toggle = useCallback(() => {
    const next = getLocale() === "en" ? "zh" : "en";
    persistLocale(next);
  }, []);
  return [locale, toggle];
}

interface LandingMessages {
  nav: { home: string; getStarted: string };
  hero: { title: string; titleAccent: string; subtitle: string; cta: string };
  howItWorks: {
    heading: string;
    steps: Array<{ title: string; description: string; details: string[] }>;
  };
  features: {
    heading: string;
    items: Array<{ title: string; description: string }>;
  };
  footer: { heading: string; cta: string; copyright: string };
  demo: {
    skip: string;
    subtitle: string;
    researchDimensions: string;
    synthesis: string;
  };
  app: {
    title: string;
    subtitle: string;
    placeholder: string;
    research: string;
    analyzing: string;
    recent: string;
    ago: string;
    nodes: string;
    explore: string;
    noHistory: string;
    viewAll: string;
    researchDimensions: string;
    startResearch: string;
    cancel: string;
    groupTech: string;
    groupHistory: string;
  };
}

export const messages: Record<Locale, LandingMessages> = {
  en: {
    nav: { home: "Home", getStarted: "Get Started" },
    hero: {
      title: "Research any timeline",
      titleAccent: "in minutes, not hours",
      subtitle:
        "Enter any topic \u2014 AI builds a comprehensive, source-backed interactive timeline with connections and synthesis.",
      cta: "Try Chrono \u2192",
    },
    howItWorks: {
      heading: "How it works",
      steps: [
        {
          title: "Enter a topic",
          description: "Type any keyword — the Orchestrator analyzes complexity, plans research dimensions, and generates a proposal for you to confirm.",
          details: ["Complexity assessment (Light → Epic)", "Research dimensions & time estimate", "Confirm or adjust before starting"],
        },
        {
          title: "Build skeleton",
          description: "Milestone Agents search and build the timeline backbone — multiple dimensions run in parallel, each discovering key events.",
          details: ["Parallel agents per dimension", "Tavily search + LLM knowledge", "3-layer deduplication"],
        },
        {
          title: "Enrich details",
          description: "Detail Agents dive deep into every node — searching for facts, stats, key people, and impact. Nodes stream to you as they complete.",
          details: ["Concurrent deep research per node", "Key stats, quotes & sources", "Hallucination filtering"],
        },
        {
          title: "Analyze & synthesize",
          description: "Gap analysis finds missing events and causal connections. A Synthesizer generates the final narrative summary and cross-validates dates.",
          details: ["Gap detection & auto-fill", "Causal connection mapping", "Date cross-validation"],
        },
      ],
    },
    features: {
      heading: "Built for depth",
      items: [
        {
          title: "Four depth levels",
          description:
            "From a quick 2-minute overview to a 15-minute deep dive with 80+ nodes. Choose the level that fits your needs.",
        },
        {
          title: "Connections & Synthesis",
          description:
            "AI identifies causal links between events \u2014 what caused what, what inspired what. A final synthesis distills the key insight.",
        },
        {
          title: "Multi-language",
          description:
            "Research in English, Chinese, or any language. The system detects your input and responds accordingly.",
        },
      ],
    },
    footer: {
      heading: "Ready to explore?",
      cta: "Try Chrono \u2192",
      copyright: "Chrono \u00b7 Built with AI agents",
    },
    demo: {
      skip: "Skip",
      subtitle: "Enter any topic. AI researches its timeline.",
      researchDimensions: "Research Dimensions",
      synthesis: "Synthesis",
    },
    app: {
      title: "Chrono",
      subtitle: "Enter any topic. AI researches its timeline.",
      placeholder: "iPhone, \u6bd4\u7279\u5e01, Cold War...",
      research: "Research",
      analyzing: "Analyzing...",
      recent: "Recent",
      ago: "ago",
      nodes: "nodes",
      explore: "Explore topics",
      noHistory: "No research history yet",
      viewAll: "View all",
      researchDimensions: "Research Dimensions",
      startResearch: "Start Research",
      cancel: "Cancel",
      groupTech: "Products & Tech",
      groupHistory: "History & Culture",
    },
  },
  zh: {
    nav: { home: "\u9996\u9875", getStarted: "\u5f00\u59cb\u4f7f\u7528" },
    hero: {
      title: "\u4efb\u4f55\u4e3b\u9898\u7684\u65f6\u95f4\u7ebf",
      titleAccent:
        "\u51e0\u5206\u949f\uff0c\u800c\u975e\u6570\u5c0f\u65f6",
      subtitle:
        "\u8f93\u5165\u4efb\u610f\u4e3b\u9898\uff0cAI \u81ea\u52a8\u6784\u5efa\u5b8c\u6574\u7684\u4ea4\u4e92\u5f0f\u65f6\u95f4\u7ebf \u2014 \u5305\u542b\u6765\u6e90\u5f15\u7528\u3001\u4e8b\u4ef6\u5173\u8054\u4e0e\u667a\u80fd\u603b\u7ed3\u3002",
      cta: "\u5f00\u59cb\u4f7f\u7528 \u2192",
    },
    howItWorks: {
      heading: "工作原理",
      steps: [
        {
          title: "输入主题",
          description: "输入任意关键词 — Orchestrator 分析复杂度、规划调研维度，生成调研提案供你确认。",
          details: ["复杂度评估 (Light → Epic)", "调研维度与时间预估", "确认后开始执行"],
        },
        {
          title: "构建骨架",
          description: "Milestone Agent 并行搜索多个维度，发现关键事件节点，构建时间线骨架。",
          details: ["多维度并行调研", "Tavily 搜索 + 模型知识", "三层去重机制"],
        },
        {
          title: "深度补充",
          description: "Detail Agent 逐一深挖每个节点 — 搜索事实、数据、关键人物和影响。节点完成后实时推送。",
          details: ["节点级并发深度调研", "关键数据、引用与来源", "幻觉检测与过滤"],
        },
        {
          title: "分析与总结",
          description: "Gap Analysis 发现缺失事件和因果关联。Synthesizer 生成最终叙事总结并交叉验证日期。",
          details: ["空白检测与自动补充", "因果关系图谱", "日期交叉校验"],
        },
      ],
    },
    features: {
      heading: "\u4e3a\u6df1\u5ea6\u8c03\u7814\u800c\u751f",
      items: [
        {
          title: "\u56db\u79cd\u8c03\u7814\u6df1\u5ea6",
          description:
            "\u4ece 2 \u5206\u949f\u5feb\u901f\u6982\u89c8\u5230 15 \u5206\u949f\u6df1\u5ea6\u8c03\u7814\uff0880+ \u8282\u70b9\uff09\uff0c\u6309\u9700\u9009\u62e9\u8c03\u7814\u6df1\u5ea6\u3002",
        },
        {
          title: "\u5173\u8054\u53d1\u73b0\u4e0e\u667a\u80fd\u603b\u7ed3",
          description:
            "AI \u81ea\u52a8\u8bc6\u522b\u4e8b\u4ef6\u95f4\u7684\u56e0\u679c\u5173\u7cfb \u2014 \u4ec0\u4e48\u5f15\u53d1\u4e86\u4ec0\u4e48\uff0c\u4ec0\u4e48\u542f\u53d1\u4e86\u4ec0\u4e48\u3002\u6700\u7ec8\u603b\u7ed3\u63d0\u70bc\u6838\u5fc3\u6d1e\u5bdf\u3002",
        },
        {
          title: "\u591a\u8bed\u8a00\u652f\u6301",
          description:
            "\u652f\u6301\u4e2d\u6587\u3001\u82f1\u6587\u53ca\u66f4\u591a\u8bed\u8a00\u3002\u7cfb\u7edf\u81ea\u52a8\u68c0\u6d4b\u8f93\u5165\u8bed\u8a00\u5e76\u4ee5\u5bf9\u5e94\u8bed\u8a00\u8f93\u51fa\u3002",
        },
      ],
    },
    footer: {
      heading: "\u51c6\u5907\u597d\u4e86\u5417\uff1f",
      cta: "\u5f00\u59cb\u4f7f\u7528 \u2192",
      copyright: "Chrono \u00b7 \u7531 AI \u667a\u80fd\u4f53\u9a71\u52a8",
    },
    demo: {
      skip: "\u8df3\u8fc7",
      subtitle:
        "\u8f93\u5165\u4efb\u610f\u4e3b\u9898\uff0cAI \u81ea\u52a8\u8c03\u7814\u5176\u65f6\u95f4\u7ebf\u3002",
      researchDimensions: "\u8c03\u7814\u7ef4\u5ea6",
      synthesis: "\u8c03\u7814\u603b\u7ed3",
    },
    app: {
      title: "Chrono",
      subtitle: "\u8f93\u5165\u4efb\u610f\u4e3b\u9898\uff0cAI \u81ea\u52a8\u8c03\u7814\u5176\u65f6\u95f4\u7ebf\u3002",
      placeholder: "iPhone\u3001\u6bd4\u7279\u5e01\u3001\u4e8c\u6218...",
      research: "\u5f00\u59cb\u8c03\u7814",
      analyzing: "\u5206\u6790\u4e2d...",
      recent: "\u6700\u8fd1\u7684\u8c03\u7814",
      ago: "\u524d",
      nodes: "\u4e2a\u8282\u70b9",
      explore: "探索主题",
      noHistory: "暂无调研记录",
      viewAll: "查看全部",
      researchDimensions: "调研维度",
      startResearch: "开始调研",
      cancel: "取消",
      groupTech: "产品与技术",
      groupHistory: "\u5386\u53f2\u4e0e\u6587\u5316",
    },
  },
};
