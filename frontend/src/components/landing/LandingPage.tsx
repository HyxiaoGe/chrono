"use client";

import { useLocale } from "@/data/landing";
import { Navbar } from "@/components/Navbar";
import { Hero } from "./Hero";
import { ExploreTopics } from "./ExploreTopics";
import { HowItWorks } from "./HowItWorks";
import { RecentResearches } from "./RecentResearches";
import { FooterCTA } from "./FooterCTA";
import { Footer } from "./Footer";

export function LandingPage() {
  const [locale, toggleLocale] = useLocale();

  return (
    <div className="min-h-screen bg-chrono-bg">
      <Navbar locale={locale} onToggleLocale={toggleLocale} mode="landing" />
      <Hero locale={locale} />
      <ExploreTopics locale={locale} />
      <HowItWorks locale={locale} />
      <RecentResearches locale={locale} />
      <FooterCTA locale={locale} />
      <Footer locale={locale} />
    </div>
  );
}
