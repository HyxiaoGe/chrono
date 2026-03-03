import re
import unicodedata

_ALIASES: dict[str, str] = {
    "ww2": "world war ii",
    "wwii": "world war ii",
    "world war 2": "world war ii",
    "ww1": "world war i",
    "wwi": "world war i",
    "world war 1": "world war i",
    "二战": "第二次世界大战",
    "一战": "第一次世界大战",
}


def normalize_topic(topic: str) -> str:
    t = topic.strip().lower()
    t = unicodedata.normalize("NFKC", t)
    t = re.sub(r"\s+", " ", t)
    if t in _ALIASES:
        t = _ALIASES[t]
    return t
