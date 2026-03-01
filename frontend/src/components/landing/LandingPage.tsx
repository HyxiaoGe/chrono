"use client";

import { useState, useEffect } from "react";
import type { Locale } from "@/data/landing";
import { getLocale, persistLocale } from "@/data/landing";
import { Navbar } from "@/components/Navbar";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Features } from "./Features";
import { FooterCTA } from "./FooterCTA";

export function LandingPage() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setLocale(getLocale());
  }, []);

  function toggleLocale() {
    setLocale((l) => {
      const next = l === "en" ? "zh" : "en";
      persistLocale(next);
      return next;
    });
  }

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
