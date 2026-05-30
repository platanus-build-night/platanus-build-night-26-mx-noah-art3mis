# Temporal reasoning & failure modes

**Status:** living doc · **Last updated:** 2026-05-29

Purpose: record the classes of reasoning error VERITRACE's evidence pipeline is prone to — where each one lives in the code, what it is called in the literature, and what we have done or plan to do about it. This started from the "Mencho death" temporal-leakage incident below.

## Incident — "alive on the 18th refutes death on the 22nd"

A claim that *Mencho was killed around 22 February 2026* was marked **refuted** because the classifier read a source, published **18 February**, reporting him alive. Being alive on the 18th is fully consistent with dying on the 22nd, so the source carries no evidence either way — it should have been `contextualizes`. Per the reporting, Mencho *was* killed around the 22nd, so the bug turned a **true** claim into "refuted": a false negative, not just a logic nit.

### Root cause

The classification stage decided stance (`supports` / `refutes` / `contextualizes`) from `domain + title + passage` only. It never saw the source's publication date or the claim's event date — even though both exist in the data model (`EvidenceItem.publishedDate` at `lib/graph-types.ts:18`, `ClaimItem.date` at `lib/graph-types.ts:67`). With no temporal frame, the model mapped *alive → refutes death*. One high/medium-reliability `refutes` with confidence ≥ 0.5 then flips the verdict via the deterministic gate (`lib/pipeline/verdict.ts:22-37`).

### Fix shipped (Part 1)

In `lib/pipeline/classify.ts`: the per-source block now carries `published: <date|unknown>`, the user message states the claim's event date, and the system prompt gained a *temporal-logic* paragraph — for an event/state-change claim (death, killing, seizure, attack, arrest, resignation, collapse), a source published **before** the event date cannot refute it; it is `contextualizes` at most. Standing facts with no single event date are judged normally; undated sources are judged on the passage alone. Regression test in `lib/pipeline/classify.test.ts` ("threads each source's published date and the claim's event date into the prompt").

This is a *prompt-level* fix: the model now has the information and the instruction, but compliance is not guaranteed (especially on Haiku, the default). The structural guarantee is Part 2.

### Not yet done (Part 2 — make it load-bearing)

Add `kind: "event" | "state"` to `ClaimItem` during triage, then a deterministic guard in `verdict.ts` so that for an event claim a `refutes` from a source published strictly before the event date is **not deciding** (only when both dates are known). This matches the "STATED, not learned" philosophy already documented at the top of `verdict.ts`, and is the part that is cleanly unit-testable.

## The general class: temporal leakage

The bug is one instance of **temporal leakage** — using evidence from the wrong point in time relative to the claim. AVeriTeC names this explicitly (evidence that "leaks from the future," e.g. a January claim annotated with March evidence) and lists it alongside *context dependence* and *evidence insufficiency* as the three pitfalls that wreck real-world claim verification. Our variant leaks from the wrong part of the *past*: pre-event evidence applied to an event claim.

## Failure-mode catalogue

Ranked roughly by how likely each is to bite the current demo. Bold = fix before relying on it in front of an audience.

| Trap (lit term)                       | What goes wrong in our domain                                                                                                              | Where in code                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Delayed confirmation vs. window**   | Cartel-boss deaths are confirmed/denied weeks later (DNA, official statements). The `+14d` cutoff excludes the primary source that settles it → stuck at NEI or mislabeled. | `lib/pipeline/resolve.ts:13` `WINDOW_AFTER_DAYS = 14`  |
| **Undated / relative-dated sources**  | Exa's `publishedDate` is optional. When missing, both the new temporal rule and `dateWindow` silently no-op — the guard does not fire. "murió ayer" is never normalized to an absolute date. | `lib/pipeline/classify.ts`, `lib/pipeline/resolve.ts:17-26` |
| **Domain-naive reliability**          | We treat "an authority's denial is refutes with high reliability." In narco coverage, both the state and the cartel lie about a boss's death — official denial ≠ ground truth. | `lib/pipeline/classify.ts:20`                          |
| Wrong-occurrence (event coreference)  | Mencho had prior death/grave-illness rumors. A denial of an *earlier* rumor refutes the *current* claim — same entity + predicate, wrong time. The twin of the original bug. | `lib/pipeline/classify.ts` (stance); only `dateWindow` guards it |
| Recency does not break ties           | `supports + refutes → conflicting` is symmetric. A same-day rumor plus a later official correction should resolve to the correction, not "conflicting." | `lib/pipeline/verdict.ts:37`                           |
| Standing-state temporal validity      | "X leads CJNG" is only true within a window. The new rule correctly judges standing facts "normally" — which leaves their staleness unhandled. | `lib/pipeline/classify.ts` (temporal carve-out)        |
| Modality / hedging / reported speech  | "Authorities are *investigating reports that* X died" ≠ "X died." "Presuntamente" / "según versiones" is a separate axis from "repeats the viral claim." | `lib/pipeline/classify.ts` (stance defs)               |
| Negation scope                        | "No evidence he died" vs "evidence he didn't die" — LLMs flip these. Classic NLI failure.                                                  | `lib/pipeline/classify.ts` (LLM-driven stance)         |
| Entity / alias + translation drift    | Mencho = Nemesio Oseguera Cervantes = "El Mencho"; Spanish source → English claim. Alias/translation mismatch hurts retrieval and stance.  | `lib/pipeline/triage.ts`, `lib/pipeline/expand.ts`     |

Two relatives we already handle well: **over-decontextualization** (the `injected` over-specification audit in `lib/pipeline/audit.ts` is exactly *Molecular Facts*' minimality criterion) and **evidence insufficiency** (NEI-with-reasons instead of guessing).

## Literature

**The exact concept — time-valid evidence**
- AVeriTeC (Schlichtkrull et al., NeurIPS 2023) — names *temporal leakage*; restricts evidence to documents published before the claim. <https://arxiv.org/abs/2305.13117>
- Credible, Unreliable or Leaked? (Akhtar et al., 2024) — evidence verification including leaked / temporally-invalid evidence. <https://arxiv.org/pdf/2404.18971>

**Truth and evidence change over time**
- VitaminC (Schuster et al., NAACL 2021) — claims flip as evidence is revised; contrastive training for sensitivity to that. <https://aclanthology.org/2021.naacl-main.52/>
- TimeQA (Chen et al., NeurIPS 2021) — time-sensitive answers; models score far below humans. <https://arxiv.org/abs/2108.06314>
- SituatedQA (Zhang & Choi, EMNLP 2021) — answers depend on temporal/geographic context.
- Content Expiry Date Determination (Almquist & Jatowt, ECIR 2019) <https://link.springer.com/chapter/10.1007/978-3-030-15712-8_6> and Temporal Validity Change Prediction (Wenzel & Jatowt, 2024) <https://arxiv.org/abs/2401.00779> — how long a statement stays true.

**Plumbing for dates (our undated / relative-date gap)**
- TimeML / TempEval, and normalizers HeidelTime and SUTime — extract events and resolve "yesterday / last week" against the document creation time. The established way to fill in missing or relative dates.

**LLMs are measurably bad at this**
- TRAM (Wang & Zhao, ACL Findings 2024) — temporal-reasoning benchmark; best model lags humans badly. Justifies not trusting a prompt-only fix. <https://aclanthology.org/2024.findings-acl.382/>
- NLI through the Lens of Negation (Hossain et al., EMNLP 2020) — the negation trap. <https://aclanthology.org/2020.emnlp-main.732/>

**Decomposition / decontextualization (our segment + triage)**
- SAFE / FacTool / FActScore — decompose-then-verify.
- Decontextualization (Choi et al., TACL 2021); Molecular Facts (Gunjal & Durrett, EMNLP 2024). <https://aclanthology.org/2024.findings-emnlp.215/>

**Source reliability (load-bearing in our verdict)**
- A Survey on Predicting Factuality and Bias of News Media (Nakov et al.) — supports the domain-conditional reliability concern. <https://arxiv.org/pdf/2103.12506>

## Prioritized next steps

1. **Make the retrieval window claim-kind-aware** — extend `WINDOW_AFTER_DAYS` for death/confirmation-type events (or bump to ~30–45 for event claims). One line plus the `kind` flag. Fixes the most likely current demo failure.
2. **Treat undated sources as non-deciding for event claims** — folds into the Part 2 verdict guard; closes the silent bypass of the temporal rule.
3. **Recency tie-break in `verdict.ts`** — later high-reliability evidence outweighs earlier, so "rumor then correction" resolves cleanly instead of "conflicting."
4. **Soften the authority-denial reliability rule** for the narco domain.

Items 1 and 2 share the `kind` field with Part 2 and are the same temporal class as the original bug — do them together.
