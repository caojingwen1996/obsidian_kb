"""Validate InformationProcessingResult structure and referential integrity."""

import argparse
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


SCHEMA_PATH = Path(__file__).resolve().parents[1] / "references/output-schema.json"


def validate_result(result):
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = [
        f"{'/'.join(map(str, error.absolute_path)) or '$'}: {error.message}"
        for error in validator.iter_errors(result)
    ]
    if errors:
        return errors

    def unique_ids(items, field, label):
        values = [item[field] for item in items]
        if len(values) != len(set(values)):
            errors.append(f"{label}: duplicate {field}")
        return set(values)

    def check_refs(values, allowed, label, required=False):
        if required and not values:
            errors.append(f"{label}: missing supporting references")
        if set(values) - allowed:
            errors.append(f"{label}: unresolved or out-of-cluster references")

    event_ids = unique_ids(result["events"], "event_id", "events")
    timeline = result["timeline"]["event_ids"]
    if set(timeline) != event_ids:
        errors.append("timeline: must contain every event exactly once")
    key_event = result["context"]["time_window"]["key_event_id"]
    if key_event is not None and key_event not in event_ids:
        errors.append("time_window: unresolved key_event_id")

    clusters = result["induction"]["clusters"]
    unique_ids(clusters, "cluster_id", "clusters")
    all_phenomena = []
    all_variables = []
    for cluster in clusters:
        label = cluster["cluster_id"]
        cluster_events = set(cluster["event_ids"])
        if len(cluster_events) < 2:
            errors.append(f"{label}: a cluster requires at least two events")
        check_refs(cluster["event_ids"], event_ids, label)
        phenomena = cluster["common_phenomena"]
        variables = cluster["core_variables"]
        phenomenon_ids = unique_ids(phenomena, "phenomenon_id", label)
        variable_ids = unique_ids(variables, "variable_id", label)
        all_phenomena.extend(phenomena)
        all_variables.extend(variables)
        if not phenomena:
            errors.append(f"{label}: cluster has no common phenomena")
        for phenomenon in phenomena:
            check_refs(phenomenon["supporting_event_ids"], cluster_events,
                       f"{label}/phenomenon", required=True)
        for variable in variables:
            check_refs(variable["supporting_event_ids"], cluster_events,
                       f"{label}/variable events", required=True)
            check_refs(variable["supporting_phenomenon_ids"], phenomenon_ids,
                       f"{label}/variable phenomena", required=True)
        induction = cluster["induction_result"]
        if not induction["statement"]:
            errors.append(f"{label}: induction statement is empty")
        check_refs(induction["supporting_event_ids"], cluster_events,
                   f"{label}/induction events", required=True)
        check_refs(induction["supporting_variable_ids"], variable_ids,
                   f"{label}/induction variables")
    unique_ids(all_phenomena, "phenomenon_id", "all clusters")
    unique_ids(all_variables, "variable_id", "all clusters")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("result", type=Path)
    args = parser.parse_args()
    result = json.loads(args.result.read_text(encoding="utf-8-sig"))
    errors = validate_result(result)
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("InformationProcessingResult valid (structure and references only).")


if __name__ == "__main__":
    main()
