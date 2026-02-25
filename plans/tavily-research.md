# Tavily Search API Research

## 1. Python SDK Overview

**Package**: `tavily-python` (latest version: 0.7.21 as of Jan 2026)
**Install**: `pip install tavily-python` or `uv add tavily-python`
**License**: MIT
**Python**: 3.8+
**HTTP library**: Uses `httpx` internally (both sync and async)

### Initialization

```python
# Sync client
from tavily import TavilyClient
client = TavilyClient(api_key="tvly-YOUR_API_KEY")

# Async client (critical for our use case)
from tavily import AsyncTavilyClient
client = AsyncTavilyClient(api_key="tvly-YOUR_API_KEY")
```

The constructor accepts:
```python
AsyncTavilyClient(
    api_key: str | None = None,          # Falls back to TAVILY_API_KEY env var
    project_id: str | None = None,        # Optional, for request tracking
    proxies: dict[str, str] | None = None # Optional HTTP/HTTPS proxies
)
```

If `api_key` is not passed, it reads from the `TAVILY_API_KEY` environment variable.

---

## 2. Search API

### Endpoint
`POST https://api.tavily.com/search`

### Authentication
Bearer token: `Authorization: Bearer tvly-YOUR_API_KEY`

### Full Parameter List

```python
await client.search(
    query: str,                              # Required. The search query.
    search_depth: str = "basic",             # "basic" (1 credit), "advanced" (2 credits), "fast" (1), "ultra-fast" (1)
    topic: str = "general",                  # "general", "news", "finance"
    time_range: str | None = None,           # "day", "week", "month", "year"
    start_date: str | None = None,           # "YYYY-MM-DD" format
    end_date: str | None = None,             # "YYYY-MM-DD" format
    max_results: int = 5,                    # 0-20
    chunks_per_source: int = 3,              # 1-3, advanced search only
    include_answer: bool | str = False,      # False, True/"basic", "advanced"
    include_raw_content: bool | str = False, # False, True/"markdown", "text"
    include_images: bool = False,            # Whether to search for images
    include_image_descriptions: bool = False,# Add descriptions to images
    include_domains: list[str] = [],         # Whitelist domains (max 300)
    exclude_domains: list[str] = [],         # Blacklist domains (max 150)
    country: str | None = None,              # Boost results from country (general topic only)
    auto_parameters: bool = False,           # Let Tavily auto-configure params (2 credits if advanced)
    include_favicon: bool = False,           # Include favicon URLs in results
    include_usage: bool = False,             # Include credit usage info in response
    timeout: float = 60                      # Request timeout in seconds
)
```

### Key Parameter Details

**search_depth**:
- `"basic"` - Default. Good balance of relevance and speed. 1 credit.
- `"advanced"` - Highest relevance, increased latency. 2 credits.
- `"fast"` - Faster than basic, slightly less relevant. 1 credit.
- `"ultra-fast"` - Minimizes latency above all else. 1 credit.

**topic**:
- `"general"` - Default. General web search.
- `"news"` - Optimized for news articles. Results may include `published_date`.
- `"finance"` - Optimized for financial data.

**include_answer**:
- `False` - No AI-generated answer.
- `True` or `"basic"` - Short AI-generated answer based on search results.
- `"advanced"` - More detailed AI-generated answer.

**include_raw_content**:
- `False` - No raw content.
- `True` or `"markdown"` - Full page content in markdown format.
- `"text"` - Full page content as plain text.

---

## 3. Response Format

### Full Response Structure

```python
{
    "query": "string",                    # The original query
    "answer": "string | None",           # AI-generated answer (if include_answer=True)
    "results": [                          # List of search results, ranked by relevancy
        {
            "title": "string",           # Page title
            "url": "string",             # Page URL
            "content": "string",         # Relevant snippet/content from the page
            "score": 0.95,               # Relevancy score (0.0 - 1.0)
            "raw_content": "string|None",# Full page content (if include_raw_content=True)
            "published_date": "string|None", # Publication date (news topic only)
            "favicon": "string|None"     # Favicon URL (if include_favicon=True)
        }
    ],
    "images": [                           # Image results (if include_images=True)
        {
            "url": "string",             # Image URL
            "description": "string"      # Image description (if include_image_descriptions=True)
        }
    ],
    "response_time": 1.23,               # Response time in seconds
    "usage": {"credits": 1},             # Credit usage (if include_usage=True)
    "request_id": "string"               # Unique request identifier
}
```

### Example Response (basic search)

```python
{
    "query": "history of the internet",
    "answer": None,
    "results": [
        {
            "title": "History of the Internet - Wikipedia",
            "url": "https://en.wikipedia.org/wiki/History_of_the_Internet",
            "content": "The history of the Internet has its origin in the efforts to build and interconnect computer networks...",
            "score": 0.98,
            "raw_content": None,
            "published_date": None,
            "favicon": None
        },
        # ... more results
    ],
    "images": [],
    "response_time": 0.89,
    "request_id": "abc123..."
}
```

---

## 4. Async Support

The async client is fully supported and production-ready. It uses `httpx.AsyncClient` internally with connection pooling.

### Async Usage

```python
import asyncio
from tavily import AsyncTavilyClient

# Initialize once, reuse across requests
client = AsyncTavilyClient(api_key="tvly-YOUR_API_KEY")

# Single search
async def search_single():
    response = await client.search(
        query="history of artificial intelligence",
        search_depth="basic",
        max_results=5,
        include_answer=True
    )
    return response

# Parallel searches (our primary use case for multi-agent)
async def search_parallel():
    queries = [
        "key milestones in AI history",
        "major AI breakthroughs 2020-2025",
        "history of neural networks"
    ]
    responses = await asyncio.gather(
        *(client.search(q, max_results=5) for q in queries),
        return_exceptions=True
    )
    for resp in responses:
        if isinstance(resp, Exception):
            print(f"Search failed: {resp}")
        else:
            for result in resp["results"]:
                print(f"  [{result['score']:.2f}] {result['title']}")
                print(f"    {result['url']}")
    return responses
```

### Key Async Details

- `AsyncTavilyClient` has the **exact same API** as `TavilyClient` - same method names, same parameters, same return types. The only difference is all methods are `async`.
- Uses `httpx.AsyncClient` with persistent connection pooling.
- Methods enforce a maximum 120-second internal timeout, with `httpx.TimeoutException` caught and re-raised as Tavily-specific errors.
- Supports proxy configuration via constructor or environment variables (`TAVILY_HTTP_PROXY`, `TAVILY_HTTPS_PROXY`).

### Error Types

```python
from tavily import (
    UsageLimitExceededError,  # HTTP 429
    InvalidAPIKeyError,       # HTTP 401
    BadRequestError,          # HTTP 400
    ForbiddenError,           # HTTP 403/432/433
    # TimeoutError            # httpx timeout
)
```

---

## 5. Rate Limits and Pricing

### Rate Limits

| Endpoint   | Development | Production |
|------------|-------------|------------|
| Search     | 100 RPM     | 1,000 RPM  |
| Crawl      | 100 RPM     | 100 RPM    |
| Research   | 20 RPM      | 20 RPM     |
| Usage      | 10 per 10m  | 10 per 10m |

Production access requires an active paid plan or PAYGO enabled.

### Pricing

- **Free tier**: 1,000 credits/month (no credit card required)
- **Pay-as-you-go**: $0.008 per credit
- **Monthly plans**: $0.005 - $0.0075 per credit

### Credit Costs

| Operation | Credits |
|-----------|---------|
| Basic search | 1 |
| Advanced search | 2 |
| Fast search | 1 |
| Ultra-fast search | 1 |

For our use case: with 1,000 free credits/month and basic search at 1 credit each, we get 1,000 free searches per month. That is generous for development.

---

## 6. Best Practices for Our Use Case

### Query Optimization
- Be specific in queries. "Key milestones in the history of artificial intelligence 1950-2024" works better than "AI history".
- Use `time_range` or `start_date`/`end_date` for timeline research to focus on specific periods.
- Use `topic="news"` when searching for recent events to get `published_date` in results.
- Use `include_domains` to restrict to high-quality sources (e.g., Wikipedia, academic sites) when accuracy matters.

### Performance
- Use `search_depth="basic"` for most queries (1 credit, good enough for initial research).
- Reserve `search_depth="advanced"` for when basic returns low-relevancy results.
- Initialize `AsyncTavilyClient` once at application startup and reuse it (connection pooling).
- Use `asyncio.gather()` for parallel searches across multiple agents.
- Set appropriate `max_results` - 5 is the default, 10 is reasonable for timeline research.

### For Timeline Research Specifically
- `include_answer=True` is useful for getting a quick summary from the LLM that the agent can use as context.
- `include_raw_content="markdown"` is expensive (more data) but useful when the agent needs to extract detailed facts from pages.
- Results come pre-ranked by `score` (0.0-1.0), so the agent can trust the ordering.
- `published_date` (available with `topic="news"`) is directly useful for building timelines.

### Error Handling
- Always use `return_exceptions=True` with `asyncio.gather()` so one failed search doesn't kill parallel searches.
- Handle `UsageLimitExceededError` (429) gracefully - implement backoff or inform user.
- Handle `InvalidAPIKeyError` (401) at startup with a clear error message.

---

## 7. Other Useful Methods

### get_search_context (for RAG)
```python
# Returns a concatenated string of search results, optimized for LLM context
context = await client.get_search_context(
    query="history of the internet",
    max_results=5,
    max_tokens=4000  # Truncates to fit token budget
)
# Returns: str (concatenated search result contents)
```

### qna_search (quick Q&A)
```python
# Returns just the AI-generated answer string
answer = await client.qna_search(query="When was the first email sent?")
# Returns: str
```

### extract (page content extraction)
```python
# Extract full content from specific URLs
result = await client.extract(
    urls=["https://en.wikipedia.org/wiki/Internet"],
    format="markdown"
)
# Returns: { "results": [{"url": str, "raw_content": str}], "failed_results": [...] }
```

---

## 8. Concrete Code for Our Service Layer

Here is what our Tavily service wrapper should look like:

```python
from tavily import AsyncTavilyClient, InvalidAPIKeyError, UsageLimitExceededError

class TavilyService:
    def __init__(self, api_key: str):
        self._client = AsyncTavilyClient(api_key=api_key)

    async def search(
        self,
        query: str,
        *,
        max_results: int = 5,
        search_depth: str = "basic",
        topic: str = "general",
        include_answer: bool = False,
        time_range: str | None = None,
        include_raw_content: bool = False,
        include_domains: list[str] | None = None,
        exclude_domains: list[str] | None = None,
    ) -> dict:
        return await self._client.search(
            query=query,
            max_results=max_results,
            search_depth=search_depth,
            topic=topic,
            include_answer=include_answer,
            time_range=time_range,
            include_raw_content=include_raw_content,
            include_domains=include_domains or [],
            exclude_domains=exclude_domains or [],
        )

    async def search_for_timeline(
        self,
        query: str,
        *,
        max_results: int = 10,
        time_range: str | None = None,
    ) -> dict:
        """Optimized search for timeline research."""
        return await self._client.search(
            query=query,
            max_results=max_results,
            search_depth="basic",
            topic="news" if time_range else "general",
            include_answer=True,
            time_range=time_range,
        )

    async def extract_page(self, url: str) -> str | None:
        """Extract full content from a URL."""
        result = await self._client.extract(urls=[url], format="markdown")
        if result["results"]:
            return result["results"][0]["raw_content"]
        return None
```
