# Dedup Model Evaluation Report

**Status**: Pending — run `cd backend && uv run python ../scripts/test_dedup_models.py` to generate results.

**Model A**: `openrouter:deepseek/deepseek-chat` (current default via `settings.dedup_model`)
**Model B**: `openrouter:deepseek/deepseek-chat` (same — update `MODEL_B_NAME` in script to test a different model)

## Prerequisites

1. At least one completed research in the DB for target topics (iPhone, 人工智能, 二战)
2. API keys configured in `backend/.env`
3. Run the evaluation script — it will overwrite this file with actual results

## How to Run

```bash
cd backend
uv run python ../scripts/test_dedup_models.py
```

The script will:
1. Read skeleton data from DB for matching topics
2. Run the 3-layer dedup pipeline with each model
3. Compare results (merged count, quality differences, latency)
4. Overwrite this file with the evaluation report
