"""核对三中心UI交付的文档、本地资源及冻结业务文件；不访问网络。"""
from pathlib import Path
from urllib.parse import unquote
import hashlib
import json
import re

root = Path(__file__).resolve().parent.parent
wiki = next(p for p in root.parents if (p / "schema.md").is_file())
errors = []
known_missing = []
# 两处配置入口已在重构前缺失；保留既有入口，单独报告，不豁免其他缺失。
known_targets = {
    ("readme.md", "tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-配置模块产品UI设计/00. 阅读导航"),
    ("06-2-M1信源管理中心UI设计/M1信源管理中心交互原型.html", "../06-1-配置模块产品UI设计/配置模块交互原型.html"),
}
links = 0

def require(condition, message):
    if not condition:
        errors.append(message)


def check_local(condition, file, target, message):
    if condition:
        return
    if (str(file.relative_to(root)), target) in known_targets:
        known_missing.append({"file": str(file.relative_to(root)), "target": target,
                              "scope": "重构前既有缺失的配置模块入口；非本轮三中心资源"})
    else:
        errors.append(message)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


files = [root / n for n in ("DESIGN.md", "PRODUCT.md", "readme.md", "标题区域设计规范.md", "验证/标题区域全页面检查记录.md", "验证/三中心UI重构记录.md")]
modules = sorted(root.glob("06-*-M*"))
for module in modules:
    files.extend(module / n for n in ("DESIGN.md", "00. 阅读导航.md", "验证/原型验证记录.md"))
    files.extend(module.glob("*交互原型.html"))
files.extend((root / "06-3-M2风险源管理中心UI设计/mockups").glob("*.html"))
for file in files:
    content = file.read_text(encoding="utf-8")
    require("\ufffd" not in content, f"替换字符：{file}")
    if file.suffix == ".md":
        require(content.count("```") % 2 == 0, f"代码围栏未闭合：{file}")
        for target in re.findall(r"\[\[([^\]|#]+)", content):
            links += 1
            p = wiki / target
            check_local(p.is_file() or Path(str(p) + ".md").is_file(), file, target, f"缺失双链：{target}")
    else:
        for target in re.findall(r'(?:src|href)="([^"]+)"', content):
            if target.startswith("#"):
                continue
            require(not target.startswith(("http:", "https:")), f"外部资源：{target}")
            check_local((file.parent / unquote(target)).is_file(), file, target, f"缺失资源：{file.name} → {target}")

protection = read_json(root / "三中心业务保护校验.json")
# 后续C01排布允许修改渲染模板；保留统一视觉阶段快照，并核对新增业务保护证据。
layout_path = root / "06-4-M3策略管理中心UI设计/验证/C01业务保护结果.json"
layout = read_json(layout_path) if layout_path.is_file() else None
navigation_path = root / "06-4-M3策略管理中心UI设计/验证/M3子菜单业务保护.json"
navigation = read_json(navigation_path) if navigation_path.is_file() else None
pipeline_path = root / "06-4-M3策略管理中心UI设计/验证/流水线子菜单业务保护.json"
pipeline = read_json(pipeline_path) if pipeline_path.is_file() else None
compact_header_path = root / "06-4-M3策略管理中心UI设计/验证/标题区域精简结果.json"
compact_header = read_json(compact_header_path) if compact_header_path.is_file() else None
unified_path = root / "验证/三中心标题精简业务保护.json"
unified = read_json(unified_path) if unified_path.is_file() else None
unified_m3 = None
unified_styles = {}
if unified:
    unified_m3 = next(i for i in unified["files"] if i["file"].startswith("06-4-") and i["file"].endswith("/app.js"))
    require(unified_m3["before"] == (pipeline or layout)["after"], "Unified header renderer baseline mismatch")
    for key in ("m3_handlers", "m3_initial_data"):
        require(unified[key]["before"] == unified[key]["after"] and unified[key]["unchanged"], "Unified headers modified business logic")
    for item in unified["files"]:
        actual = hashlib.sha256((root / item["file"]).read_bytes()).hexdigest()
        require(actual == item["after"], "Unified header evidence is stale: " + item["file"])
        if item["file"].endswith(".js") and item is not unified_m3:
            require(item["unchanged"], "Unified headers modified a data/business script")
        if item["file"].endswith(("ui-v2.css", "styles.css")):
            unified_styles[item["file"]] = item
if compact_header:
    require(compact_header["stylesheet"]["before"] == (pipeline or navigation or layout)["stylesheet"]["after"], "Compact header stylesheet baseline mismatch")
    for item in compact_header["protected"]:
        actual = hashlib.sha256((compact_header_path.parent.parent / item["file"]).read_bytes()).hexdigest()
        if unified_m3 and item["file"].endswith("/app.js"):
            require(item["after"] == unified_m3["before"] and actual == unified_m3["after"], "Unified header renderer mismatch")
        else:
            require(actual == item["before"] == item["after"] and item["unchanged"], "Compact header modified business scripts")
if pipeline:
    require(layout and pipeline["before"] == layout["after"], "Pipeline script baseline mismatch")
    require(navigation and pipeline["stylesheet"]["before"] == navigation["stylesheet"]["after"], "Pipeline CSS baseline mismatch")
    for key in ("business_handlers", "initial_data"):
        require(pipeline[key]["before"] == pipeline[key]["after"] and pipeline[key]["unchanged"], "Unexpected business change")
if navigation:
    require(layout and navigation["stylesheet"]["before"] == layout["stylesheet"]["after"], "侧栏样式基线与C01不一致")
    for item in navigation["protected"]:
        actual = hashlib.sha256((navigation_path.parent.parent / item["file"]).read_bytes()).hexdigest()
        if pipeline and item["file"].endswith("/app.js"):
            require(item["after"] == pipeline["before"] and actual == (unified_m3 or pipeline)["after"], "Pipeline script protection mismatch")
        else:
            require(actual == item["before"] == item["after"] and item["unchanged"], "Unexpected business file change")
unchanged_javascript = 0
stale_metadata = []
require(len(protection["javascript"]) == 6, "应有六份冻结业务文件")
for item in protection["javascript"]:
    actual = hashlib.sha256((root / item["file"]).read_bytes()).hexdigest()
    if layout and item["file"] == layout["renderer"]:
        require(actual == (unified_m3 or pipeline or layout)["after"] and item["before"] == layout["before"], "C01渲染文件与核对报告不一致")
        require(all(p["before"] == p["after"] and p["unchanged"] for p in layout["protected"]), "C01业务区段发生变化")
        require(layout["flow_data"]["unchanged"], "C01领域数据发生变化")
    else:
        require(actual == item["before"] == item["after"] and item["unchanged"], f"业务文件变化：{item['file']}")
        unchanged_javascript += 1

passed = []
for module, expected in zip(modules, [25, 201, 93]):
    report = read_json(module / "验证/原型验证结果.json")
    count = report.get("passed", report.get("count"))
    require(count == expected and not report["errors"], f"交互检查未通过：{module.name}")
    passed.append(count)
visual = read_json(root / "验证/三中心UI验证结果.json")
require(visual["viewportChecks"] == 48 and len(visual["viewports"]) == 48, "视口检查应为48次")
require(len(visual["captures"]) == 37, "应有37张视觉截图")
require(len(visual["checks"]) == 6, "应有六项导航/外壳检查")
require(not visual["errors"] and not visual["network"], "跨中心检查出现异常或外网请求")
for name in visual["captures"]:
    file = root / "验证/三中心截图" / name
    require(file.is_file() and file.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"), f"无效截图：{name}")

for file in [root / ".impeccable/design.json", *[m / ".impeccable/design.json" for m in modules[:2]]]:
    data = read_json(file)
    extension = data["extensions"]
    for key in ("design", "sidecar", "localStylesheet"):
        target = extension.get("inheritance", {}).get(key)
        if target:
            require((file.parent / target).is_file(), f"元数据路径缺失：{target}")
    for item in extension.get("sourceEvidence", []):
        actual = hashlib.sha256((root / item["file"]).read_bytes()).hexdigest()
        if actual != item["sha256"] and item["file"] in unified_styles:
            require(actual == unified_styles[item["file"]]["after"], "Unified header stylesheet evidence mismatch")
            stale_metadata.append({"file": item["file"], "scope": "紧凑标题规范已更新，工具侧车保留历史，未自动刷新"})
        elif actual != item["sha256"] and layout and item["file"] == layout["stylesheet"]["file"]:
            require(actual == (compact_header or pipeline or navigation or layout)["stylesheet"]["after"], "当前样式与记录不一致")
            stale_metadata.append({"file": item["file"], "scope": "C01布局更新，保留旧设计侧车，不在本轮自动刷新"})
        else:
            require(actual == item["sha256"], f"设计元数据证据已过期：{item['file']}")
result = {"date": "2026-10-16", "files_checked": len(files), "local_links": links,
          "unchanged_javascript": unchanged_javascript, "presentation_file_changed": bool(layout), "interaction_checks": sum(passed), "viewport_checks": 48,
          "navigation_shell_checks": 6, "screenshots": 37, "visual_evidence_scope": "三中心紧凑标题本轮重新验证，最新流水线手机截图另存", "stale_design_metadata": stale_metadata, "known_preexisting_missing": known_missing, "errors": errors}
title_path = root / "验证/标题区域逐页检查-复验.json"
if title_path.is_file():
    title = read_json(title_path)
    require(not title["errors"] and not title["network"] and not title["navigationFailures"], "标题逐页检查运行异常")
    require(title["order"] == ["M1", "M2", "M3"] and title["widths"] == [1440, 390, 320], "标题检查顺序或视口不符")
    for module, expected in zip(["M1", "M2", "M3"], [68, 67, 271]):
        for width in title["widths"]:
            rows = [r for r in title["records"] if r["module"] == module and r["width"] == width]
            require(len(rows) == expected and all(not r["failures"] for r in rows), "标题页面覆盖缺失或未通过：" + module)
    for row in title["records"]:
        if row.get("screenshot"):
            require((title_path.parent / row["screenshot"]).is_file(), "标题截图缺失")
    title_protection = read_json(root / "验证/标题区域业务保护.json")
    require(title_protection["business_unchanged"], "标题检查修改业务脚本")
    parallel_changes = {c["file"]: c for c in title_protection.get("parallel_ui_changes", [])}
    for item in title_protection["files"]:
        actual = hashlib.sha256((root / item["file"]).read_bytes()).hexdigest()
        parallel = parallel_changes.get(item["file"])
        if parallel:
            require(item["after"] == parallel["title_after"] and actual == parallel["after"], "并行界面改动证据过期：" + item["file"])
        else:
            require(actual == item["after"], "标题业务保护证据过期：" + item["file"])
        if item["file"].endswith((".html", ".js")):
            require(item["unchanged"] and item["before"] == item["after"], "标题检查改变HTML/业务脚本：" + item["file"])
    current_app = (root / "06-4-M3策略管理中心UI设计/原型资源/app.js").read_text(encoding="utf-8")
    regions = {"initial_data": current_app.split("let state=")[0], "business_submit": current_app[current_app.index("document.addEventListener('submit'"):]}
    for key, region in regions.items():
        proof = title_protection["current_business_regions"][key]
        require(hashlib.sha256(region.encode()).hexdigest() == proof["before"] == proof["after"] and proof["unchanged"], "并行改动影响业务区域：" + key)
    result["title_audit"] = {"state_viewport_checks": len(title["records"]), "screenshots": sum(bool(r.get("screenshot")) for r in title["records"]), "business_unchanged": title_protection["business_unchanged"]}
if layout:
    current = read_json(layout_path.parent / "C01排布验证结果.json")
    require(not current["errors"] and not current["network"], "最新C01检查有异常")
    require(len(current["checks"]) == 45 and current["viewportChecks"] == 37 and len(current["captures"]) == 19, "最新C01检查数量不符")
    result["current_c01"] = {"layout_assertions": len(current["checks"]), "viewport_checks": current["viewportChecks"], "screenshots": len(current["captures"])}
(root / "验证/三中心交付检查结果.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(result, ensure_ascii=False))
if errors:
    raise SystemExit(1)
