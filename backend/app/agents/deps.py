from dataclasses import dataclass

from app.services.tavily import TavilyService


@dataclass
class AgentDeps:
    tavily: TavilyService
    topic: str
    language: str
