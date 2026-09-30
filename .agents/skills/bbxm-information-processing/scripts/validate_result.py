"""Validate feed/theme contracts and references; does not verify factual truth."""

import argparse
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource


SCHEMA_DIR = Path(__file__).resolve().parents[1] / "schemas"
SCHEMA_PATH = SCHEMA_DIR / "information-processing-result.schema.json"


def validate_result(result):
    registry = Registry()
    for path in sorted(SCHEMA_DIR.glob("*.schema.json")):
        schema = json.loads(path.read_text(encoding="utf-8-sig"))
        Draft202012Validator.check_schema(schema)
        registry = registry.with_resource(schema["$id"], Resource.from_contents(schema))
    is_theme = isinstance(result, dict) and result.get("mode") == "theme"
    schema_path = SCHEMA_DIR / "theme-processing-result.schema.json" if is_theme else SCHEMA_PATH
    schema = json.loads(schema_path.read_text(encoding="utf-8-sig"))
    validator = Draft202012Validator(schema, registry=registry, format_checker=FormatChecker())
    errors = [
        f"{'/'.join(map(str, error.absolute_path)) or '$'}: {error.message}"
        for error in validator.iter_errors(result)
    ]
    if errors:
        return errors
    if is_theme:
        return validate_theme_references(result)

    collections = {
        "event": ("events", "event_id"),
        "signal": ("signals", "signal_id"),
        "cluster": ("clusters", "cluster_id"),
        "theme": ("themes", "theme_id"),
        "finding": ("core_findings", "finding_id"),
        "handoff": ("risk_identification_handoff", "handoff_id"),
    }
    objects = {}
    for kind, (field, id_field) in collections.items():
        items = result.get(field, [])
        ids = [item[id_field] for item in items]
        if len(ids) != len(set(ids)):
            errors.append(f"{field}: duplicate {id_field}")
        objects[kind] = {item[id_field]: item for item in items}

    def refs(values, kind, label, allowed=None):
        if len(values) != len(set(values)):
            errors.append(f"{label}: duplicate references")
        valid = objects[kind] if allowed is None else allowed
        if set(values) - set(valid):
            errors.append(f"{label}: unresolved or out-of-cluster references")

    def optional_ref(item, field, kind, label):
        if item.get(field) is not None:
            refs([item[field]], kind, f"{label}/{field}")

    for signal in result.get("signals", []):
        label = signal["signal_id"]
        refs(signal["event_refs"], "event", f"{label}/event_refs")
        if signal["signal_type"] == "repricing":
            analyses = [
                objects["event"].get(ref, {}).get("event_analysis") or {}
                for ref in signal["event_refs"]
            ]
            if not any((analysis.get("repricing") or "").strip() for analysis in analyses):
                errors.append(f"{label}: repricing signal requires Event Analysis repricing")

    for cluster in result.get("clusters", []):
        label = cluster["cluster_id"]
        refs(cluster["member_events"], "event", f"{label}/member_events")
        refs(cluster["member_signals"], "signal", f"{label}/member_signals")
        for entry in cluster["timeline"]:
            kind = entry["type"]
            members = cluster["member_events" if kind == "event" else "member_signals"]
            refs([entry["ref_id"]], kind, f"{label}/timeline", members)

    for theme in result.get("themes", []):
        label = theme["theme_id"]
        refs(theme["cluster_refs"], "cluster", f"{label}/cluster_refs")
        if len(set(theme["cluster_refs"])) == 1 and theme["status"] != "emerging":
            errors.append(f"{label}: a single-cluster theme must be emerging")
        count = (theme.get("evidence_state") or {}).get("supporting_cluster_count")
        if count is not None and count != len(set(theme["cluster_refs"])):
            errors.append(f"{label}: supporting_cluster_count disagrees with cluster_refs")

    for finding in result["core_findings"]:
        label = finding["finding_id"]
        for kind in ("event", "signal", "cluster"):
            refs(finding.get(f"supporting_{kind}_refs", []), kind, label)
        optional_ref(finding, "theme_ref", "theme", label)
        theme = objects["theme"].get(finding.get("theme_ref"))
        if theme:
            for field, theme_field in (("theme_status", "status"),
                                       ("current_direction", "current_direction")):
                if finding.get(field) is not None and finding[field] != theme[theme_field]:
                    errors.append(f"{label}/{field}: disagrees with referenced theme")

    handoffs = result.get("risk_identification_handoff", [])
    for handoff in handoffs:
        label = handoff["handoff_id"]
        optional_ref(handoff, "theme_ref", "theme", label)
        optional_ref(handoff, "finding_ref", "finding", label)
        refs(handoff.get("supporting_cluster_refs", []), "cluster", label)

    summary = result["summary"]
    for field, kind, count_field in (
        ("forming_theme_refs", "theme", "forming_theme_count"),
        ("updated_existing_theme_refs", "theme", "updated_existing_theme_count"),
        ("isolated_signal_refs", "signal", "isolated_signal_count"),
    ):
        if field in summary:
            refs(summary[field], kind, f"summary/{field}")
            if summary[count_field] != len(summary[field]):
                errors.append(f"summary/{count_field}: disagrees with {field}")
    for ref in summary.get("forming_theme_refs", []):
        theme = objects["theme"].get(ref)
        if theme and theme["status"] not in ("emerging", "forming"):
            errors.append(f"summary/forming_theme_refs: {ref} is not emerging or forming")
    if "insufficient_for_theme_refs" in summary:
        entries = summary["insufficient_for_theme_refs"]
        keys = [(entry["ref_type"], entry["ref_id"]) for entry in entries]
        if len(keys) != len(set(keys)):
            errors.append("summary/insufficient_for_theme_refs: duplicate references")
        for entry in entries:
            refs([entry["ref_id"]], entry["ref_type"], "summary/insufficient_for_theme_refs")
        if summary["insufficient_for_theme_count"] != len(entries):
            errors.append("summary/insufficient_for_theme_count: disagrees with references")
    if summary["risk_identification_handoff_count"] != sum(h["eligible"] for h in handoffs):
        errors.append("summary/risk_identification_handoff_count: disagrees with eligible handoffs")
    for kind in ("event", "signal"):
        if summary[f"new_{kind}_count"] > len(objects[kind]):
            errors.append(f"summary/new_{kind}_count: exceeds included objects")
    return errors


def validate_theme_references(result):
    """Cross-object checks after the theme schema has validated field shapes."""
    errors = []
    objects = {}
    for field, key in (("events", "event_id"), ("signals", "signal_id"),
                       ("clusters", "cluster_id"), ("evidence", "evidence_id"),
                       ("findings", "finding_id")):
        items = result.get(field, [])
        objects[field] = {item[key]: item for item in items}
        if len(items) != len(objects[field]):
            errors.append(f"{field}: duplicate {key}")
        count = "evidence_count" if field == "evidence" else f"{field[:-1]}_count"
        if result["summary"][count] != len(items):
            errors.append(f"summary/{count}: disagrees with {field}")
    if result["summary"]["gap_count"] != len(result["gaps"]):
        errors.append("summary/gap_count: disagrees with gaps")

    def refs(values, allowed, label):
        if set(values) - set(allowed):
            errors.append(f"{label}: unresolved references")

    for signal in result["signals"]:
        refs(signal["event_refs"], objects["events"], signal["signal_id"])
        if signal["signal_type"] == "repricing":
            analyses = [(objects["events"].get(ref, {}).get("event_analysis") or {})
                        for ref in signal["event_refs"]]
            if not any((a.get("repricing") or "").strip() for a in analyses):
                errors.append(f"{signal['signal_id']}: repricing requires Event Analysis")

    for cluster in result.get("clusters", []):
        events = cluster.get("member_events", [])
        signals = cluster["member_signals"]
        refs(events, objects["events"], cluster["cluster_id"])
        refs(signals, objects["signals"], cluster["cluster_id"])
        for link in cluster["structure_view"]:
            refs(link["supporting_refs"], events + signals, "cluster/structure_view")
        for entry in cluster.get("timeline", []):
            refs([entry["ref_id"]], events if entry["type"] == "event" else signals,
                 "cluster/timeline")

    variables = result["theme_context"]["core_variables"]
    mapped_events, mapped_signals = set(), set()
    for evidence in result["evidence"]:
        refs([evidence["variable"]], variables, "evidence/variable")
        refs(evidence.get("event_refs", []), objects["events"], evidence["evidence_id"])
        refs(evidence.get("signal_refs", []), objects["signals"], evidence["evidence_id"])
        mapped_events.update(evidence.get("event_refs", []))
        mapped_signals.update(evidence.get("signal_refs", []))
    for ref in mapped_signals:
        mapped_events.update(objects["signals"].get(ref, {}).get("event_refs", []))
    refs(objects["events"], mapped_events, "events without evidence mapping")
    refs(objects["signals"], mapped_signals, "signals without evidence mapping")
    for finding in result["findings"]:
        refs(finding["evidence_refs"], objects["evidence"], finding["finding_id"])
    for gap in result["gaps"]:
        refs([gap["variable"]], variables, "gaps/variable")
    covered = {item["variable"] for item in result["evidence"] + result["gaps"]}
    refs(variables, covered, "uncovered core_variables")
    if result["observation_window"]["start"] > result["observation_window"]["end"]:
        errors.append("observation_window: start is after end")
    if result["events"] and not any(row["status"] == "success" for row in result["search_log"]):
        errors.append("search_log: events require at least one successful source retrieval")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("result", type=Path)
    args = parser.parse_args()
    try:
        result = json.loads(args.result.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as error:
        parser.exit(1, f"Cannot read result: {error}\n")
    errors = validate_result(result)
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print(f"{result['mode']} result valid (structure, references and checkable counts only).")


if __name__ == "__main__":
    main()
