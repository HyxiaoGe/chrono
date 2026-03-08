"use client";

interface Props {
  originalTopic: string;
  similarTopic: string;
  onViewExisting: () => void;
  onNewResearch: () => void;
  isLoading: boolean;
  locale: string;
}

export function SimilarTopicCard({
  originalTopic,
  similarTopic,
  onViewExisting,
  onNewResearch,
  isLoading,
  locale,
}: Props) {
  const isZh = locale.startsWith("zh");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-chrono-border bg-chrono-surface/80 p-8">
        <h2 className="text-chrono-title font-semibold text-chrono-text">
          {isZh ? "发现相似调研" : "Similar Research Found"}
        </h2>
        <p className="mt-3 text-chrono-body text-chrono-text-secondary">
          {isZh ? (
            <>
              你搜索的「{originalTopic}」与已有调研「
              <span className="font-medium text-chrono-text">{similarTopic}</span>
              」内容相似，可以直接查看已有结果。
            </>
          ) : (
            <>
              Your search &quot;{originalTopic}&quot; is similar to existing research &quot;
              <span className="font-medium text-chrono-text">{similarTopic}</span>
              &quot;. You can view the existing results instantly.
            </>
          )}
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onViewExisting}
            disabled={isLoading}
            className="flex-1 cursor-pointer rounded-lg bg-chrono-accent px-4 py-3 text-chrono-body font-medium text-white transition-colors hover:bg-chrono-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isZh ? "查看已有调研" : "View Existing"}
          </button>
          <button
            onClick={onNewResearch}
            disabled={isLoading}
            className="cursor-pointer rounded-lg border border-chrono-border px-4 py-3 text-chrono-body text-chrono-text-muted transition-colors hover:bg-chrono-surface-hover hover:text-chrono-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isZh ? "重新调研" : "New Research"}
          </button>
        </div>
      </div>
    </div>
  );
}
