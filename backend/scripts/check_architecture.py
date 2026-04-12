"""
架构约束检查器

基于 AST 分析检查分层依赖规则：
  API(main.py) → Orchestrator(orchestrator/) → Agents(agents/) → Services(services/) → Models(models/)
  DB(db/) 为独立数据层。依赖只能向下，不能反向。

用法：
  python scripts/check_architecture.py          # 检查全部
  python scripts/check_architecture.py --verbose # 显示详情
"""

import ast
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = PROJECT_ROOT / "app"

# 分层依赖规则
LAYER_RULES = {
    "app/models": [
        ("app.orchestrator", "数据模型层禁止 import 编排层"),
        ("app.agents", "数据模型层禁止 import Agent 层"),
        ("app.db", "数据模型层禁止 import 数据库层"),
    ],
    "app/services": [
        ("app.orchestrator", "服务层禁止 import 编排层"),
        ("app.agents", "服务层禁止 import Agent 层"),
        ("app.db", "服务层禁止 import 数据库层"),
    ],
    "app/agents": [
        ("app.orchestrator", "Agent 层禁止 import 编排层"),
        ("app.db", "Agent 层禁止 import 数据库层"),
    ],
    "app/db": [
        ("app.orchestrator", "数据库层禁止 import 编排层"),
        ("app.agents", "数据库层禁止 import Agent 层"),
        ("app.services", "数据库层禁止 import 服务层"),
    ],
}


def get_imports(tree: ast.AST) -> list[tuple[int, str]]:
    """从 AST 中提取所有 import 的模块名和行号"""
    imports = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append((node.lineno, alias.name))
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.append((node.lineno, node.module))
    return imports


def check_file(filepath: Path) -> list[str]:
    """检查单个文件的架构违规"""
    violations = []
    try:
        source = filepath.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(filepath))
    except (SyntaxError, UnicodeDecodeError):
        return []

    rel_path = str(filepath.relative_to(PROJECT_ROOT))

    # 跳过测试文件
    if "test" in rel_path:
        return []

    for layer_prefix, rules in LAYER_RULES.items():
        if rel_path.startswith(layer_prefix):
            imports = get_imports(tree)
            for lineno, module in imports:
                for forbidden_prefix, desc in rules:
                    if module.startswith(forbidden_prefix):
                        rel = filepath.relative_to(PROJECT_ROOT)
                        violations.append(f"  {rel}:{lineno} — {desc}（import {module}）")

    return violations


def main():
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    py_files = sorted(APP_DIR.rglob("*.py"))

    if verbose:
        print(f"扫描 {len(py_files)} 个 Python 文件...\n")

    violations = []
    for f in py_files:
        violations.extend(check_file(f))

    if violations:
        print("❌ 分层依赖违规：\n")
        for line in violations:
            print(line)
        print(f"\n共 {len(violations)} 处违规，架构检查未通过")
        sys.exit(1)
    else:
        print("✅ 架构检查通过")
        if verbose:
            print(f"   已检查 {len(py_files)} 个文件，无分层违规")
        sys.exit(0)


if __name__ == "__main__":
    main()
