# Pydantic AI Research

## Overview

Pydantic AI is a Python agent framework built by the Pydantic team, designed for production-grade generative AI applications. It follows FastAPI's ergonomic design philosophy. Key traits:

- Model-agnostic: supports 20+ providers including OpenAI, Anthropic, Google, Groq, **and OpenRouter natively**
- Type-safe with full IDE support and static type checking
- Built-in dependency injection system
- Structured output via Pydantic models
- Streaming support for both text and structured data

Install: `pip install pydantic-ai` or `uv add pydantic-ai`

---

## 1. Agent Definition

### Basic Agent

```python
from pydantic_ai import Agent

agent = Agent('openai:gpt-4o')
result = agent.run_sync('What is the capital of France?')
print(result.output)  # "Paris"
```

### Agent Constructor Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `str \| Model` | LLM model, format `"provider:model_name"` (e.g. `"openrouter:anthropic/claude-sonnet-4-5"`) |
| `output_type` | type | Structured output type. Default `str`. Can be Pydantic model, TypedDict, dataclass, or union |
| `deps_type` | type | Dependency injection type. Passed as `deps=` at runtime |
| `instructions` | `str \| list[str]` | Agent behavior instructions. Excluded from message history when using conversation context |
| `system_prompt` | `str \| list[str]` | System prompt. Preserved in message history for multi-agent scenarios |
| `tools` | `list` | Function tools to register |
| `model_settings` | `ModelSettings` | Temperature, max_tokens, timeout, etc. |
| `retries` | `int` | Default retry count (default: 1) |
| `end_strategy` | `str` | `'early'` (stop at first output match) or `'exhaustive'` (run all tool calls) |
| `max_concurrency` | `int` | Limit parallel runs |
| `toolsets` | `list` | Toolset functions or MCP servers |

### Full Constructor Example

```python
from pydantic_ai import Agent, RunContext, ModelSettings
from dataclasses import dataclass
from datetime import date

@dataclass
class ResearchDeps:
    api_key: str
    search_client: object

agent = Agent(
    'openrouter:deepseek/deepseek-chat',
    deps_type=ResearchDeps,
    output_type=list[str],
    instructions="You are a research assistant.",
    model_settings=ModelSettings(temperature=0.3, max_tokens=4096),
    retries=2,
    end_strategy='early',
)
```

### Dynamic System Prompts

System prompts can be dynamic functions, with or without dependencies:

```python
@agent.system_prompt
def add_date() -> str:
    return f"Today is {date.today()}"

@agent.system_prompt
async def add_context(ctx: RunContext[ResearchDeps]) -> str:
    return f"API key available: {bool(ctx.deps.api_key)}"
```

### Key Design Principle

> "Agents are designed for reuse, like FastAPI Apps. You can instantiate one agent and use it globally throughout your application."

This means we define agents at module level and reuse them across requests, passing different `deps` at runtime.

---

## 2. Structured Output / output_type

### Basic Structured Output

```python
from pydantic import BaseModel
from pydantic_ai import Agent

class CityLocation(BaseModel):
    city: str
    country: str

agent = Agent('openai:gpt-4o', output_type=CityLocation)
result = agent.run_sync('Where were the olympics held in 2012?')
print(result.output)  # CityLocation(city='London', country='United Kingdom')
print(type(result.output))  # <class 'CityLocation'>
```

### How It Works (Three Output Modes)

**1. Tool Output (Default)**
The Pydantic model's JSON schema is provided to the LLM as a "tool" schema. The LLM calls this special output tool with structured data. Pydantic AI validates the response.

**2. Native Output**
Uses the model's native "Structured Outputs" feature (JSON Schema response format). Wrap in `NativeOutput`:

```python
from pydantic_ai import Agent, NativeOutput

agent = Agent('openai:gpt-4o', output_type=NativeOutput(CityLocation))
```

**3. Prompted Output**
Injects JSON schema into the system prompt. Wrap in `PromptedOutput`:

```python
from pydantic_ai import Agent, PromptedOutput

agent = Agent('openai:gpt-4o', output_type=PromptedOutput(CityLocation))
```

### Union Types (Multiple Possible Outputs)

```python
from pydantic_ai import Agent, ToolOutput

class Fruit(BaseModel):
    name: str
    color: str

class Vehicle(BaseModel):
    name: str
    wheels: int

agent = Agent(
    'openai:gpt-4o',
    output_type=[
        ToolOutput(Fruit, name='return_fruit'),
        ToolOutput(Vehicle, name='return_vehicle'),
    ]
)
```

### Output Validation

Use `@agent.output_validator` for custom validation logic. Raise `ModelRetry` to ask the LLM to try again:

```python
from pydantic_ai import ModelRetry

@agent.output_validator
async def validate_output(ctx: RunContext[MyDeps], output: CityLocation) -> CityLocation:
    if output.country not in VALID_COUNTRIES:
        raise ModelRetry(f'Invalid country: {output.country}. Must be one of {VALID_COUNTRIES}')
    return output
```

### Chrono Implications

For our Milestone Agent, the output_type would be a Pydantic model like:

```python
class MilestoneResult(BaseModel):
    milestones: list[Milestone]

class Milestone(BaseModel):
    date: str
    title: str
    subtitle: str
    significance: Literal["revolutionary", "high", "medium"]
    description: str
    sources: list[str]
```

The LLM is forced to return data matching this schema. Pydantic validates it automatically. If validation fails, Pydantic AI retries up to `retries` times.

---

## 3. Tool Registration

### Three Ways to Register Tools

**Method 1: `@agent.tool` decorator (needs RunContext)**

```python
@agent.tool
async def search_web(ctx: RunContext[ResearchDeps], query: str) -> str:
    """Search the web for information about the query."""
    response = await ctx.deps.search_client.search(query)
    return response.text
```

**Method 2: `@agent.tool_plain` decorator (no RunContext)**

```python
@agent.tool_plain
def get_current_date() -> str:
    """Get the current date."""
    return str(date.today())
```

**Method 3: `tools=[]` in Agent constructor**

```python
agent = Agent(
    'openai:gpt-4o',
    tools=[search_web, get_current_date],
)

# Or with explicit Tool wrappers for fine-grained control:
from pydantic_ai import Tool

agent = Agent(
    'openai:gpt-4o',
    tools=[
        Tool(search_web, takes_ctx=True),
        Tool(get_current_date, takes_ctx=False),
    ],
)
```

### Tool Function Signatures

- First param can be `RunContext[DepsType]` for dependency access (Pydantic AI auto-detects this)
- Remaining params become the tool's JSON schema (the LLM sees these)
- Return type: anything Pydantic can serialize to JSON
- Docstring becomes the tool description sent to the LLM
- Parameter descriptions can be extracted from Google/NumPy/Sphinx style docstrings

### RunContext

```python
from pydantic_ai import RunContext

@agent.tool
async def my_tool(ctx: RunContext[MyDeps], query: str) -> str:
    # ctx.deps  -> the deps object passed at runtime
    # ctx.retry -> current retry count (int)
    # ctx.model -> the model being used
    # ctx.usage -> current token usage
    ...
```

### Tool Execution Flow

1. Agent sends prompt + tool schemas to the LLM
2. LLM decides to call a tool, returns tool name + arguments
3. Pydantic AI validates arguments, executes the tool function
4. Tool result is sent back to the LLM as a `ToolReturn`
5. LLM may call more tools or produce final output
6. Cycle repeats until LLM produces final output

### Chrono Implications

For the Milestone Agent, we'd register a Tavily search tool:

```python
milestone_agent = Agent(
    'openrouter:deepseek/deepseek-chat',
    deps_type=AgentDeps,
    output_type=MilestoneResult,
    instructions="You are a milestone research agent...",
)

@milestone_agent.tool
async def search(ctx: RunContext[AgentDeps], query: str) -> str:
    """Search the web for factual information."""
    results = await ctx.deps.tavily_client.search(query)
    return format_search_results(results)
```

---

## 4. Dependency Injection

### Defining Dependencies

Use a dataclass (or any type) to bundle runtime dependencies:

```python
from dataclasses import dataclass
import httpx

@dataclass
class AgentDeps:
    api_key: str
    http_client: httpx.AsyncClient
    tavily_client: TavilyClient
```

### Passing Dependencies at Runtime

```python
agent = Agent('openrouter:deepseek/deepseek-chat', deps_type=AgentDeps)

async def main():
    async with httpx.AsyncClient() as client:
        deps = AgentDeps(
            api_key='sk-...',
            http_client=client,
            tavily_client=TavilyClient(api_key='tvly-...'),
        )
        result = await agent.run('Research topic X', deps=deps)
```

### Accessing Dependencies in Tools

```python
@agent.tool
async def search(ctx: RunContext[AgentDeps], query: str) -> str:
    """Search the web."""
    response = await ctx.deps.http_client.get(
        'https://api.tavily.com/search',
        params={'query': query},
        headers={'Authorization': f'Bearer {ctx.deps.api_key}'},
    )
    return response.text
```

### Accessing Dependencies in System Prompts

```python
@agent.system_prompt
async def dynamic_prompt(ctx: RunContext[AgentDeps]) -> str:
    # Can use deps to build dynamic prompts
    return f"You have access to search. Current date: {date.today()}"
```

### Accessing Dependencies in Output Validators

```python
@agent.output_validator
async def validate(ctx: RunContext[AgentDeps], output: MilestoneResult) -> MilestoneResult:
    # Can use deps for validation (e.g., check against a database)
    return output
```

### Testing with Override

```python
with agent.override(deps=mock_deps):
    result = await agent.run('test query')
```

### Chrono Implications

Our deps would carry the Tavily client and any shared state:

```python
@dataclass
class AgentDeps:
    tavily_client: TavilyClient
    openrouter_model: str  # model string, for dynamic routing
    language: str  # user's language for search strategy
    search_budget: int  # remaining search calls allowed
```

---

## 5. Model Configuration & OpenRouter

### OpenRouter is Natively Supported

Pydantic AI has **first-class OpenRouter support**. No need for OpenAI-compatible workarounds.

Install:
```bash
pip install "pydantic-ai-slim[openrouter]"
# or
uv add "pydantic-ai-slim[openrouter]"
```

### Environment Variable

```bash
export OPENROUTER_API_KEY=your-key-here
```

### Model String Format

```python
# Format: "openrouter:<provider>/<model>"
agent = Agent('openrouter:anthropic/claude-sonnet-4-5')
agent = Agent('openrouter:deepseek/deepseek-chat')
agent = Agent('openrouter:openai/gpt-4o')
agent = Agent('openrouter:google/gemini-2.5-flash')
```

### Direct Initialization (for custom config)

```python
from pydantic_ai.models.openrouter import OpenRouterModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

model = OpenRouterModel(
    'anthropic/claude-sonnet-4-5',
    provider=OpenRouterProvider(api_key='your-key')
)
agent = Agent(model)
```

### App Attribution (for OpenRouter ranking)

```python
provider = OpenRouterProvider(
    api_key='your-key',
    app_url='https://chrono.app',
    app_title='Chrono Timeline Research'
)
```

### OpenRouter-Specific Model Settings

```python
from pydantic_ai.models.openrouter import OpenRouterModel, OpenRouterModelSettings

settings = OpenRouterModelSettings(
    openrouter_reasoning={'effort': 'high'},
    openrouter_usage={'include': True},
)
model = OpenRouterModel('openai/gpt-4o')
agent = Agent(model, model_settings=settings)
```

### Switching Models at Runtime

You can override the model per-run without changing the agent definition:

```python
agent = Agent('openrouter:deepseek/deepseek-chat')  # default model

# Override at call time:
result = await agent.run('query', model='openrouter:anthropic/claude-sonnet-4-5')
```

This is critical for Chrono's language-aware model routing strategy.

### Fallback Models

```python
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.openrouter import OpenRouterModel

fallback = FallbackModel(
    OpenRouterModel('deepseek/deepseek-chat'),
    OpenRouterModel('openai/gpt-4o-mini'),
)
agent = Agent(fallback)
```

### Chrono Model Mapping

Based on the technical design, our model strings would be:

| Agent | Model String |
|-------|-------------|
| Orchestrator | `openrouter:anthropic/claude-sonnet-4-5` |
| Milestone Agent | `openrouter:deepseek/deepseek-chat` |
| Detail Agent | `openrouter:deepseek/deepseek-chat` |
| Impact Agent | `openrouter:deepseek/deepseek-chat` |
| Synthesizer | `openrouter:anthropic/claude-sonnet-4-5` |

These can be stored in config and passed dynamically.

---

## 6. Running Agents

### `agent.run()` - Async Execution

```python
result = await agent.run('Tell me about React', deps=my_deps)
print(result.output)        # The structured output (typed)
print(result.usage())       # RunUsage(request_tokens=..., response_tokens=...)
print(result.all_messages()) # Full message history
print(result.new_messages()) # Messages from this run only
```

### `agent.run_sync()` - Synchronous Execution

```python
result = agent.run_sync('Tell me about React', deps=my_deps)
# Same result interface as run()
```

### Run Parameters

```python
result = await agent.run(
    user_prompt='Research this topic',          # str or structured content
    deps=my_deps,                               # runtime dependencies
    model='openrouter:anthropic/claude-sonnet-4-5',  # override model
    model_settings=ModelSettings(temperature=0.2),    # override settings
    message_history=previous_messages,           # conversation context
    output_type=AlternativeOutput,               # override output type
    usage_limits=UsageLimits(request_limit=10),  # safety limits
)
```

### AgentRunResult Properties

| Property/Method | Returns | Description |
|----------------|---------|-------------|
| `.output` | `OutputDataT` | The validated structured output |
| `.usage()` | `RunUsage` | Token usage stats |
| `.all_messages()` | `list[ModelMessage]` | Full conversation history |
| `.new_messages()` | `list[ModelMessage]` | Messages from this run only |
| `.all_messages_json()` | `bytes` | Serialized history |

### Conversation Continuity

Pass message history to continue a conversation:

```python
result1 = await agent.run('What happened in 2007?', deps=deps)
result2 = await agent.run(
    'Tell me more about the first one',
    deps=deps,
    message_history=result1.all_messages(),
)
```

### Usage Limits (Safety)

```python
from pydantic_ai import UsageLimits

result = await agent.run(
    'Research topic',
    deps=deps,
    usage_limits=UsageLimits(
        request_limit=10,       # max LLM requests
        request_tokens_limit=5000,  # max input tokens
        response_tokens_limit=2000, # max output tokens
    ),
)
```

---

## 7. Streaming

### `agent.run_stream()` - Async Streaming

Returns a `StreamedRunResult` as an async context manager:

```python
async with agent.run_stream('Generate a timeline', deps=deps) as result:
    async for text in result.stream_text():
        print(text)  # Each yield is the FULL text so far (accumulated)

    # Or stream as deltas:
    async for delta in result.stream_text(delta=True):
        print(delta, end='')  # Each yield is only the NEW text
```

### Streaming Structured Output

```python
class Profile(BaseModel):
    name: str
    bio: str
    skills: list[str]

agent = Agent('openai:gpt-4o', output_type=Profile)

async with agent.run_stream('Create a profile for a Python developer') as result:
    async for partial_profile in result.stream_output(debounce_by=0.1):
        # partial_profile is a partially-constructed Profile
        # Pydantic validation runs in "partial mode"
        print(partial_profile)
```

### Streaming Complete Example (Whales)

```python
from typing import Annotated
from pydantic import BaseModel, Field
from pydantic_ai import Agent

class Whale(BaseModel):
    name: str
    length: Annotated[float, Field(description='Length in meters')]
    ocean: str
    description: str

agent = Agent('openai:gpt-4o', output_type=list[Whale])

async def main():
    async with agent.run_stream('Generate details of 5 whale species') as result:
        async for whales in result.stream_output(debounce_by=0.01):
            # whales is a partially-built list[Whale]
            for whale in whales:
                print(f"{whale.name}: {whale.length}m")
```

### StreamedRunResult Methods

| Method | Description |
|--------|-------------|
| `stream_text(delta=False, debounce_by=0.1)` | Stream text output. `delta=True` yields only new text |
| `stream_output(debounce_by=0.1)` | Stream structured output with partial Pydantic validation |
| `stream_responses(debounce_by=0.1)` | Stream raw ModelResponse objects |
| `get_output()` | Consume entire stream, return final validated output |
| `usage()` | Token usage (incomplete until stream finishes) |
| `all_messages()` | Full message history |
| `is_complete` | Boolean: has stream finished? |

### `agent.run_stream_events()` - Event Streaming

For more granular control, stream raw agent events:

```python
async for event in agent.run_stream_events('query', deps=deps):
    # event is an AgentStreamEvent
    print(event)
```

### Debouncing

The `debounce_by` parameter (in seconds) controls how frequently partial results are yielded. Lower values = more frequent updates but more overhead.

### Chrono Implications

For Chrono, streaming is useful in two places:

1. **Sub-agent streaming**: If we want to see partial milestone results as the LLM generates them. Probably not critical since the Orchestrator processes complete results.

2. **Orchestrator-to-frontend**: The Orchestrator itself manages SSE to the frontend. Sub-agents can use regular `agent.run()` and the Orchestrator pushes complete results via SSE as they arrive. This is cleaner than trying to pipe Pydantic AI's stream through SSE.

Recommended approach: Use `agent.run()` (non-streaming) for sub-agents, and build our own SSE layer in the Orchestrator.

---

## 8. `agent.iter()` - Node-by-Node Execution

For advanced control, iterate over the agent's internal execution graph:

```python
async with agent.iter('query', deps=deps) as agent_run:
    async for node in agent_run:
        # node represents each step: model request, tool call, etc.
        if isinstance(node, ToolCallNode):
            print(f"Calling tool: {node.tool_name}")
        elif isinstance(node, ModelResponseNode):
            print(f"Model responded")
```

This gives visibility into the agent's internal execution, useful for debugging and monitoring.

---

## 9. Testing

### TestModel

Pydantic AI provides `TestModel` for testing without real LLM calls:

```python
from pydantic_ai.models.test import TestModel

with agent.override(model=TestModel()):
    result = agent.run_sync('test query')
```

### FunctionModel

For custom test responses:

```python
from pydantic_ai.models.function import FunctionModel

def my_test_model(messages, model_settings):
    return ModelResponse(parts=[TextPart('mocked response')])

with agent.override(model=FunctionModel(my_test_model)):
    result = agent.run_sync('test')
```

### Dependency Override

```python
with agent.override(deps=mock_deps, model=TestModel()):
    result = agent.run_sync('test')
```

---

## 10. Summary: Pydantic AI Patterns for Chrono

### Agent Definition Pattern

```python
from dataclasses import dataclass
from pydantic import BaseModel
from pydantic_ai import Agent, RunContext

# 1. Define deps
@dataclass
class MilestoneAgentDeps:
    tavily_client: TavilyClient
    language: str
    search_budget: int

# 2. Define output
class MilestoneResult(BaseModel):
    milestones: list[Milestone]

# 3. Define agent (module-level, reusable)
milestone_agent = Agent(
    'openrouter:deepseek/deepseek-chat',
    deps_type=MilestoneAgentDeps,
    output_type=MilestoneResult,
    instructions="You are a milestone research agent. Given a topic, identify key milestones in its history.",
    retries=2,
)

# 4. Register tools
@milestone_agent.tool
async def search(ctx: RunContext[MilestoneAgentDeps], query: str) -> str:
    """Search the web for factual information about the given query."""
    if ctx.deps.search_budget <= 0:
        return "Search budget exhausted. Use your existing knowledge."
    results = await ctx.deps.tavily_client.search(query)
    ctx.deps.search_budget -= 1
    return format_results(results)

# 5. Dynamic system prompt
@milestone_agent.system_prompt
def add_language_context(ctx: RunContext[MilestoneAgentDeps]) -> str:
    return f"Respond in {ctx.deps.language}. Search in both {ctx.deps.language} and English."
```

### Running from the Orchestrator (asyncio layer)

```python
async def run_milestone_agent(topic: str, deps: MilestoneAgentDeps) -> MilestoneResult:
    result = await milestone_agent.run(
        f"Research the key milestones in the history of: {topic}",
        deps=deps,
    )
    return result.output  # Typed as MilestoneResult
```

### Key Architecture Mapping

| Chrono Layer | Technology | Responsibility |
|-------------|------------|---------------|
| Orchestrator | Pure asyncio | Spawn/cancel agents, manage state, SSE push |
| Sub-Agents | Pydantic AI Agent | LLM interaction, structured output, tool use |
| Model Routing | OpenRouter strings | `"openrouter:provider/model"` per agent |
| Dependencies | `deps_type` dataclass | Tavily client, API keys, search budget |
| Structured Data | Pydantic `output_type` | Milestone, NodeDetail, etc. |
| Search | Tool via `@agent.tool` | Tavily API wrapped in agent tool |

### What Pydantic AI Does NOT Handle (Orchestrator's Job)

- Dynamic agent spawning / cancellation
- Cross-agent coordination and state management
- SSE event construction and push to frontend
- Progress tracking and time estimation
- Resource budget management across agents
- Retry / fallback logic at the orchestration level

These are explicitly the Orchestrator's responsibilities, implemented in pure asyncio.
