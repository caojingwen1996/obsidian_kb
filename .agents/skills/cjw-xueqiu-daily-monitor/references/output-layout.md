# Output Layout

Capture files, summaries and intermediate records are organized under the configured output root declared in `EXTEND.md`. Archived sources and final Timeline pages use that file's knowledge-library profile paths.

## Directory layers

```text
{output-root}/
└── {yyyymmdd}/
    └── {author}/
        ├── *.md
        ├── state.json
        ├── task.log
        ├── processing/
        └── summary.md
```

## Author layer

Each author directory stores one account's artifacts for one date:

- `*.md` raw files
- `state.json`
- `task.log`
- `processing/`
- `summary.md`

Rules:

- keep one state file and one log per account-date
- keep raw Markdown files at the author directory root
- keep per-author intermediate analysis under `{yyyymmdd}/{author}/processing/`
- keep the per-author final Markdown at `{yyyymmdd}/{author}/summary.md`

## Per-author processing layer

Intermediate files must live under:

```text
{output-root}/{yyyymmdd}/{author}/processing/
```

Rules:

- keep intermediate artifacts only
- preserve these files for traceability and review
- do not write final Markdown results here

## Capture summary Markdown outputs

The per-author summary lives at:

```text
{output-root}/{yyyymmdd}/{author}/summary.md
```

## Completion check

A correct output root should make it easy to answer:

- where the raw Markdown files were saved
- which intermediate artifacts were generated
- where the final Markdown results live

## Day-level daily brief

In addition to each author's `summary.md`, keep one whole-day brief at:

```text
{output-root}/{yyyymmdd}/daily_brief.md
```

Rules:

- `daily_brief.md` lives under the date root, not inside an author directory
- it is generated after per-author `summary.md` files are complete
- it synthesizes the current date's saved articles across all authors


## Timeline evidence and publication

The existing `{yyyymmdd}/{author}/processing/` directory contains `timeline/` with manifest.json, plan.json, draft Markdown, snapshots, timeline-state.json, capture-hook.json and report.json. These are intermediate artifacts, not final knowledge pages.

Original files outside the configured library sources tree are copied into that profile's `sources/captures/` with immutable version names. Already archived originals are reused. Final pages are written to the profile's timelines directory and linked from that profile's index, as configured in EXTEND.md. Do not create a reading/ queue or mix libraries.

Cross-date prepare discovers candidate states under the configured capture root and the current task's output_root. The author state retains output_root for custom layouts. See [timeline-processing.md](timeline-processing.md) for the complete prepare/apply protocol and retry behavior.
