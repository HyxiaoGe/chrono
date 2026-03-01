# Dedup 去重策略优化

## 问题背景

当前 Dedup 采用"按年分组 → 每组 LLM 判断重复"的策略，已验证的两个失败 case：

**Case 1：Transformer 重复（"人工智能" Deep 级）**
- 2017-01-01 "Transformer架构" (revolutionary)
- 2018-01-01 "Transformer架构" (high)
- 完全相同的标题，日期差一年
- **根因**：按年分组把它们分到了 2017 组和 2018 组，两个节点永远不会被送到同一次 LLM 调用里比较。换任何模型都一样漏——不是模型能力问题，是分组策略的盲区。

**Case 2：波茨坦会议重复（"二战" Epic 级）**
- 1945-07-16 "波茨坦会议召开" (high)
- 1945-07-17 "波茨坦会议" (high)
- 标题略不同，日期差一天，都在 1945 年组
- **根因**：1945 年组有 19 个节点（全 pipeline 最大的年组），信息量过大导致 LLM 漏判。不是模型不行，是候选集太大时精度下降。

## 修复方案：三层去重

在现有 LLM 去重基础上，增加两层，形成三层去重 pipeline：

```
原始节点列表
  → 第 1 层：标题精确匹配预去重（新增，零 LLM 成本）
  → 第 2 层：按年分组 LLM 去重（现有逻辑优化）
  → 第 3 层：相邻年组边界扫描（新增，低 LLM 成本）
  → 最终去重结果
```

### 第 1 层：标题精确匹配预去重

**目标**：解决 Transformer 类问题——完全相同标题的节点，不管日期差多少，直接合并。

**逻辑**：
1. 对每个节点的标题做 normalize（去首尾空格、统一为小写、去除多余空格）
2. 按 normalized 标题分组
3. 同组内超过 1 个节点 → 用现有的 `_merge_duplicate_group()` 合并
4. 输出去重后的节点列表，传给第 2 层

**零 LLM 成本**——纯字符串操作。Transformer 这种完全相同标题的 case 根本不需要 LLM 来判断。

注意：这一层只处理**精确匹配**（normalize 后完全相同）。"波茨坦会议召开" vs "波茨坦会议" 标题不同，不会被这层捕获，留给第 2 层处理。

### 第 2 层：按年分组 LLM 去重（优化现有逻辑）

现有逻辑的两个优化：

**优化 2a：大年组拆分**

当一个年组超过 12 个节点时，按半年拆分（1-6 月一组、7-12 月一组）。把 1945 年的 19 个节点拆成两组（约 8 + 11），每组在 LLM 的舒适判断区间内。

拆分标准：
- 年组 ≤ 12 个节点：不拆，整组送 LLM
- 年组 > 12 个节点：按 6 月为界拆成上下半年两组
- 如果半年组仍然 > 12，不再继续拆（实际不太可能出现）

**优化 2b：Prompt 强化**

在现有 Dedup Agent 的 instructions 中增加一条规则：

```
- Pay extra attention to events within 7 days of each other whose titles share key terms — these are very likely duplicates even if worded differently (e.g. "波茨坦会议召开" and "波茨坦会议" one day apart)
```

这条规则直接针对波茨坦类 case——日期极近 + 标题有共同关键词。

### 第 3 层：相邻年组边界扫描

**目标**：捕捉跨年边界的近似重复（如 12 月底 vs 次年 1 月初的同一事件）。

**逻辑**：
1. 将所有年份按顺序排列
2. 对每对相邻年份（如 2017 和 2018），取前一年的最后 3 个节点 + 后一年的前 3 个节点，组成一个临时候选集（最多 6 个节点）
3. 对这个临时候选集调一次 LLM 去重
4. 如果发现重复，执行合并

**成本极低**：每对相邻年份一次 LLM 调用，每次只有 ≤ 6 个节点。epic 级约 15 个年份 = 14 次边界扫描，token 量极小。

注意：经过第 1 层精确匹配后，Transformer 这种 case 已经被处理掉了。第 3 层主要捕捉的是"标题不完全相同但描述同一事件"的跨年边界重复（概率很低但作为安全网）。

## 整体流程

```python
async def _merge_and_dedup(nodes: list[SkeletonNode], language: str) -> list[SkeletonNode]:
    sorted_nodes = sorted(nodes, key=lambda n: n.date)

    # 第 1 层：标题精确匹配预去重
    after_exact = _exact_title_dedup(sorted_nodes, language)

    # 第 2 层：按年分组 LLM 去重（含大组拆分）
    after_llm = await _llm_year_group_dedup(after_exact, language)

    # 第 3 层：相邻年组边界扫描
    after_boundary = await _boundary_scan_dedup(after_llm, language)

    return after_boundary
```

## 对现有代码的影响

**改的**：
- `orchestrator.py` 中的 `_merge_and_dedup()` 函数：重构为三层 pipeline
- `orchestrator.py` 中的 `_group_by_year()`：增加大组拆分逻辑
- `orchestrator.py` 中的 `_dedup_agent` instructions：增加一条 prompt 规则
- 新增 `_exact_title_dedup()` 函数
- 新增 `_boundary_scan_dedup()` 函数

**不改的**：
- `_dedup_year_group()` 核心逻辑不变（仍然是接收一组节点、调 LLM、返回重复组）
- `_merge_duplicate_group()` 不变（合并策略不变）
- `_pick_language_matching()`、`_pick_precise_date()` 不变
- 所有 Agent 文件不变
- 前端不变
- 数据库不变

## 验证标准

1. **Transformer case**：跑 "人工智能"，确认不再出现两个 "Transformer架构" 节点
2. **波茨坦 case**：跑 "二战"，确认 "波茨坦会议召开" 和 "波茨坦会议" 被合并为一个节点
3. **无回归**：跑 "iPhone"（Light 级），确认节点数和质量不下降
4. **日志确认**：三层去重各自的合并数量应该有 log 输出，便于观察每层的贡献

## Todo List

- [x] 1. 新增 `_exact_title_dedup()` 函数：标题 normalize + 精确匹配分组 + 合并
- [x] 2. 修改 `_group_by_year()`：年组 > 12 时按半年拆分（`_split_large_groups()`）
- [x] 3. 强化 `_dedup_agent` instructions：增加"日期近 + 标题关键词重叠"规则
- [x] 4. 新增 `_boundary_scan_dedup()` 函数：相邻年组取边界节点 → LLM 去重
- [x] 5. 重构 `_merge_and_dedup()`：串联三层为 pipeline，每层输出 log
- [x] 6. 清除 "二战" 和 "人工智能" 的 DB 缓存，重新跑 E2E 验证
