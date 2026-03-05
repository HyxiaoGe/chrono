"use client";

import { use } from "react";
import dynamic from "next/dynamic";

const SessionView = dynamic(
  () => import("@/components/SessionView").then((m) => m.SessionView),
  { ssr: false },
);

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SessionView sessionId={id} />;
}
