import type {
  ResearchProposal,
  SkeletonNodeData,
  NodeDetailData,
  SynthesisData,
} from "@/types";

interface DemoData {
  proposal: ResearchProposal;
  nodes: SkeletonNodeData[];
  details: Record<string, NodeDetailData>;
  synthesis: SynthesisData;
}

export const demoData: DemoData = {
  proposal: {
    topic: "iPhone",
    topic_type: "product",
    language: "en",
    complexity: {
      level: "light",
      time_span: "2007 – 2024",
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
      thread_names: ["Product Launches", "Technology Innovation", "Market Impact"],
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
      key_features: ["Multi-touch interface", "Visual voicemail", "Mobile Safari"],
      impact:
        "Redefined the smartphone category and forced competitors to abandon physical keyboards.",
      key_people: ["Steve Jobs", "Scott Forstall", "Tony Fadell"],
      context: "RIM\u2019s BlackBerry and Nokia\u2019s Symbian dominated the market at the time.",
      sources: ["https://apple.com"],
    },
    ms_002: {
      key_features: ["2MP camera", "4GB/8GB storage", "EDGE network"],
      impact: "Sold 270,000 units in the first 30 hours despite the premium price.",
      key_people: ["Steve Jobs"],
      context: "Exclusive carrier deal with AT&T (Cingular) in the US.",
      sources: ["https://apple.com"],
    },
    ms_003: {
      key_features: ["500 launch apps", "70/30 revenue split", "SDK for developers"],
      impact: "Created an entirely new software economy worth hundreds of billions.",
      key_people: ["Steve Jobs", "Scott Forstall"],
      context: "Initially Apple resisted third-party apps, favoring web apps.",
      sources: ["https://apple.com"],
    },
    ms_004: {
      key_features: ["Retina Display (326 ppi)", "A4 chip", "Stainless steel frame"],
      impact: "Set a new standard for display quality on mobile devices.",
      key_people: ["Steve Jobs", "Jony Ive"],
      context: "The \u2018Antennagate\u2019 controversy briefly overshadowed the launch.",
      sources: ["https://apple.com"],
    },
    ms_005: {
      key_features: ["Touch ID sensor", "A7 64-bit chip", "M7 motion coprocessor"],
      impact: "Brought biometric security to the mainstream, later enabling Apple Pay.",
      key_people: ["Tim Cook", "Phil Schiller"],
      context: "Apple acquired AuthenTec in 2012 specifically for fingerprint technology.",
      sources: ["https://apple.com"],
    },
    ms_006: {
      key_features: ["Face ID", "OLED Super Retina display", "Animoji"],
      impact: "Eliminated the home button paradigm that defined smartphones for a decade.",
      key_people: ["Tim Cook", "Jony Ive", "Craig Federighi"],
      context: "Released alongside iPhone 8/8 Plus as Apple\u2019s \u201810th anniversary\u2019 device.",
      sources: ["https://apple.com"],
    },
    ms_007: {
      key_features: ["5G connectivity", "A14 Bionic", "Ceramic Shield", "MagSafe"],
      impact: "Accelerated global 5G adoption as millions of iPhone users upgraded.",
      key_people: ["Tim Cook"],
      context:
        "Launched during the COVID-19 pandemic, later than usual (October vs September).",
      sources: ["https://apple.com"],
    },
    ms_008: {
      key_features: ["Apple Intelligence", "Camera Control button", "A18 chip"],
      impact: "Positioned the iPhone as an AI-first device with on-device processing.",
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
};
