# 日期准确性修正 — Synthesizer Date Corrections

## 问题背景

Milestone Agent 生成的节点日期有时不准确（偏差数月甚至数年），但 Synthesizer 在交叉验证时已经发现了这些错误，只是输出为人类可读的 verification_notes 文本，没有结构化的修正指令。

已验证 case（"二战"）：
- Node 35（斯大林格勒战役）：标注 1942-01-20，实际 1942-07-17
- Node 79（以色列建国）：标注 1947-05-14，实际 1948-05-14

## 方案：扩展 Synthesizer 输出

### 数据结构变更

```python
# 新增
class DateCorrection(BaseModel):
    node_id: str           # "ms_035"
    original_date: str     # "1942-01-20"
    corrected_date: str    # "1942-07-17"
    reason: str            # "正文描述指明战役始于1942年7月17日"

# SynthesisResult 扩展
class SynthesisResult(BaseModel):
    # ... 现有字段全部保留 ...
    date_corrections: list[DateCorrection] = []  # 新增
```

### Synthesizer Prompt 扩展

增加一个 task：

```
6. **Date Verification**: Compare each node's date field against its description
   and details. If the date is clearly wrong (off by months or years), output a
   correction with the correct date and reason. Only flag dates you are confident
   are wrong — do not guess. Output an empty list if all dates are correct.
```

### Orchestrator 应用修正

Synthesis 后、推送 COMPLETE 之前，自动应用修正：

```python
if synthesis_data.get("date_corrections"):
    for correction in synthesis_data["date_corrections"]:
        for node in nodes:
            if node["id"] == correction["node_id"]:
                node["date"] = correction["corrected_date"]
                break
    nodes.sort(key=lambda n: n["date"])
    await session.push(SSEEventType.SKELETON, {"nodes": nodes})
```

## 为什么不在 Detail Agent 阶段修正

1. NodeDetail schema 不包含 date 字段，改 schema 影响面大
2. Detail Agent 只看单个节点，没有全局视角
3. Synthesizer 天然有全局视角，已经在做交叉验证

## 改动影响

| 组件 | 改动 |
|------|------|
| `models/research.py` | 新增 `DateCorrection` model，`SynthesisResult` 加一个字段 |
| `agents/synthesizer.py` | Prompt 增加 date verification task |
| `orchestrator.py` | Synthesis 后应用 date_corrections + 可选重推 skeleton |
| 数据库 | `researches.synthesis` JSONB 自动包含新字段，不需要 migration |
| 前端 | 不变 |

## Todo List

- [x] 1. `models/research.py`: 新增 `DateCorrection` model，`SynthesisResult` 加 `date_corrections` 字段
- [x] 2. `agents/synthesizer.py`: Prompt 增加 date verification task + 节点 ID 传入 prompt
- [x] 3. `orchestrator.py`: Synthesis 后应用 date_corrections，修正节点日期 + 重排序 + 推送更新 skeleton
- [x] 4. 清除 "二战" DB 缓存，重新跑 E2E 验证日期修正效果

## 验证结果

"二战" E2E 测试：Synthesizer 输出 **28 个日期修正**，全部自动应用。典型修正：
- ms_029: 1942-01-20 → 1942-11-08（火炬行动）
- ms_030: 1942-02-19 → 1945-02-19（硫磺岛战役，年份错误 3 年）
- ms_070: 1946-01-01 → 1950-12-14（联合国难民署成立，年份错误 4 年）
