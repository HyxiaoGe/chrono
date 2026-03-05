"use client";

import dynamic from "next/dynamic";

const SearchHome = dynamic(
  () => import("@/components/SearchHome").then((m) => m.SearchHome),
  { ssr: false },
);

export default function AppPage() {
  return <SearchHome />;
}
