const TAG_DISPLAY: Record<string, Record<string, string>> = {
  product_launch: { en: "Product Launch", zh: "产品发布" },
  hardware: { en: "Hardware", zh: "硬件" },
  software: { en: "Software", zh: "软件" },
  business: { en: "Business", zh: "商业" },
  policy: { en: "Policy", zh: "政策" },
  milestone: { en: "Milestone", zh: "里程碑" },
  innovation: { en: "Innovation", zh: "创新" },
  partnership: { en: "Partnership", zh: "合作" },
  acquisition: { en: "Acquisition", zh: "收购" },
  regulation: { en: "Regulation", zh: "监管" },
  cultural_shift: { en: "Cultural", zh: "文化" },
  scientific: { en: "Scientific", zh: "科学" },
  military: { en: "Military", zh: "军事" },
  diplomatic: { en: "Diplomatic", zh: "外交" },
  security: { en: "Security", zh: "安全" },
  infrastructure: { en: "Infra", zh: "基础设施" },
};

export function tagLabel(tag: string, language: string): string {
  const entry = TAG_DISPLAY[tag];
  if (!entry) {
    return tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return language.startsWith("zh") ? entry.zh : entry.en;
}
