# Clustering Reference

## 1. Purpose

Define how related Events and Signals are grouped into coherent Clusters.

A **Cluster** is a structured aggregation unit at the event layer.

It groups Events and Signals that appear to belong to the same event process, variable movement, driver, subject, or transmission structure.

The formal object structure is defined in:

`schemas/cluster.schema.json`

---

## 2. Core Model

```text
Events / Signals
      ↓
Relationship Detection
      ↓
Cluster
      ├── Structure View
      └── Timeline View
```

Core question:

> Which Events and Signals belong to the same event process?

---

## 3. Cluster Boundary

Cluster remains at the event layer.

It should organize:

```text
related Events
related Signals
relationships
time range
timeline
```

It should not itself perform:

```text
pre-event expectation analysis
actual-vs-expected analysis
surprise analysis
post-event repricing analysis
```

Those belong to `Event.event_analysis`.

Cluster may reference Signals produced from such analysis.

---

## 4. Relationship Types

Events and Signals may enter the same Cluster through one or more relationships.

### Same Variable

```text
Brent ↓
WTI ↓
Dubai crude ↓
```

→ `crude_oil_price`

### Same Direction

```text
2Y yield ↓
10Y yield ↓
real yield ↓
```

→ interest-rate pressure easing

### Same Driver

```text
OPEC production cut
shipping disruption
inventory draw
```

→ oil supply tightening

### Same Subject

```text
Microsoft CapEx ↑
Microsoft GPU purchases ↑
Microsoft data-center leases ↑
```

### Same Time Window

Multiple observations appear within the same bounded period.

Time proximity alone is insufficient.

At least one additional meaningful relationship should normally exist.

### Transmission Link

```text
oil_price ↑
    ↓
inflation_expectation ↑
    ↓
long_term_yield ↑
```

The transmission relation should be supported by evidence.

---

## 5. Signal Entry Logic

```text
FOR each Signal:

    compare with existing Clusters

    IF meaningful relationship exists:
        add Signal to matching Cluster

    ELSE:
        create a new weak Cluster
```

Compare using:

```text
same_variable?
same_direction?
same_driver?
same_subject?
same_time_window?
transmission_link?
```

A Signal may belong to more than one Cluster when it legitimately participates in multiple structures.

---

## 6. Event Entry Logic

Events may enter a Cluster directly when they:

- provide factual origin of Signals;
- explain a shared driver;
- mark a turning point;
- provide context required by the event process;
- belong directly to the same event sequence.

Events should remain traceable through `event_ref`.

---

## 7. Cluster Strength

Suggested levels:

```text
weak
moderate
strong
```

Possible considerations:

- number of independent Signals;
- number of supporting Events;
- source diversity;
- evidence-type diversity;
- directional consistency;
- persistence;
- cross-market confirmation;
- time continuity;
- transmission coherence.

Avoid fixed numeric thresholds unless explicitly calibrated.

---

## 8. Independence

Repeated reporting of the same underlying fact should strengthen confidence in that Event while still counting as one underlying fact.

Example:

```text
Reuters reports OPEC cut
Bloomberg reports the same OPEC cut
CNBC repeats Reuters
```

This may strengthen Event confidence.

It should not create three independent Signals.

---

## 9. Weak Cluster

Keep a Cluster weak when:

- only one meaningful Signal exists;
- relationships are loose;
- the common variable is unclear;
- evidence comes from repeated reporting of one fact;
- directions conflict;
- time continuity is absent;
- transmission depends heavily on inference.

Weak Clusters may remain as emerging event structures.

---

## 10. Conflicting Signals

Related Signals do not need to share one direction.

Example:

```text
oil_price ↑
freight_cost ↓
inflation_expectation flat
```

Possible representation:

```text
common_variable = inflation_pressure
common_direction = mixed
strength = weak
```

If mechanisms are materially different, split into separate Clusters.

---

## 11. Cluster Boundary Quality

Prefer narrow and interpretable Clusters.

Weak:

```text
Global macro conditions
```

Better:

```text
energy_price_pressure
long_term_rate_repricing
ai_capex_demand
credit_tightening
```

Cluster should stay close to observable event structures.

---

## 12. Structure View

Structure View explains why members belong together.

Example:

```text
OPEC cut
   ↓
oil supply tightening
   ↓
oil price ↑
   ↓
inflation expectation ↑
```

Structure View answers:

> Why are these Events and Signals related?

---

## 13. Timeline View

Every Cluster SHOULD provide a chronological timeline when valid timestamps exist.

Generation:

```text
Cluster Members
    ↓
extract timestamps
    ↓
normalize time
    ↓
sort chronologically
    ↓
Timeline
```

Suggested timeline stages:

```text
background
pre_event
key_event
immediate_reaction
repricing
confirmation
reversal
follow_up
```

These stage labels describe placement on the timeline.

They do not recreate Event Analysis inside the Cluster.

Example:

```text
09-18
OPEC releases production-cut signal
[Event / key_event]

↓
09-19
Brent rises 5%
[Signal / immediate_reaction]

↓
09-20
5Y breakeven rises
[Signal / repricing]

↓
09-21
10Y Treasury yield rises
[Signal / confirmation]
```

Timeline View answers:

> How did this event process evolve through time?

---

## 14. Cross-Market Confirmation

Cross-market observations can strengthen a Cluster.

Example:

```text
oil ↓
breakeven inflation ↓
10Y yield ↓
growth stocks ↑
```

Cross-market confirmation may increase:

```text
strength
confidence
```

It does not automatically create a Theme.

---

## 15. Cluster State

Suggested values:

```text
emerging
forming
established
weakening
dissolving
uncertain
```

State describes the maturity of the event structure.

---

## 16. Quality Check

Before accepting a Cluster, verify:

- What connects these Events and Signals?
- Is the relationship observable or inferred?
- Is there a clear common variable, driver, or event process?
- Are sources sufficiently independent?
- Is direction consistent or explicitly mixed?
- Does time continuity support grouping?
- Is a transmission relation evidence-backed?
- Should the Cluster be split?
- Is the Cluster narrow enough to remain interpretable?
- Can its timeline be reconstructed?

---

## 17. Output Principle

A good Cluster provides:

```text
Structure
+
Timeline
```

and answers:

> Which related Events and Signals form the same event process?
