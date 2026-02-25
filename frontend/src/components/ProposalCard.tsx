"use client";

import type { ResearchProposal } from "@/types";

interface Props {
  proposal: ResearchProposal;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ProposalCard({ proposal, onConfirm, onCancel }: Props) {
  const { user_facing, complexity } = proposal;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="animate-slide-up w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8">
        <h2 className="text-2xl font-bold">{user_facing.title}</h2>
        <p className="mt-2 text-zinc-400">{user_facing.summary}</p>

        <div className="mt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Research Dimensions
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {user_facing.thread_names.map((name) => (
              <span
                key={name}
                className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-300"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-6 text-sm text-zinc-500">
          <span>{user_facing.duration_text}</span>
          <span>{user_facing.credits_text}</span>
          <span>~{complexity.estimated_total_nodes} nodes</span>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-zinc-100 py-3 font-medium text-zinc-900
                       hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Start Research
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 px-6 py-3 text-zinc-400
                       hover:border-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
