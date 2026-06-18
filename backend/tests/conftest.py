import os
import sys
import types
from pathlib import Path

os.environ.setdefault("TAVILY_API_KEY", "test-tavily-key")
os.environ.setdefault("LITELLM_API_KEY", "test-litellm-key")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))


class FakeServerSentEvent:
    def __init__(self, *, data: str, event: str) -> None:
        self.data = data
        self.event = event


class FakeEventSourceResponse:
    def __init__(self, generator, **kwargs) -> None:
        self.generator = generator
        self.kwargs = kwargs


fake_sse_starlette = types.ModuleType("sse_starlette")
fake_sse_starlette.ServerSentEvent = FakeServerSentEvent
fake_sse_starlette.EventSourceResponse = FakeEventSourceResponse
sys.modules.setdefault("sse_starlette", fake_sse_starlette)
