"use client";

import { useState } from "react";
import type { Locale } from "@/data/landing";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Features } from "./Features";
import { FooterCTA } from "./FooterCTA";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return navigator.language.startsWith("zh") ? "zh" : "en";
}

export function LandingPage() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);

  return (
    <div className="min-h-screen bg-chrono-bg">
      <Navbar
        locale={locale}
        onToggleLocale={() => setLocale((l) => (l === "en" ? "zh" : "en"))}
      />
      <Hero locale={locale} />
      <HowItWorks locale={locale} />
      <Features locale={locale} />
      <FooterCTA locale={locale} />
    </div>
  );
}
