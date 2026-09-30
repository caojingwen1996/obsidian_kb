# Feed Workflow

## 1. Purpose

`feed` mode processes articles, morning briefs, research reports, news summaries, or other mixed information supplied by the user.

The mode is **stateless at the workflow level**. Each run analyzes only the current `FeedContent` and does not retrieve, compare, merge, or update objects from previous runs.

Its responsibility is to transform the current input into structured information:

```text
Event
→ Signal
→ Cluster
→ Theme
→ Core Findings
→ InformationProcessingResult
```

Historical storage, cross-run memory, longitudinal tracking, and temporal comparison are outside this workflow.

---

## 2. Entry Conditions

```text
mode = feed
input = FeedContent
```

Input may include:

```text
text
article
report
news summary
mixed information
```

`feed` mode uses the supplied content as its primary processing scope.

It does not actively expand into a full-market scan.

Necessary source verification may be performed only when a key fact is missing, conflicting, ambiguous in time or value, or lacks required context. Such verification supports the current run and does not create historical memory.

---

## 3. Stateless Boundary

The workflow may use only information available to the current run:

```text
current FeedContent
+ source-backed context required to interpret it
```

The workflow must not require:

```text
historical Signal store
historical Cluster store
historical Theme store
cross-run object matching
cross-run state updates
longitudinal persistence tracking
memory retrieval
```

Any future historical-memory capability should be implemented outside this workflow and consume `InformationProcessingResult` as an input.

---

## 4. Main Workflow

```text
INPUT FeedContent

content = NormalizeInput(FeedContent)

events = ExtractEvents(content)

FOR event IN events:

    IF NeedsEventAnalysis(event):
        event = RunEventAnalysis(event)

signals = ExtractSignals(events)

clusters = BuildClusters(signals)

themes = SynthesizeThemes(clusters)

core_findings = GenerateCoreFindings(
    events,
    signals,
    clusters,
    themes
)

result = BuildInformationProcessingResult(
    events,
    signals,
    clusters,
    themes,
    core_findings
)

RETURN result
```

---

## 5. Input Normalization

```text
NormalizeInput()

    normalize time expressions
    normalize entity names
    normalize units
    preserve source information
    remove obvious duplicate fragments within current input
    preserve original context
```

Do not remove information required for source traceability.

Deduplication is limited to the current input.

---

## 6. Event Extraction

```text
events = ExtractEvents(content)
```

For each information fragment:

```text
identify factual statement

IF independently meaningful fact exists:
    create Event

ELSE:
    preserve as context / fragment
```

Apply Event split and merge rules within the current feed as required.

Methodology:

```text
references/event-extraction.md
```

Object structure:

```text
schemas/event.schema.json
```

---

## 7. Event Analysis

Event Analysis is optional.

```text
FOR event IN events:

    IF event is a key turning point
       AND pre-event expectation can be identified from current-run evidence
       AND post-event reaction / repricing is observable:

        RunEventAnalysis(event)
```

Event Analysis may include:

```text
core question
pre-event expectation
actual result
surprise
immediate reaction
repricing
changed variables
```

Event Analysis remains part of the Event object.

Methodology:

```text
references/event-extraction.md
```

---

## 8. Signal Extraction

```text
signals = ExtractSignals(events)
```

For each Event:

```text
identify meaningful variable change

IF direct factual change exists:
    create Fact Signal

IF event_analysis contains observable repricing:
    create Repricing Signal
```

Signal extraction should identify:

```text
variable
direction
magnitude
scope
evidence_type
observation_time
```

Signal extraction does not classify a Signal by historical novelty or persistence.

Methodology:

```text
references/signal-extraction.md
```

Object structure:

```text
schemas/signal.schema.json
```

---

## 9. Cluster Formation

```text
clusters = BuildClusters(signals)
```

Cluster formation compares Signals produced in the **current feed only**.

Primary questions:

```text
same_problem?
common_driver?
shared_transmission_structure?
explanatory_compression?
```

Supporting checks may include:

```text
same_variable?
same_direction?
same_subject?
same_time_window?
```

Decision logic:

```text
FOR related Signal groups in current feed:

    IF multiple Signals form a coherent explanatory structure:
        create Cluster

    ELSE:
        keep Signals isolated
```

Do not query or compare against Clusters from previous runs.

For each accepted Cluster:

```text
build Structure View
build Timeline View when timestamps support it
evaluate current-run evidence strength
evaluate confidence
```

Methodology:

```text
references/clustering.md
```

Object structure:

```text
schemas/cluster.schema.json
```

---

## 10. Theme Synthesis

```text
themes = SynthesizeThemes(clusters)
```

Compare Clusters created in the current run and evaluate:

```text
common_question?
common_variables?
common_driver?
shared_transmission_structure?
directional_relationship?
explanatory_compression?
```

If multiple Clusters support a meaningful higher-level structure:

```text
create Theme
```

If evidence is insufficient:

```text
do not create Theme
preserve Clusters independently
```

Theme creation does not depend on historical persistence or previous Theme state.

Methodology:

```text
references/theme-synthesis.md
```

Object structure:

```text
schemas/theme.schema.json
```

---

## 11. Core Findings

```text
core_findings = GenerateCoreFindings(...)
```

Select the information conclusions most worth retaining from the current run.

Each Core Finding should be traceable to supporting:

```text
Event
Signal
Cluster
Theme
```

A Core Finding may also be supported directly by strong Signals or Clusters when no Theme is formed.

Core Findings remain at the information-synthesis layer.

Do not generate:

```text
risk score
investment recommendation
trade direction
valuation conclusion
historical trend conclusion without current-run evidence
```

---

## 12. Build Result

```text
result = InformationProcessingResult
```

The canonical output structure is defined in:

```text
schemas/information-processing-result.schema.json
```

The result may contain:

```text
summary
core_findings
events[]
signals[]
clusters[]
themes[]
isolated_signals[]
```

All objects belong to the current run.

---

## 13. User-Facing Presentation

After the canonical result is generated, derive the user-facing response from it.

Default presentation for `feed` mode:

```text
1. Summary
   - key Signals
   - Clusters formed in this feed
   - Themes formed in this feed
   - isolated Signals
   - information insufficient for higher-level synthesis

2. Core Findings
   - the most important information conclusions from this run
```

The structured `InformationProcessingResult` remains the canonical output.

---

## 14. End-to-End Flow

```text
FeedContent
    ↓
NormalizeInput
    ↓
Event Extraction
    ↓
Optional Event Analysis
    ↓
Signal Extraction
    ↓
Current-Feed Signal Clustering
    ↓
Current-Feed Theme Synthesis
    ↓
Core Findings
    ↓
InformationProcessingResult
    ↓
Summary + Core Findings
```

---

## 15. Design Principle

`feed` mode performs **single-run information compression**.

Conceptually:

```text
What happened?
    ↓
Event
    ↓
What changed?
    ↓
Signal
    ↓
Which changes belong together?
    ↓
Cluster
    ↓
What higher-level issue do those Clusters describe?
    ↓
Theme
    ↓
What is worth retaining from this run?
    ↓
Core Findings
```

Historical memory and cross-run temporal analysis can be added later as separate capabilities that consume this workflow's output.
