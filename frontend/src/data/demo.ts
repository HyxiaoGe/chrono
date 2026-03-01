import type {
  ResearchProposal,
  SkeletonNodeData,
  NodeDetailData,
  SynthesisData,
} from "@/types";
import type { Locale } from "@/data/landing";

export interface DemoData {
  proposal: ResearchProposal;
  nodes: SkeletonNodeData[];
  details: Record<string, NodeDetailData>;
  synthesis: SynthesisData;
}

export const demoData: Record<Locale, DemoData> = {
  en: {
    proposal: {
      topic: "iPhone",
      topic_type: "product",
      language: "en",
      complexity: {
        level: "light",
        time_span: "2007 \u2013 2024",
        parallel_threads: 1,
        estimated_total_nodes: 8,
        reasoning: "Well-documented consumer product with clear milestones",
      },
      research_threads: [
        {
          name: "Product Launches",
          description: "Major iPhone releases",
          priority: 5,
          estimated_nodes: 4,
        },
        {
          name: "Technology Innovation",
          description: "Key technology introductions",
          priority: 4,
          estimated_nodes: 3,
        },
        {
          name: "Market Impact",
          description: "Industry-shifting moments",
          priority: 3,
          estimated_nodes: 1,
        },
      ],
      estimated_duration: { min_seconds: 60, max_seconds: 120 },
      credits_cost: 1,
      user_facing: {
        title: "iPhone",
        summary:
          "From the revolutionary 2007 unveiling to today\u2019s AI-powered devices \u2014 a complete timeline.",
        duration_text: "~2 min",
        credits_text: "1 credit",
        thread_names: [
          "Product Launches",
          "Technology Innovation",
          "Market Impact",
        ],
      },
    },

    nodes: [
      {
        id: "ms_001",
        date: "2007-01-09",
        title: "iPhone Announcement",
        subtitle: "Macworld 2007",
        significance: "revolutionary",
        description:
          "Steve Jobs unveiled the first iPhone at Macworld, combining a phone, widescreen iPod, and internet communicator into one device.",
        sources: [],
        status: "skeleton",
        phase_name: "Product Launches",
      },
      {
        id: "ms_002",
        date: "2007-06-29",
        title: "iPhone Launch",
        subtitle: "US market release",
        significance: "high",
        description:
          "The original iPhone went on sale at $499, with customers lining up for days.",
        sources: [],
        status: "skeleton",
        phase_name: "Product Launches",
      },
      {
        id: "ms_003",
        date: "2008-07-11",
        title: "App Store Launch",
        subtitle: "Third-party app ecosystem",
        significance: "revolutionary",
        description:
          "Apple opened the App Store with 500 apps, creating the mobile app economy.",
        sources: [],
        status: "skeleton",
        phase_name: "Technology Innovation",
      },
      {
        id: "ms_004",
        date: "2010-06-07",
        title: "iPhone 4 & Retina Display",
        subtitle: "New industrial design",
        significance: "high",
        description:
          "Introduced the Retina Display and a glass-and-steel industrial design that set the standard.",
        sources: [],
        status: "skeleton",
        phase_name: "Technology Innovation",
      },
      {
        id: "ms_005",
        date: "2013-09-10",
        title: "Touch ID & iPhone 5s",
        subtitle: "Biometric authentication",
        significance: "high",
        description:
          "First fingerprint sensor in a mainstream smartphone, enabling secure mobile payments.",
        sources: [],
        status: "skeleton",
        phase_name: "Technology Innovation",
      },
      {
        id: "ms_006",
        date: "2017-09-12",
        title: "iPhone X & Face ID",
        subtitle: "Edge-to-edge display era",
        significance: "revolutionary",
        description:
          "Removed the home button and introduced Face ID and an edge-to-edge OLED display.",
        sources: [],
        status: "skeleton",
        phase_name: "Product Launches",
      },
      {
        id: "ms_007",
        date: "2020-10-13",
        title: "iPhone 12 & 5G",
        subtitle: "5G connectivity",
        significance: "high",
        description:
          "Apple\u2019s first 5G-capable iPhone lineup, with a flat-edge design reminiscent of iPhone 4.",
        sources: [],
        status: "skeleton",
        phase_name: "Market Impact",
      },
      {
        id: "ms_008",
        date: "2024-09-09",
        title: "iPhone 16 & Apple Intelligence",
        subtitle: "On-device AI",
        significance: "medium",
        description:
          "Integrated on-device AI features across the iPhone lineup.",
        sources: [],
        status: "skeleton",
        phase_name: "Technology Innovation",
      },
    ],

    details: {
      ms_001: {
        key_features: [
          "Multi-touch interface",
          "Visual voicemail",
          "Mobile Safari",
        ],
        impact:
          "Redefined the smartphone category and forced competitors to abandon physical keyboards.",
        key_people: ["Steve Jobs", "Scott Forstall", "Tony Fadell"],
        context:
          "RIM\u2019s BlackBerry and Nokia\u2019s Symbian dominated the market at the time.",
        sources: ["https://apple.com"],
      },
      ms_002: {
        key_features: ["2MP camera", "4GB/8GB storage", "EDGE network"],
        impact:
          "Sold 270,000 units in the first 30 hours despite the premium price.",
        key_people: ["Steve Jobs"],
        context: "Exclusive carrier deal with AT&T (Cingular) in the US.",
        sources: ["https://apple.com"],
      },
      ms_003: {
        key_features: [
          "500 launch apps",
          "70/30 revenue split",
          "SDK for developers",
        ],
        impact:
          "Created an entirely new software economy worth hundreds of billions.",
        key_people: ["Steve Jobs", "Scott Forstall"],
        context:
          "Initially Apple resisted third-party apps, favoring web apps.",
        sources: ["https://apple.com"],
      },
      ms_004: {
        key_features: [
          "Retina Display (326 ppi)",
          "A4 chip",
          "Stainless steel frame",
        ],
        impact: "Set a new standard for display quality on mobile devices.",
        key_people: ["Steve Jobs", "Jony Ive"],
        context:
          "The \u2018Antennagate\u2019 controversy briefly overshadowed the launch.",
        sources: ["https://apple.com"],
      },
      ms_005: {
        key_features: [
          "Touch ID sensor",
          "A7 64-bit chip",
          "M7 motion coprocessor",
        ],
        impact:
          "Brought biometric security to the mainstream, later enabling Apple Pay.",
        key_people: ["Tim Cook", "Phil Schiller"],
        context:
          "Apple acquired AuthenTec in 2012 specifically for fingerprint technology.",
        sources: ["https://apple.com"],
      },
      ms_006: {
        key_features: ["Face ID", "OLED Super Retina display", "Animoji"],
        impact:
          "Eliminated the home button paradigm that defined smartphones for a decade.",
        key_people: ["Tim Cook", "Jony Ive", "Craig Federighi"],
        context:
          "Released alongside iPhone 8/8 Plus as Apple\u2019s \u201810th anniversary\u2019 device.",
        sources: ["https://apple.com"],
      },
      ms_007: {
        key_features: [
          "5G connectivity",
          "A14 Bionic",
          "Ceramic Shield",
          "MagSafe",
        ],
        impact:
          "Accelerated global 5G adoption as millions of iPhone users upgraded.",
        key_people: ["Tim Cook"],
        context:
          "Launched during the COVID-19 pandemic, later than usual (October vs September).",
        sources: ["https://apple.com"],
      },
      ms_008: {
        key_features: [
          "Apple Intelligence",
          "Camera Control button",
          "A18 chip",
        ],
        impact:
          "Positioned the iPhone as an AI-first device with on-device processing.",
        key_people: ["Tim Cook", "Craig Federighi"],
        context:
          "Apple\u2019s response to the generative AI wave led by ChatGPT and Google Gemini.",
        sources: ["https://apple.com"],
      },
    },

    synthesis: {
      summary:
        "The iPhone transformed from a revolutionary smartphone into a platform that redefined mobile computing, app ecosystems, and digital interaction.",
      key_insight:
        "Each major iPhone generation didn\u2019t just improve hardware \u2014 it created entirely new categories of user behavior.",
      timeline_span: "2007 \u2013 2024",
      source_count: 48,
      verification_notes: [],
    },
  },

  zh: {
    proposal: {
      topic: "iPhone",
      topic_type: "product",
      language: "zh",
      complexity: {
        level: "light",
        time_span: "2007 \u2013 2024",
        parallel_threads: 1,
        estimated_total_nodes: 8,
        reasoning: "\u6587\u732e\u8bb0\u5f55\u5b8c\u5584\u7684\u6d88\u8d39\u7535\u5b50\u4ea7\u54c1\uff0c\u91cc\u7a0b\u7891\u6e05\u6670",
      },
      research_threads: [
        {
          name: "\u4ea7\u54c1\u53d1\u5e03",
          description: "\u91cd\u8981 iPhone \u53d1\u5e03\u8282\u70b9",
          priority: 5,
          estimated_nodes: 4,
        },
        {
          name: "\u6280\u672f\u521b\u65b0",
          description: "\u5173\u952e\u6280\u672f\u5f15\u5165",
          priority: 4,
          estimated_nodes: 3,
        },
        {
          name: "\u5e02\u573a\u5f71\u54cd",
          description: "\u884c\u4e1a\u53d8\u9769\u65f6\u523b",
          priority: 3,
          estimated_nodes: 1,
        },
      ],
      estimated_duration: { min_seconds: 60, max_seconds: 120 },
      credits_cost: 1,
      user_facing: {
        title: "iPhone",
        summary:
          "\u4ece 2007 \u5e74\u9769\u547d\u6027\u53d1\u5e03\u5230\u4eca\u5929\u7684 AI \u667a\u80fd\u8bbe\u5907 \u2014 \u4e00\u6761\u5b8c\u6574\u7684\u65f6\u95f4\u7ebf\u3002",
        duration_text: "~2 \u5206\u949f",
        credits_text: "1 \u79ef\u5206",
        thread_names: ["\u4ea7\u54c1\u53d1\u5e03", "\u6280\u672f\u521b\u65b0", "\u5e02\u573a\u5f71\u54cd"],
      },
    },

    nodes: [
      {
        id: "ms_001",
        date: "2007-01-09",
        title: "iPhone \u53d1\u5e03\u4f1a",
        subtitle: "Macworld 2007",
        significance: "revolutionary",
        description:
          "\u53f2\u8482\u592b\u00b7\u4e54\u5e03\u65af\u5728 Macworld 2007 \u4e0a\u53d1\u5e03\u9996\u6b3e iPhone\uff0c\u96c6\u624b\u673a\u3001\u5bbd\u5c4f iPod \u548c\u4e92\u8054\u7f51\u901a\u4fe1\u5668\u4e8e\u4e00\u4f53\u3002",
        sources: [],
        status: "skeleton",
        phase_name: "\u4ea7\u54c1\u53d1\u5e03",
      },
      {
        id: "ms_002",
        date: "2007-06-29",
        title: "iPhone \u6b63\u5f0f\u5f00\u552e",
        subtitle: "\u7f8e\u56fd\u5e02\u573a\u53d1\u552e",
        significance: "high",
        description:
          "\u521d\u4ee3 iPhone \u4ee5 499 \u7f8e\u5143\u6b63\u5f0f\u53d1\u552e\uff0c\u6d88\u8d39\u8005\u6392\u961f\u6570\u65e5\u62a2\u8d2d\u3002",
        sources: [],
        status: "skeleton",
        phase_name: "\u4ea7\u54c1\u53d1\u5e03",
      },
      {
        id: "ms_003",
        date: "2008-07-11",
        title: "App Store \u4e0a\u7ebf",
        subtitle: "\u7b2c\u4e09\u65b9\u5e94\u7528\u751f\u6001",
        significance: "revolutionary",
        description:
          "\u82f9\u679c\u5f00\u653e App Store\uff0c\u9996\u6279\u4e0a\u7ebf 500 \u6b3e\u5e94\u7528\uff0c\u5f00\u521b\u79fb\u52a8\u5e94\u7528\u7ecf\u6d4e\u3002",
        sources: [],
        status: "skeleton",
        phase_name: "\u6280\u672f\u521b\u65b0",
      },
      {
        id: "ms_004",
        date: "2010-06-07",
        title: "iPhone 4 \u4e0e Retina \u5c4f\u5e55",
        subtitle: "\u5168\u65b0\u5de5\u4e1a\u8bbe\u8ba1",
        significance: "high",
        description:
          "\u5f15\u5165 Retina \u663e\u793a\u5c4f\u548c\u73bb\u7483 + \u4e0d\u9508\u94a2\u5168\u65b0\u5de5\u4e1a\u8bbe\u8ba1\u3002",
        sources: [],
        status: "skeleton",
        phase_name: "\u6280\u672f\u521b\u65b0",
      },
      {
        id: "ms_005",
        date: "2013-09-10",
        title: "Touch ID \u4e0e iPhone 5s",
        subtitle: "\u751f\u7269\u8bc6\u522b\u8ba4\u8bc1",
        significance: "high",
        description:
          "\u9996\u6b3e\u642d\u8f7d\u6307\u7eb9\u8bc6\u522b\u7684\u4e3b\u6d41\u667a\u80fd\u624b\u673a\uff0c\u4e3a\u79fb\u52a8\u652f\u4ed8\u94fa\u8def\u3002",
        sources: [],
        status: "skeleton",
        phase_name: "\u6280\u672f\u521b\u65b0",
      },
      {
        id: "ms_006",
        date: "2017-09-12",
        title: "iPhone X \u4e0e Face ID",
        subtitle: "\u5168\u9762\u5c4f\u65f6\u4ee3",
        significance: "revolutionary",
        description:
          "\u53d6\u6d88 Home \u952e\uff0c\u5f15\u5165 Face ID \u548c\u5168\u9762\u5c4f OLED \u8bbe\u8ba1\u3002",
        sources: [],
        status: "skeleton",
        phase_name: "\u4ea7\u54c1\u53d1\u5e03",
      },
      {
        id: "ms_007",
        date: "2020-10-13",
        title: "iPhone 12 \u4e0e 5G",
        subtitle: "5G \u8fde\u63a5",
        significance: "high",
        description:
          "\u82f9\u679c\u9996\u6b3e 5G iPhone \u7cfb\u5217\uff0c\u56de\u5f52 iPhone 4 \u5f0f\u76f4\u89d2\u8fb9\u6846\u8bbe\u8ba1\u3002",
        sources: [],
        status: "skeleton",
        phase_name: "\u5e02\u573a\u5f71\u54cd",
      },
      {
        id: "ms_008",
        date: "2024-09-09",
        title: "iPhone 16 \u4e0e Apple Intelligence",
        subtitle: "\u7aef\u4fa7 AI",
        significance: "medium",
        description:
          "\u5168\u7cfb\u642d\u8f7d\u7aef\u4fa7 AI \u529f\u80fd\u3002",
        sources: [],
        status: "skeleton",
        phase_name: "\u6280\u672f\u521b\u65b0",
      },
    ],

    details: {
      ms_001: {
        key_features: ["\u591a\u70b9\u89e6\u63a7\u754c\u9762", "\u53ef\u89c6\u8bed\u97f3\u4fe1\u7bb1", "Mobile Safari"],
        impact:
          "\u91cd\u65b0\u5b9a\u4e49\u4e86\u667a\u80fd\u624b\u673a\u54c1\u7c7b\uff0c\u8feb\u4f7f\u7ade\u4e89\u5bf9\u624b\u653e\u5f03\u5b9e\u4f53\u952e\u76d8\u3002",
        key_people: ["Steve Jobs", "Scott Forstall", "Tony Fadell"],
        context:
          "\u5f53\u65f6 RIM \u7684 BlackBerry \u548c\u8bfa\u57fa\u4e9a\u7684 Symbian \u4e3b\u5bfc\u5e02\u573a\u3002",
        sources: ["https://apple.com"],
      },
      ms_002: {
        key_features: ["200 \u4e07\u50cf\u7d20\u6444\u50cf\u5934", "4GB/8GB \u5b58\u50a8", "EDGE \u7f51\u7edc"],
        impact: "\u5c3d\u7ba1\u4ef7\u683c\u4e0d\u83f2\uff0c\u524d 30 \u5c0f\u65f6\u5373\u552e\u51fa 27 \u4e07\u53f0\u3002",
        key_people: ["Steve Jobs"],
        context: "\u4e0e AT&T (Cingular) \u7684\u7f8e\u56fd\u72ec\u5bb6\u8fd0\u8425\u5546\u534f\u8bae\u3002",
        sources: ["https://apple.com"],
      },
      ms_003: {
        key_features: ["\u9996\u6279 500 \u6b3e\u5e94\u7528", "70/30 \u6536\u5165\u5206\u6210", "\u5f00\u53d1\u8005 SDK"],
        impact: "\u521b\u9020\u4e86\u4e00\u4e2a\u4ef7\u503c\u6570\u5343\u4ebf\u7f8e\u5143\u7684\u5168\u65b0\u8f6f\u4ef6\u7ecf\u6d4e\u3002",
        key_people: ["Steve Jobs", "Scott Forstall"],
        context: "\u6700\u521d\u82f9\u679c\u62d2\u7edd\u7b2c\u4e09\u65b9\u5e94\u7528\uff0c\u503e\u5411\u4e8e Web \u5e94\u7528\u3002",
        sources: ["https://apple.com"],
      },
      ms_004: {
        key_features: ["Retina \u663e\u793a\u5c4f (326 ppi)", "A4 \u82af\u7247", "\u4e0d\u9508\u94a2\u8fb9\u6846"],
        impact: "\u4e3a\u79fb\u52a8\u8bbe\u5907\u663e\u793a\u8d28\u91cf\u6811\u7acb\u4e86\u65b0\u6807\u6746\u3002",
        key_people: ["Steve Jobs", "Jony Ive"],
        context: "\u201c\u5929\u7ebf\u95e8\u201d\u4e89\u8bae\u4e00\u5ea6\u7ed9\u53d1\u5e03\u4f1a\u8499\u4e0a\u9634\u5f71\u3002",
        sources: ["https://apple.com"],
      },
      ms_005: {
        key_features: ["Touch ID \u4f20\u611f\u5668", "A7 64 \u4f4d\u82af\u7247", "M7 \u534f\u5904\u7406\u5668"],
        impact: "\u5c06\u751f\u7269\u8bc6\u522b\u5b89\u5168\u5e26\u5165\u4e3b\u6d41\uff0c\u4e3a Apple Pay \u94fa\u5e73\u9053\u8def\u3002",
        key_people: ["Tim Cook", "Phil Schiller"],
        context: "\u82f9\u679c\u4e8e 2012 \u5e74\u6536\u8d2d AuthenTec\uff0c\u4e13\u95e8\u83b7\u53d6\u6307\u7eb9\u6280\u672f\u3002",
        sources: ["https://apple.com"],
      },
      ms_006: {
        key_features: ["Face ID", "OLED Super Retina \u663e\u793a\u5c4f", "Animoji"],
        impact: "\u7ec8\u7ed3\u4e86\u5b9a\u4e49\u667a\u80fd\u624b\u673a\u5341\u5e74\u7684 Home \u952e\u8303\u5f0f\u3002",
        key_people: ["Tim Cook", "Jony Ive", "Craig Federighi"],
        context: "\u4e0e iPhone 8/8 Plus \u540c\u671f\u53d1\u5e03\uff0c\u4f5c\u4e3a\u82f9\u679c\u201c\u5341\u5468\u5e74\u201d\u7eaa\u5ff5\u8bbe\u5907\u3002",
        sources: ["https://apple.com"],
      },
      ms_007: {
        key_features: ["5G \u8fde\u63a5", "A14 Bionic", "Ceramic Shield", "MagSafe"],
        impact: "\u968f\u7740\u6570\u767e\u4e07 iPhone \u7528\u6237\u5347\u7ea7\uff0c\u52a0\u901f\u4e86\u5168\u7403 5G \u666e\u53ca\u3002",
        key_people: ["Tim Cook"],
        context:
          "\u5728\u65b0\u51a0\u75ab\u60c5\u671f\u95f4\u53d1\u5e03\uff0c\u6bd4\u5f80\u5e74\u665a\u4e00\u4e2a\u6708\uff0810\u6708 vs 9\u6708\uff09\u3002",
        sources: ["https://apple.com"],
      },
      ms_008: {
        key_features: ["Apple Intelligence", "\u76f8\u673a\u63a7\u5236\u6309\u94ae", "A18 \u82af\u7247"],
        impact: "\u5c06 iPhone \u5b9a\u4f4d\u4e3a AI \u4f18\u5148\u7684\u8bbe\u5907\uff0c\u4e3b\u6253\u7aef\u4fa7\u5904\u7406\u3002",
        key_people: ["Tim Cook", "Craig Federighi"],
        context:
          "\u82f9\u679c\u5bf9 ChatGPT \u548c Google Gemini \u5f15\u9886\u7684\u751f\u6210\u5f0f AI \u6d6a\u6f6e\u7684\u56de\u5e94\u3002",
        sources: ["https://apple.com"],
      },
    },

    synthesis: {
      summary:
        "iPhone \u4ece\u4e00\u6b3e\u9769\u547d\u6027\u667a\u80fd\u624b\u673a\u6f14\u53d8\u4e3a\u91cd\u65b0\u5b9a\u4e49\u79fb\u52a8\u8ba1\u7b97\u3001\u5e94\u7528\u751f\u6001\u548c\u6570\u5b57\u4ea4\u4e92\u7684\u5e73\u53f0\u3002",
      key_insight:
        "\u6bcf\u4e00\u4ee3\u91cd\u8981 iPhone \u4e0d\u4ec5\u4ec5\u662f\u786c\u4ef6\u5347\u7ea7 \u2014 \u5b83\u521b\u9020\u4e86\u5168\u65b0\u7684\u7528\u6237\u884c\u4e3a\u54c1\u7c7b\u3002",
      timeline_span: "2007 \u2013 2024",
      source_count: 48,
      verification_notes: [],
    },
  },
};
