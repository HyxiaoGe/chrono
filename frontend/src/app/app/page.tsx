"use client";

import dynamic from "next/dynamic";

const ChronoApp = dynamic(() => import("@/components/ChronoApp").then((m) => m.ChronoApp), {
  ssr: false,
});

export default function AppPage() {
  return <ChronoApp />;
}
