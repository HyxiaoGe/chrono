"use client";

import { useLocale } from "@/data/landing";
import { Navbar } from "@/components/Navbar";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Features } from "./Features";
import { FooterCTA } from "./FooterCTA";

export function LandingPage() {
  const [locale, toggleLocale] = useLocale();

  return (
    <div className="min-h-screen bg-chrono-bg">
      <Navbar locale={locale} onToggleLocale={toggleLocale} />
      <Hero locale={locale} />
      <HowItWorks locale={locale} />
      <Features locale={locale} />
      <FooterCTA locale={locale} />
    </div>
  );
}
