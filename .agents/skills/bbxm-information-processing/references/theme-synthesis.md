# Theme Synthesis Reference

## 1. Purpose

Define how multiple Clusters are synthesized into higher-level Themes.

A **Theme** is a persistent core question or explanatory structure synthesized from multiple related Clusters.

It describes the higher-level issue that those event processes collectively point toward.

The formal object structure is defined in:

`schemas/theme.schema.json`

---

## 2. Core Model

```text
Clusters
    ↓
Find common variables
    ↓
Find common drivers
    ↓
Find shared transmission structure
    ↓
Identify common core question
    ↓
Evaluate explanatory compression
    ↓
Theme Candidate
    ↓
Additional Cluster support
    ↓
Theme
```

Core question:

> What higher-level issue are these Clusters collectively describing?

---

## 3. Theme Definition

Theme moves beyond a single event process.

Conceptually:

```text
Event
= single fact

Signal
= variable change

Cluster
= event process

Theme
= persistent core question / explanatory structure
```

Theme should be able to absorb multiple independent Clusters over time.

---

## 4. Theme Formation Dimensions

Evaluate whether multiple Clusters share a higher-level structure using the following dimensions.

### 4.1 Common Question

Ask:

> Are these Clusters repeatedly answering the same higher-level question?

This is the strongest Theme criterion.

Example:

```text
Can high interest rates continue to constrain AI-driven growth assets?
```

---

### 4.2 Common Variables

Ask:

> Do these Clusters repeatedly involve the same core variables?

Example:

```text
energy
inflation
long-term rates
growth valuation
```

---

### 4.3 Common Driver

Ask:

> Do the Clusters share a common underlying driver?

Examples:

```text
energy shock
monetary policy
AI capital expenditure cycle
credit tightening
```

---

### 4.4 Shared Transmission Structure

Ask:

> Can the Clusters be connected through one coherent transmission structure?

Example:

```text
energy
→ inflation
→ rates
→ valuation
```

---

### 4.5 Directional Relationship

Clusters may:

```text
reinforce
weaken
reverse
reframe
```

the same Theme.

They do not need to move in one direction forever.

A reversal may be especially informative.

---

### 4.6 Explanatory Compression

Ask:

> Can one higher-level question explain several otherwise separate Clusters?

A useful Theme should reduce complexity without hiding important differences.

---

## 5. Theme Candidate

Create a Theme Candidate when a common higher-level structure is visible but evidence is still incomplete.

Suggested states:

```text
emerging
forming
established
weakening
uncertain
```

A Theme Candidate is appropriate when:

- only a small number of Clusters support it;
- common question is plausible but still broad;
- cross-market confirmation is limited;
- persistence has not yet been established.

---

## 6. Theme Naming

Theme names should describe a persistent issue or explanatory structure.

Preferred:

```text
High-rate pressure on growth assets
AI expansion sustainability under high funding costs
Energy-driven inflation pressure
Credit tightening and demand slowdown
```

Avoid:

```text
Bullish
Bearish
Good news
Bad news
Market risk
```

Theme naming should remain descriptive.

---

## 7. Core Question

Every Theme SHOULD contain one explicit `core_question`.

Examples:

```text
Will high rates continue to constrain growth-asset valuations?

Can AI demand remain strong enough to justify continued CapEx expansion?

Is energy inflation pressure becoming persistent enough to alter the rate path?
```

The core question gives the Theme a stable organizing center.

---

## 8. Supporting Clusters

Theme should reference the Clusters that support it.

Example:

```text
Cluster A:
FOMC repricing

Cluster B:
10Y breaks above 5%

Cluster C:
Energy prices lift inflation expectations

↓
Theme:
High-rate pressure on growth assets
```

A Theme should not be created from one isolated Cluster unless explicitly marked as `emerging`.

---

## 9. Transmission Structure

When relevant, Theme may summarize the higher-level transmission structure connecting Clusters.

Example:

```text
energy pressure
→ inflation expectation
→ long-term rates
→ growth valuation
```

The structure should remain evidence-backed.

---

## 10. Direction

Theme direction describes how the higher-level issue is evolving.

Suggested values:

```text
strengthening
weakening
stable
reversing
mixed
uncertain
```

Direction should be inferred from supporting Clusters.

---

## 11. Evidence State

Theme evidence state may summarize:

```text
number of supporting Clusters
source diversity
cross-market confirmation
time persistence
directional consistency
contradictory evidence
```

Theme confidence should not be based solely on Cluster count.

---

## 12. Uncertainty and Open Questions

Theme should preserve unresolved issues.

Examples:

```text
Is the decline in oil prices persistent?

Will lower yields survive the next inflation release?

Is AI CapEx growth translating into revenue quickly enough?
```

Use:

```text
uncertainties[]
open_questions[]
```

to keep the Theme falsifiable and trackable.

---

## 13. Theme Merge Rules

Merge Theme A and Theme B when:

- they share the same core question;
- they share the same core variables;
- they form adjacent parts of one transmission structure;
- one is clearly a sub-theme of the other;
- merging improves explanatory clarity.

Keep Themes separate when:

- drivers are materially different;
- scopes are materially different;
- common question becomes too broad;
- the relationship is weak or speculative.

---

## 14. Theme Boundary

Theme may describe:

```text
persistent core question
higher-level explanatory structure
shared variables
shared drivers
shared transmission structure
current direction
uncertainty
```

Theme should not decide:

```text
portfolio allocation
trade execution
asset recommendation
risk score
valuation conclusion
```

Those belong to downstream expert analysis.

---

## 15. Quality Check

Before accepting a Theme, verify:

- Do multiple Clusters support it?
- Is there a clear core question?
- Are common variables identifiable?
- Is the common driver evidence-backed?
- Is the transmission structure coherent?
- Does the Theme compress information meaningfully?
- Is it persistent enough to outlive one Event?
- Are contradictions preserved?
- Are open questions explicit?
- Can every claim be traced back to Clusters?

---

## 16. Output Principle

A good Theme answers:

> What persistent higher-level question do these event processes collectively describe?

Conceptually:

```text
Clusters
    ↓
Common Structure
    ↓
Core Question
    ↓
Theme
```
