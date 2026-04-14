from __future__ import annotations

PROGRESS_MESSAGES: dict[str, dict[str, str]] = {
    "skeleton": {
        "zh": "正在构建时间线骨架...",
        "en": "Building timeline skeleton...",
        "ja": "タイムラインの骨格を構築中...",
    },
    "detail": {
        "zh": "正在深度补充节点详情...",
        "en": "Enriching timeline details...",
        "ja": "タイムラインの詳細を補充中...",
    },
    "analysis": {
        "zh": "正在分析时间线完整性...",
        "en": "Analyzing timeline completeness...",
        "ja": "タイムラインの完全性を分析中...",
    },
    "analysis_hallucination": {
        "zh": "正在验证事实准确性...",
        "en": "Verifying factual accuracy...",
        "ja": "事実の正確性を検証中...",
    },
    "analysis_gap": {
        "zh": "正在检测遗漏事件...",
        "en": "Detecting missing events...",
        "ja": "欠落イベントを検出中...",
    },
    "analysis_gap_found": {
        "zh": "发现 {count} 个遗漏事件，补充中...",
        "en": "Found {count} missing events, enriching...",
        "ja": "{count} 件の欠落イベントを発見、補充中...",
    },
    "synthesis": {
        "zh": "正在生成调研总结...",
        "en": "Generating research summary...",
        "ja": "調査サマリーを生成中...",
    },
    "skeleton_thread": {
        "zh": "已发现 {count} 个事件：{thread}",
        "en": "Found {count} events: {thread}",
        "ja": "{count} 件のイベントを发見：{thread}",
    },
}


def get_progress_message(phase: str, language: str) -> str:
    messages = PROGRESS_MESSAGES.get(phase, {})
    short = language.split("-")[0].lower()
    return messages.get(short, messages.get("en", "Processing..."))
