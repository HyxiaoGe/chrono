import { Search, Layers, Microscope, Sparkles } from "lucide-react";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";
import { ScrollReveal } from "./ScrollReveal";

interface Props {
  locale: Locale;
}

const stepIcons = [Search, Layers, Microscope, Sparkles];

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
        <div className="relative mt-16">
          {/* Vertical connector line */}
          <div className="absolute left-6 sm:left-1/2 top-0 bottom-0 w-px bg-chrono-border/50 sm:-translate-x-px" />

          <div className="space-y-12 sm:space-y-16">
            {t.steps.map((step, i) => {
              const Icon = stepIcons[i];
              const isLeft = i % 2 === 0;
              return (
                <ScrollReveal key={i}>
                  <div className="relative flex items-start gap-6 sm:gap-0">
                    {/* Step number dot on the line */}
                    <div className="absolute left-6 sm:left-1/2 -translate-x-1/2 flex size-12 items-center justify-center rounded-full border border-chrono-accent/30 bg-chrono-bg z-10">
                      <Icon size={20} className="text-chrono-accent" />
                    </div>

                    {/* Card — alternating sides on desktop, all right on mobile */}
                    <div className={`ml-16 sm:ml-0 sm:w-[calc(50%-2rem)] ${isLeft ? "sm:mr-auto sm:pr-4" : "sm:ml-auto sm:pl-4"}`}>
                      <div className="rounded-xl border border-chrono-border/50 bg-chrono-surface/30 p-5 transition-colors hover:border-chrono-border hover:bg-chrono-surface/50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-chrono-tiny font-bold text-chrono-accent/50">
                            0{i + 1}
                          </span>
                          <h3 className="text-chrono-body font-semibold text-chrono-text">
                            {step.title}
                          </h3>
                        </div>
                        <p className="text-chrono-caption text-chrono-text-secondary">
                          {step.description}
                        </p>
                        <ul className="mt-3 space-y-1.5">
                          {step.details.map((detail, j) => (
                            <li key={j} className="flex items-center gap-2 text-chrono-tiny text-chrono-text-muted">
                              <span className="h-1 w-1 shrink-0 rounded-full bg-chrono-accent/50" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
