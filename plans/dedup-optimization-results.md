# Dedup 三层去重优化 — 验证报告

## 测试环境

- 日期：2026-03-01
- 三层去重 pipeline：Layer 1 精确标题匹配 → Layer 2 LLM 年组去重（含大组拆分）→ Layer 3 相邻年组边界扫描

---

## 测试 1：人工智能（Deep 级，分阶段）

| 指标 | 值 |
|------|-----|
| 复杂度 | deep |
| 总节点数 | 58 |
| 总 sources | 320 |
| 阶段数 | 4（萌芽与奠基期 / 寒冬与复苏 / 深度学习崛起 / 大模型与AGI时代）|

### 阶段节点分布

| 阶段 | 节点数 |
|------|--------|
| 萌芽与奠基期 | 9 |
| 寒冬与复苏 | 13 |
| 深度学习崛起 | 15 |
| 大模型与AGI时代 | 16 |
| Gap 补充节点（无阶段） | 5 |

### 去重日志

分阶段执行，每个阶段独立去重 + 全局去重：

```
Layer 2 LLM year-group dedup: merged 3 nodes   ← 阶段内去重
Layer 3 boundary scan dedup: merged 1 nodes     ← 阶段内边界扫描
Layer 1 exact title dedup: merged 1 nodes       ← 全局精确去重
Layer 2 LLM year-group dedup: merged 2 nodes    ← 全局 LLM 去重
```

### 关键验证：Transformer 重复

| 检查项 | 结果 |
|--------|------|
| "Transformer" 相关节点数 | **1**（ms_037: "Transformer架构的提出", 2017-01-01, high）|
| 是否存在重复 | **否** ✅ |

**修复确认**：之前 "Transformer架构" 出现两次（2017 + 2018，分属不同年组导致漏判），现在 Layer 1 精确标题匹配已将其合并。

---

## 测试 2：二战（Epic 级，分阶段）

| 指标 | 值 |
|------|-----|
| 复杂度 | epic |
| 总节点数 | 93 |
| 总 sources | 481 |
| 阶段数 | 5（战前酝酿 / 闪电战与扩张 / 全球化与转折 / 反攻与终结 / 战后清算与新秩序）|

### 阶段节点分布

| 阶段 | 节点数 |
|------|--------|
| 战前酝酿 | 11 |
| 闪电战与扩张 | 14 |
| 全球化与转折 | 25 |
| 反攻与终结 | 16 |
| 战后清算与新秩序 | 12 |
| Gap 补充节点（无阶段） | 15 |

### 去重日志

```
Layer 1 exact title dedup: merged 2 nodes       ← 阶段内
Layer 1 exact title dedup: merged 2 nodes
Layer 2 LLM year-group dedup: merged 2 nodes
Layer 2 LLM year-group dedup: merged 4 nodes
Layer 1 exact title dedup: merged 6 nodes
Layer 2 LLM year-group dedup: merged 2 nodes
Layer 1 exact title dedup: merged 1 nodes
Layer 2 LLM year-group dedup: merged 3 nodes
Layer 3 boundary scan dedup: merged 1 nodes
Layer 1 exact title dedup: merged 7 nodes       ← 全局精确去重
Layer 2 LLM year-group dedup: merged 4 nodes    ← 全局 LLM 去重
```

### 关键验证：波茨坦会议重复

| 检查项 | 结果 |
|--------|------|
| "波茨坦" 相关节点 | ms_072: "波茨坦会议"（1945-07-17, high）<br>ms_073: "波茨坦宣言"（1945-07-24, high）|
| 是否存在 "波茨坦会议召开" 重复 | **否** ✅ |

**修复确认**：之前 "波茨坦会议召开"（07-16）和 "波茨坦会议"（07-17）同时存在。现在只保留一个 "波茨坦会议"。"波茨坦宣言"（07-24）是不同事件，正确保留。

### 精确标题重复检查

| Topic | 相同标题节点数 |
|-------|---------------|
| 人工智能 | **0** ✅ |
| 二战 | **0** ✅ |

---

## 三层去重贡献汇总

| 层 | 人工智能 | 二战 | 说明 |
|----|---------|------|------|
| Layer 1 精确标题 | 1 | 18 | 零 LLM 成本，处理完全相同标题 |
| Layer 2 LLM 年组 | 5 | 15 | 现有逻辑 + 大组拆分 + prompt 强化 |
| Layer 3 边界扫描 | 1 | 1 | 跨年边界安全网 |
| **总合并** | **7** | **34** | |

---

## 结论

1. **Transformer case 已修复**：Layer 1 精确标题匹配在 LLM 之前拦截，不依赖年组分组
2. **波茨坦 case 已修复**：Layer 2 prompt 强化 + 大组拆分（1945 年组从 19 节点拆为上下半年）提升了 LLM 判断精度
3. **无回归**：两个 topic 均正常完成，节点数和质量合理
4. **Layer 1 贡献最大**：尤其在 Epic 级（二战合并 18 个精确重复），零 LLM 成本
5. **Layer 3 作为安全网有效**：两个 topic 各捕获 1 个跨年边界重复
