import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";
import { ScrollReveal } from "./ScrollReveal";

interface Props {
  locale: Locale;
}

export function HowItWorks({ locale }: Props) {
  const t = messages[locale].howItWorks;

  return (
    <section className="py-24 sm:py-32 px-4">
      <div className="mx-auto max-w-5xl">
        <ScrollReveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-chrono-text text-center">
            {t.heading}
          </h2>
        </ScrollReveal>
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-12 relative">
          {/* Connector line between steps */}
          <div className="hidden sm:block absolute top-8 left-[16.67%] right-[16.67%] border-t border-dashed border-chrono-border" />

          {t.steps.map((step, i) => (
            <ScrollReveal key={i}>
              <div className="relative text-center">
                <div className="text-4xl font-bold text-chrono-accent/30 mb-4">
                  0{i + 1}
                </div>
                <h3 className="text-chrono-subtitle font-semibold text-chrono-text mb-2">
                  {step.title}
                </h3>
                <p className="text-chrono-caption text-chrono-text-secondary">
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
