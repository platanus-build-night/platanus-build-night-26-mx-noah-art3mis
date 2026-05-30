# Research notes — explainable fact-checking literature vs. VERITRACE

This document cross-checks VERITRACE's actual pipeline implementation (`web/lib/pipeline/*`, `web/lib/exa.ts`, `web/lib/pipeline/verdict.ts`) against the academic literature on automated and explainable fact-checking. It records what the literature **validates**, what we should **add**, what **contradicts or challenges** the current design, and a needed correction to a stat on the methodology page. Grounded against the code as of this writing — file/line references point at the real implementation, not the methodology page's description.

Papers consulted: AVeriTeC (2305.13117), AVeriTeC Shared Task 2024 (2410.23850), HerO / HerO2 (2410.12377 / 2507.11004), SAFE (2403.18802), FacTool (2307.13528), FEVER (N18-1074), "Claim Verification in the Age of LLMs" survey (2408.14317), "Molecular Facts" (2406.20079), Jacovi & Goldberg (2020.acl-main.386), Atanasova et al. (2020.acl-main.656), CLUE (2505.17855), Kim et al. (2402.07401), Kotonya & Toni survey (2011.03870), Si et al. over-reliance (2310.12558), Vasconcelos et al. (over-reliance / effortful engagement).

## Headline

The literature strongly validates VERITRACE's two foundational bets, which is worth stating plainly because endorsement this clean is rare:

1. **Excluding fact-check outlets** (`web/lib/exa.ts:8-20`, the 11-domain `FACT_CHECKERS` list) is the principled position, not a quirk. AVeriTeC's own maintainers shipped a *corrected* evidence store in the 2024 shared task specifically to scrub leaked fact-check articles, treating their presence as a contamination bug. The honest caveat: this is *why* de-novo systems top out at ~0.27–0.63 AVeriTeC score (the hardened 2025 store crashed top scores to ~0.33). De-novo is hard — hence "advisory verdict, human makes the call" is the correct framing, not a hedge.

2. **Evidence trails over generated prose** is supported four independent ways: Kim 2024 (the ~80% stat), Atanasova 2020 (extractive grounding beats abstractive), Si 2023 (retrieval degrades gracefully when the model is wrong), and Kotonya & Toni (deterministic aggregation is "coherent" by their criteria). This is VERITRACE's single strongest decision.

Three sharp caveats follow in "Contradictions / risks" below.

## Things to ADD

Ranked by value-for-effort, each grounded in a specific file.

| #  | Change                                                                                  | Where                                                              | Why (citation)                                                                                                                                                              | Effort |
| -- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1  | **Query expansion before search** — synthesize an "ideal evidence doc" from the claim, search on that rather than the raw question | `web/lib/exa.ts` (`retrieveEvidence`)                             | HyDE-FC lifted HerO's retrieval recall; retrieval is the documented bottleneck (AVeriTeC baseline scored 0.11 almost entirely from poor retrieval). Guard against letting the model hallucinate the verdict into the query. | Medium |
| 2  | **Claim-date window on retrieval — both ends**                                          | `web/lib/exa.ts` (currently omits `startPublishedDate`/`endPublishedDate`) | Post-claim evidence = leakage (AVeriTeC scrubs it); stale evidence = the survey's "knowledge currency" failure. `extract.ts` already injects a date into every claim — pass it through to Exa. | Low    |
| 3  | **Expose the support ratio**, not only the categorical verdict (e.g. "2 of 3 claims supported") | `web/lib/graph-types.ts` + source node rendering                  | SAFE's F1@K shows the graded signal is valuable; `sourceVerdict` (`web/lib/pipeline/verdict.ts:47`) collapses everything to one of 4 labels and discards the ratio.        | Low    |
| 4  | **Make "Conflicting" mean "*these two sources* disagree"** — render conflict as edges between evidence nodes | `web/lib/graph-to-flow.ts`, `web/lib/pipeline/verdict.ts`         | CLUE (2505.17855) directly validates this: users need to *see which evidence conflicts*, not a flat label. Highest-fit new feature for an evidence-graph product.           | Medium |
| 5  | **Make NEI explain itself** — show which question went unanswered / what evidence is missing | `web/lib/pipeline/resolve.ts` (`rationaleFor`, currently just "No usable primary evidence found") | Both Kotonya & Toni and CLUE require insufficiency to be *justified*, not merely labeled.                                                                                  | Low    |
| 6  | **Irrelevant / not-checkworthy filter** so off-topic atomic claims never reach the verdict | `web/lib/pipeline/extract.ts`                                     | SAFE explicitly labels facts "Irrelevant" and excludes them before scoring.                                                                                                | Low    |
| 7  | **Instrument the decompose/decontextualize step separately**                            | `web/lib/pipeline/extract.ts`                                     | FacTool evaluated its extractor in isolation because bad decomposition silently corrupts everything downstream (see contradiction #3).                                       | Medium |

## Contradictions / risks

**1. A polished graph can *increase* over-reliance when the verdict is wrong — the sharpest risk.** Si et al. 2023 (n=80): when an AI explanation is *correct*, users reach ~0.73–0.79 accuracy; when it is **wrong**, accuracy collapses to **0.35** — below the no-help baseline, and below retrieval-only (0.54). A richly rendered evidence graph is *more* persuasive than a bare label, so if the LLM stance tags are wrong, the graph's polish becomes a liability: it makes a wrong verdict look authoritative and lowers the human's chance of catching it. Mitigations the literature supports: progressive disclosure, **evidence-before-verdict** (let the user form a view before revealing the verdict), "what would flip this" affordances, and forcing *effortful* engagement (Vasconcelos 2022: explanations reduce over-reliance only when engaging with them takes effort).

**2. The "faithful" framing has a hole.** The aggregation in `web/lib/pipeline/verdict.ts` is genuinely faithful-by-construction — the verdict provably follows from the tags by a fixed, inspectable rule (`claimVerdict`, the two gates `MIN_STANCE_CONFIDENCE = 0.5` at `verdict.ts:15` and `DECIDING_RELIABILITY = {high, medium}` at `verdict.ts:18`). **But the stance / reliability / source-type tags feeding it are LLM-generated** (`web/lib/pipeline/classify.ts`) and inherit *no* such guarantee — they are exactly what Kim's hallucination typology flags and what Jacovi & Goldberg warn about. The graph faithfully renders potentially-unfaithful tags, lending them unearned authority. Recommendation: visibly mark the tags as model-generated/uncertain, let the user override them, and do not market the graph as "faithful" wholesale — Jacovi notes a plausible-but-unfaithful interpretation in a high-stakes advisory setting is the worst case.

**3. Decontextualization is the most underrated failure surface.** The `web/lib/pipeline/extract.ts` prompt *mandates* decontextualization ("inject the date, place, and actor… mandatory"). "Molecular Facts" (2406.20079) quantifies the danger in both directions: simple decontextualization made **13.4%** of claims non-minimal by injecting unverified details (e.g. "The album" → "The *compilation* album", inventing "compilation"), and merging facts means one bad sub-fact fails the *whole* claim (1.7–9.6% of decontextualizations). The prompt already says "balance decontextuality with minimality / molecular facts" — good — but nothing measures whether it works. This is the highest-leverage place for the instrumentation in add #7.

**4. Deterministic aggregation diverges from every reference system.** AVeriTeC's baseline, HerO/HerO2, FacTool, and SAFE all use *learned/LLM* verdict prediction over the evidence — precisely because that is where their accuracy gains live (weighing partial and conflicting evidence). VERITRACE's fixed rule buys auditability at the cost of that nuance. Defensible as a transparency tradeoff — but defend it *as* one. Possible hybrid: the rule is the default, and an LLM flags cases it believes the rule mishandles.

**5. "Show everything" vs. parsimony.** Kotonya & Toni list parsimony as a core desideratum; a full graph on a multi-hop claim is the opposite. The `MAX_CLAIMS = 3` (`extract.ts`) and `MAX_QUESTIONS = 2` (`questions.ts`) caps already enforce this implicitly — but if they are ever raised, collapse-by-default + expand-on-demand is the reconciliation.

## The ~80% stat on the methodology page is overstated

This needs action because it is live on `web/app/methodology/page.tsx` (the hero pull-stat and the Kim reference). Traced to source:

- It is **100% − 20%** from Kim et al. 2024, **Table 3**: a **human eval of n=20**, **GPT-3.5**, **zero-shot**, on **one hard multi-hop dataset (PolitiHop)**, where "unfaithful" = contains **≥1** span-level error from an 8-category typology.
- So "80% contain hallucinated content" actually means "80% had *at least one* flagged detail" — not "80% are mostly fabricated" or "reach the wrong verdict." For calibration: the paper's own *best* method still left 70% flagged, so the bar is strict, not the explanations worthless.
- The irony: that same metric would flag VERITRACE's *own* LLM stance/reliability tags. The evidence-graph design reduces this risk but does not escape it.

Current page text — *"~80% of zero-shot LLM fact-check explanations contain hallucinated content"* — generalizes an n=20, single-model, single-dataset, ≥1-error result into a universal law. Defensible rewrite:

> In one 2024 study, ~80% of zero-shot GPT-3.5 fact-check explanations on a hard multi-hop benchmark contained at least one hallucinated detail (human eval, n=20).

Keep it as *motivation* for avoiding generated prose — that is fair — just qualify it.

## Per-paper notes

### Retrieval / pipeline / decomposition

**AVeriTeC (2305.13117).** Canonical QA-pair decomposition + the exact 4-way taxonomy VERITRACE adopted — note their 4th label is specifically "Conflicting Evidence/Cherry-picking", richer than a generic "Conflicting" (it flags selective, technically-true-but-misleading claims; worth mirroring in the UI). 4,568 real claims from 50 fact-checking orgs; verdict inter-annotator κ = 0.619. Designed to *avoid* context dependence, evidence insufficiency, and temporal leakage — i.e. it validates VERITRACE's design pressures. Tension: the AVeriTeC baseline predicts the verdict with a *learned* classifier over QA pairs, not a deterministic rule.

**AVeriTeC Shared Task 2024 (2410.23850).** 21 submissions, 18 beat baseline; winner TUDA_MAI 0.63, HerO 0.57, baseline 0.11. The 0.11→0.63 jump shows retrieval + LLM verdicting is the lever, and that **retrieval is the bottleneck** (~35% of system evidence scored below 3/5 on human coverage). The AVeriTeC score is a *gated* metric — a claim counts correct only if verdict is right AND retrieved Q+A evidence clears a Hungarian-METEOR ≥ 0.25 threshold against reference evidence — worth copying as an internal eval because it rewards exactly the "show your evidence" property. The organizers shipped a date-format leakage bug that let post-claim pages (including fact-check articles) into the store, then released a corrected store removing them — confirming fact-check exclusion is the principled position.

**HerO / HerO2 (2410.12377 / 2507.11004).** HyDE-FC: generate N hypothetical fact-checking documents to expand the retrieval query, then BM25 → dense rerank (add #1). Conditioning question generation on the *full claim* lifted Q score 0.421→0.494 (cheap win). HerO2: document-level / paragraph-summarized evidence beat sentence/chunk retrieval (recall@10 0.52→0.56), and answer-reformulation helped further. 2025 absolute scores collapsed under the hardened store (winner 0.332 vs 2024's 0.63) — do not benchmark against the soft 2024 numbers. Both use learned verdict prediction.

**SAFE (2403.18802).** decompose → revise/decontextualize → search-verify → aggregate; validates VERITRACE's architecture. Agreed with humans on ~72% of ~16k facts and beat them 76% of the time on 100 disagreements, at >20× lower cost. Labels facts "Irrelevant" and excludes them (add #6). Reports per-fact precision/recall (F1@K), not a single discrete verdict — argues for surfacing the support ratio (add #3).

**FacTool (2307.13528).** 5 stages mirroring VERITRACE. KB-QA claim-level F1 89.09. Key finding: checking against *retrieved external evidence* beats every LLM self-check baseline — the core justification for live retrieval over "ask the model if it's true." Evaluated its claim extractor *separately* because bad decomposition silently corrupts everything downstream (add #7). Response-level F1 (71.79) << claim-level (89.09): errors compound across stages.

**FEVER (N18-1074).** Founded the SUPPORTED / REFUTED / NOTENOUGHINFO schema; annotator κ = 0.684 sets a realistic human-agreement ceiling (~0.62–0.68). 16.82% of claims need ≥2 sentences combined — aggregation must natively handle multi-source verdicts, not assume one source settles it. Caveat: FEVER claims are synthetically mutated Wikipedia sentences and its NEI is artificial, so NEI calibration is weak/under-studied — a deterministic rule encodes whatever NEI prior its thresholds imply, so tune the NEI trigger deliberately.

**Survey + Molecular Facts (2408.14317 / 2406.20079).** Documented failure-mode taxonomy: irrelevant retrieved context, knowledge conflict (model ignores evidence and falls back on parametric belief — hard-constrain the verdict to retrieved evidence), decomposition meaning-drift, evidence insufficiency, temporal lag, hallucinated explanations, verdict-granularity inconsistency. Molecular Facts quantifies decontextualization damage (under-specification → unresolvable ambiguity; over-specification → 13.4% non-minimal via injected facts; merge errors fail whole claims).

### Explainability / trust / uncertainty

**Jacovi & Goldberg 2020 (2020.acl-main.386).** The faithfulness-vs-plausibility distinction; conflating them is "dangerous." Their motivating example (a judge shown a model's prediction + an interpretation they trust) is almost VERITRACE's exact setting — a plausible-but-unfaithful interpretation is the worst case. Crucial warning: **HCI/utility evaluation does not measure faithfulness** — a future user study showing fact-checkers do better with the graph demonstrates usefulness, not that the graph faithfully reflects how the verdict was produced. Don't market a usability win as a faithfulness win.

**Atanasova et al. 2020 (2020.acl-main.656).** Joint veracity + explanation training improves the *explanation* (better human-judged coverage/overall, despite lower ROUGE) — word-overlap metrics mislead; decision-relevance is what matters. Extractive/grounded justification is the safe default; generated prose is where hallucination enters. Sobering: non-contradiction inter-annotator agreement was -0.1 (worse than chance) and the task was "too difficult for humans" — don't assume reviewers will reliably catch a bad stance tag.

**CLUE (2505.17855).** Strongest external validation of VERITRACE's Conflicting / NEI design: a bare verdict or confidence % is insufficient; users need to see *which evidence conflicts*. Framed explicitly around fact-checkers who must assess source reliability and reconcile conflicting evidence "rather than merely predicting a verdict label." Concrete UI recommendation: render conflict/agreement as edges between evidence nodes and surface reliability at the conflict point (add #4). Their two variants trade off faithfulness vs plausibility — you cannot maximize both; decide which you optimize.

**Kim et al. 2024 (2402.07401).** Source of the ~80% stat (see the dedicated section above). Real and traceable but fragile: n=20, GPT-3.5, zero-shot, one multi-hop dataset, ≥1-error-counts. Supports the design choice (zero-shot LLM justification prose is unreliable → show evidence trails) but the stat is about generated free-text explanations VERITRACE deliberately does not use — fair as motivation, not as a characterization of VERITRACE's own risk. Their automatic GPT-4 evaluator rated almost everything ~5/5 "faithful", contradicting the human 20% — even strong LLMs fail to judge explanation faithfulness.

**Kotonya & Toni survey (2011.03870).** Taxonomy of explanation types (attention/saliency; rule-based/logic; summarization/textual) and the outcome-driven vs process-driven axis. Their #1 open problem — no system offers *process-driven* explanations across the whole pipeline — is exactly what VERITRACE's claim→question→source→aggregation graph provides. Eight desiderata (actionability, causality, coherence, contextfullness, interactiveness, impartiality, parsimony, chronology); deterministic aggregation scores as "coherent". Parsimony is in direct tension with "show everything" (contradiction #5); impartiality is a place LLM-assigned reliability tags can smuggle in partisan bias.

**Si et al. 2023 (2310.12558) + Vasconcelos 2022.** The over-reliance evidence (contradiction #1). LLM explanations and retrieved passages give similar accuracy (~74%) but explanations are read faster; when the explanation is *wrong*, user accuracy collapses to 0.35 while retrieval-only holds at 0.54. Contrastive (both-sides) display reduces over-reliance; combined retrieval+explanation gave no benefit over retrieval alone — the verdict layer may add little on top of good sources and may anchor the user. Vasconcelos: explanations reduce over-reliance only when engaging with them is made effortful.

## Recommended sequence

1. Fix the ~80% stat on the methodology page (live accuracy issue).
2. Low-effort code adds: #2 date-window, #3 support-ratio, #5 NEI-explains-itself, #6 irrelevant filter.
3. Medium-effort, highest product fit: #4 conflict-as-edges (CLUE), #1 query expansion (HerO), #7 decomposition instrumentation.
4. Design response to over-reliance (contradiction #1): consider evidence-before-verdict and progressive disclosure; mark LLM-generated tags as uncertain and user-overridable (contradiction #2).
