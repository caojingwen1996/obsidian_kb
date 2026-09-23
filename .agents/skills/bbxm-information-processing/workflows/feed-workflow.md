# Feed Workflow

## 1. Purpose

`feed` 模式用于处理用户已经提供的文章、晨报、研报、新闻摘要或其他混合信息。

该模式以用户提供的信息为主要处理范围，负责将原始信息加工为结构化的：

```text
Event
→ Signal
→ Cluster
→ Theme
→ Core Findings
→ InformationProcessingResult
```

---

## 2. Entry Conditions

```text
mode = feed
input = FeedContent
```

输入可以包括：

```text
text
article
report
news summary
mixed information
```

`feed` 模式默认不主动扩展为全市场扫描。

只有在关键事实缺失、存在明显冲突、时间或数值存在歧义，或缺少必要上下文时，才进行必要的回源补充或核验。

---

## 3. Main Workflow

```text
INPUT FeedContent

content = NormalizeInput(FeedContent)

events = ExtractEvents(content)

FOR event IN events:

    IF NeedsEventAnalysis(event):
        event = RunEventAnalysis(event)

signals = ExtractSignals(events)

clusters = BuildClusters(
    events,
    signals
)

themes = SynthesizeThemes(
    clusters
)

core_findings = GenerateCoreFindings(
    events,
    signals,
    clusters,
    themes
)

risk_handoffs = EvaluateRiskIdentificationHandoff(
    themes,
    core_findings
)

result = BuildInformationProcessingResult(
    events,
    signals,
    clusters,
    themes,
    core_findings,
    risk_handoffs
)

RETURN result
```

---

## 4. Input Normalization

```text
NormalizeInput()

    normalize time expressions
    normalize entity names
    normalize units
    preserve source information
    remove obvious duplicate fragments
    preserve original context
```

Do not remove information that may be required for source traceability.

---

## 5. Event Extraction

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

Apply Event split and merge rules as required.

Methodology:

```text
references/event-extraction.md
```

Object structure:

```text
schemas/event.schema.json
```

---

## 6. Event Analysis

Event Analysis is optional.

```text
FOR event IN events:

    IF event is a key turning point
       AND pre-event expectation can be identified
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

## 7. Signal Extraction

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
novelty
persistence
scope
```

Methodology:

```text
references/signal-extraction.md
```

Object structure:

```text
schemas/signal.schema.json
```

---

## 8. Cluster Formation

```text
clusters = BuildClusters(events, signals)
```

For each Event / Signal:

```text
compare with existing Clusters

check:
    same_variable?
    same_direction?
    same_driver?
    same_subject?
    same_time_window?
    transmission_link?

IF meaningful relationship exists:
    add to matching Cluster

ELSE:
    create weak Cluster
```

For each Cluster:

```text
build Structure View
build Timeline View
evaluate strength
evaluate confidence
update status
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

## 9. Theme Synthesis

```text
themes = SynthesizeThemes(clusters)
```

Compare Clusters and evaluate:

```text
common_question?
common_variables?
common_driver?
shared_transmission_structure?
directional_relationship?
explanatory_compression?
```

If a persistent higher-level structure is visible:

```text
create or update Theme
```

If evidence remains incomplete:

```text
keep as emerging / forming Theme
```

Methodology:

```text
references/theme-synthesis.md
```

Object structure:

```text
schemas/theme.schema.json
```

---

## 10. Core Findings

```text
core_findings = GenerateCoreFindings(...)
```

Select the information conclusions most worth retaining from this run.

Each Core Finding should be traceable to supporting:

```text
Event
Signal
Cluster
Theme
```

Core Findings should remain at the information synthesis layer.

Do not generate:

```text
risk score
investment recommendation
trade direction
valuation conclusion
```

---

## 11. Risk Identification Handoff

```text
risk_handoffs = EvaluateRiskIdentificationHandoff(
    themes,
    core_findings
)
```

Generate a handoff candidate when a Theme or Core Finding has enough structure to justify downstream risk identification.

The handoff only indicates:

```text
whether the object is ready for risk-identification processing
why
which Clusters support it
```

Risk identification itself is outside this workflow.

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
risk_identification_handoff
events[]
signals[]
clusters[]
themes[]
```

---

## 13. User-Facing Presentation

After the canonical result is generated, derive the user-facing response from it.

Default presentation for `feed` mode:

```text
1. Summary
   - new Signals
   - forming Themes
   - updated existing Themes
   - isolated Signals
   - information insufficient to form a Theme
   - Risk Identification handoff candidates

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
Cluster Formation
    ↓
Theme Synthesis
    ↓
Core Findings
    ↓
Risk Identification Handoff
    ↓
InformationProcessingResult
    ↓
Summary + Core Findings
```
