# Signal Extraction Reference

## 1. Purpose

Define how standardized Signals are extracted from Events.

A **Signal** represents a meaningful change in a variable, condition, expectation, behavior, or market pricing.

The formal object structure is defined in:

`schemas/signal.schema.json`

---

## 2. Core Model

```text
Event
    ↓
Identify meaningful change
    ↓
Variable
    ↓
Direction
    ↓
Magnitude
    ↓
Novelty
    ↓
Persistence
    ↓
Scope
    ↓
Signal
```

Core question:

> What variable changed, in what direction, with what strength and informational character?

---

## 3. Signal Types

Signals have two primary types.

### 3.1 Fact Signal

Derived directly from an observable Event.

```text
Event
    ↓
Observed factual change
    ↓
Fact Signal
```

Example:

```text
Brent fell from 105 to 100
→ crude_oil_price ↓
```

### 3.2 Repricing Signal

Derived from the `event_analysis` section of a key Event.

```text
Pre-event expectation
    ↓
Key Event
    ↓
Post-event repricing
    ↓
Repricing Signal
```

Example:

```text
Fed funds futures reduce expected rate cuts after CPI
→ rate_cut_expectation ↓
```

---

## 4. Variable

Variable answers:

> What exactly changed?

Prefer reusable variables.

Examples:

```text
crude_oil_price
inflation_expectation
long_term_yield
rate_cut_expectation
ai_capex_demand
credit_spread
liquidity
earnings_expectation
```

Avoid broad categories such as:

```text
macro news
technology news
market news
```

---

## 5. Direction

Suggested vocabulary:

```text
up
down
stable
improving
deteriorating
tightening
easing
accelerating
decelerating
widening
narrowing
mixed
unknown
```

Choose the expression that matches the variable.

Examples:

```text
credit_spread → widening
liquidity → tightening
demand → improving
yield → up
```

---

## 6. Magnitude

Suggested values:

```text
small
moderate
large
extreme
unknown
```

Magnitude may be judged from:

- absolute change;
- percentage change;
- historical deviation;
- deviation from expectation;
- source-described significance;
- observable market reaction.

Do not invent arbitrary thresholds.

---

## 7. Novelty

Novelty describes how the new Signal relates to recent observations.

Suggested values:

```text
new
continuation
reversal
reconfirmation
unknown
```

Examples:

```text
First CapEx cut in six quarters
→ new

Third consecutive month of slowing inflation
→ continuation

Oil reverses after several weeks of gains
→ reversal

Another hyperscaler raises AI CapEx
→ reconfirmation
```

---

## 8. Persistence

Suggested values:

```text
one_off
short_lived
repeated
persistent
unknown
```

Persistence must be based on observed evidence.

Do not infer durability from one Event.

---

## 9. Scope

Suggested values:

```text
company
industry
sector
market
macro
cross_market
```

Scope describes where the Signal is observable.

---

## 10. Evidence Type

Suggested evidence types:

```text
fundamental
macro_data
policy
market_price
company_action
expectation
flow
positioning
sentiment
```

Evidence type helps later Cluster formation evaluate evidence diversity.

---

## 11. Signal Time

Every Signal should preserve observation time.

For Fact Signals:

```text
normally inherit the Event time
```

For Repricing Signals:

```text
use the time when repricing becomes observable
```

---

## 12. Multiple Signals from One Event

One Event may generate multiple Signals when multiple variables directly change.

Example:

```text
OPEC announces additional production cuts.
```

Possible Signals:

```text
oil_supply → tightening
oil_price_pressure → up
```

Do not automatically extend the full causal chain without evidence.

For example, avoid automatically generating:

```text
inflation → up
10Y yield → up
technology stocks → down
```

unless those changes are directly observed or supported by Event Analysis.

---

## 13. Multiple Repricing Signals from One Event

One key Event with Event Analysis may generate multiple Repricing Signals.

Example:

```text
CPI > consensus
↓
rate-cut expectation ↓
2Y yield ↑
USD ↑
```

Possible Signals:

```text
rate_cut_expectation ↓
short_term_yield ↑
usd_strength ↑
```

Each Signal should remain separately traceable to the Event.

---

## 14. When Not to Generate a Signal

Do not generate a Signal when:

- no meaningful variable changed;
- the information is static background;
- direction cannot be determined;
- the relationship depends mainly on speculation;
- the observed price move cannot reasonably be linked to the Event;
- the supposed change is repeated reporting of the same fact.

---

## 15. Signal Comparison

When comparing a new Signal with prior Signals, examine:

```text
same variable?
same direction?
same driver?
same subject?
same time window?
continuation?
reversal?
reconfirmation?
```

These relationships become inputs to Cluster formation.

---

## 16. Relationship to Clustering

```text
Event
    ↓
Signal Extraction
    ↓
Signals
    ↓
Relationship Detection
    ↓
Cluster
```

Cluster formation may use:

```text
common_variable
common_direction
common_driver
same_subject
same_time_window
transmission_link
```

---

## 17. Quality Check

Before accepting a Signal, verify:

- Which variable changed?
- Is direction evidence-backed?
- Is magnitude grounded in observable information?
- Is novelty correctly classified?
- Is persistence observed or assumed?
- Is scope appropriate?
- Is the Signal traceable to Event?
- Is signal type correctly identified as Fact or Repricing?
- Has unsupported downstream causal inference been excluded?
- Is time represented accurately?

---

## 18. Output Principle

Signal Extraction converts:

```text
What happened?
```

into:

```text
What changed?
```

For key Event Analysis it may also answer:

```text
What was repriced?
```

The Signal should remain standardized, time-aware, traceable, and ready for Cluster formation.
