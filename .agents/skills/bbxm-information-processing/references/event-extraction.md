# Event Extraction Reference

## 1. Purpose

Define how factual Events are extracted from feed content.

An **Event** is the smallest traceable factual unit used by downstream information processing.

This reference answers:

- What counts as an Event?
- What should remain background information?
- When should one source fragment be split into multiple Events?
- When should multiple reports be merged into one Event?
- How should time, source, ambiguity, and conflicting information be represented?
- When should a key Event receive additional Event Analysis?

The formal object structure is defined in:

`schemas/event.schema.json`

---

## 2. Core Model

```text
Raw Information
    ↓
Identify factual statement
    ↓
Identify subject / action / object / time / value / source
    ↓
Check whether the fact is independently meaningful
    ↓
Event
    ↓
IF Event is a key turning point
    ↓
Event Analysis (optional)
```

Core question:

> What actually happened?

---

## 3. Event Definition

An Event describes a factual occurrence, observation, announcement, measurement, or state change.

Examples:

```text
Brent crude fell from 105 to 100.
The Federal Reserve raised its policy rate by 25bp.
Microsoft raised planned AI capital expenditure.
US core CPI rose 0.4% month-on-month.
```

Event extraction should remain close to source facts.

---

## 4. Minimum Event Criteria

Create an Event when the information contains:

1. A recognizable subject or object;
2. A factual action, state, observation, announcement, or measurement;
3. Enough context to distinguish it from unrelated information.

Preferred factual elements:

```text
Who / What
Did what
When
To what
How much
According to which source
```

If one element is missing, preserve the Event when the remaining fact is still independently meaningful.

---

## 5. Event vs Background

Background describes context without a new factual development.

Example:

```text
Inflation has remained elevated for several months.
```

→ Background

Example:

```text
August core CPI rose 0.4% month-on-month.
```

→ Event

Background may be attached to an Event as `context`.

---

## 6. Event Splitting

Split one source fragment into multiple Events when:

- different subjects perform different actions;
- the same subject performs multiple independently meaningful actions;
- facts occur at materially different times;
- one paragraph contains unrelated developments;
- each fact can independently support a downstream Signal.

Example:

```text
Microsoft raised AI CapEx guidance and Nvidia reported stronger GPU orders.
```

Should normally become:

```text
Event A:
Microsoft raised AI CapEx guidance.

Event B:
Nvidia reported stronger GPU orders.
```

---

## 7. Event Merging

Merge reports when they describe the same underlying occurrence.

Typical criteria:

```text
same subject
+ same core action
+ same object
+ same approximate event time
```

After merging:

- preserve all source references;
- preserve material wording differences;
- preserve conflicting values;
- avoid double-counting the same underlying fact.

---

## 8. Time Handling

Every Event should preserve time as accurately as the source allows.

Suggested precision:

```text
exact
minute
hour
day
week
month
unknown
```

Do not infer an exact timestamp from a broad time reference.

---

## 9. Source Traceability

Every Event must remain traceable to source material.

The downstream traceability chain should support:

```text
Theme
→ Cluster
→ Signal
→ Event
→ Source
```

Multiple sources describing the same Event should be retained under `source_refs`.

---

## 10. Conflicting Information

When sources conflict:

```text
keep both claims
↓
mark conflict
↓
preserve sources
↓
adjust confidence if necessary
```

Do not silently resolve factual conflicts without sufficient evidence.

---

## 11. Confidence

Suggested values:

```text
high
medium
low
```

Confidence reflects factual reliability.

Possible considerations:

- primary vs secondary source;
- source independence;
- completeness;
- internal consistency;
- cross-source confirmation.

Confidence does not represent market importance.

---

# 12. Event Analysis

Event Analysis is optional.

Use it only when an Event is a meaningful turning point and understanding the event requires a bounded before/after comparison.

Typical examples:

```text
central-bank decision
inflation release
earnings report
guidance change
policy announcement
major geopolitical escalation
major supply disruption
```

---

## 13. Event Analysis Core Model

```text
Core Question
    ↓
Pre-Event Expectation
    ↓
Key Event
    ↓
Actual vs Expected
    ↓
Surprise
    ↓
Immediate Reaction
    ↓
Repricing
    ↓
Changed Variables
```

Core question:

> What changed around this Event relative to what had already been expected?

---

## 14. Pre-Event Expectation

Capture what was known, expected, or priced before the Event.

Possible fields:

```text
market expectation
prevailing narrative
priced-in conditions
```

Examples:

```text
Consensus expected CPI at 0.2% MoM.
Fed funds futures priced two cuts.
AI CapEx expectations had already been revised upward.
```

Pre-event expectations must be source-backed.

---

## 15. Actual vs Expected

For key Events, compare:

```text
Expected
vs
Actual
```

Example:

```text
Expected CPI: 0.2%
Actual CPI: 0.4%
```

The gap may create a `surprise`.

---

## 16. Surprise

Surprise captures the difference between expectation and realization.

Suggested direction:

```text
positive
negative
mixed
none
unknown
```

Suggested magnitude:

```text
small
moderate
large
extreme
unknown
```

Interpret surprise direction relative to the observed variable or question.

---

## 17. Immediate Reaction and Repricing

Separate the first observable reaction from the broader repricing.

Possible observations:

```text
price reaction
yield reaction
FX reaction
credit reaction
expectation change
analyst revision
narrative change
flow change
```

Repricing asks:

> Which expectation or variable was revalued after the Event?

Examples:

```text
rate-cut expectation ↓
long-term yield ↑
AI demand expectation ↑
inflation expectation ↑
```

---

## 18. Changed Variables

Event Analysis should identify variables whose pricing or expectation changed across the event window.

These changed variables may later become Repricing Signals.

Example:

```text
rate_cut_expectation ↓
long_term_yield ↑
```

---

## 19. Event Analysis Timeline Stages

Optional stage labels:

```text
pre_event
key_event
immediate_reaction
repricing
confirmation
reversal
follow_up
```

These labels can later be reused in Cluster timelines.

---

## 20. Event Boundary

Event extraction and Event Analysis may describe:

```text
facts
expectations
surprises
observable repricing
```

They should not decide:

```text
risk level
investment attractiveness
trade direction
valuation conclusion
```

---

## 21. Quality Check

Before accepting an Event, verify:

- Is it factual?
- Is it independently meaningful?
- Is the subject identifiable?
- Is the action or change clear?
- Is time represented honestly?
- Is the source traceable?
- Should it be split?
- Is it a duplicate?
- Are conflicts preserved?
- Is Event Analysis actually necessary?
- If Event Analysis is used, are expectations and repricing evidence-backed?

---

## 22. Output Principle

A good Event is:

> factual, traceable, time-aware, sufficiently atomic, and suitable for downstream Signal extraction.

A key Event may additionally contain:

> a bounded reconstruction of pre-event expectation, realization, surprise, reaction, and repricing.
