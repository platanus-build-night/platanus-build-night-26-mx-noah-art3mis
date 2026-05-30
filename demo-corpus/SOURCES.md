# Demo corpus — source links

Three demo documents for the VERITRACE claim module, with evidence links pre-gathered. Each story is broken into checkable sub-claims. All are text-native (the claim travels in the caption/text), so they suit a text-input pipeline.

## How to read this file (read before wiring anything in)

Every link below is one of two roles — never both:

- **Primary evidence** — a news-wire report, official statement, or registry the **pipeline is allowed to retrieve and reason over**. This is what produces Evidence nodes.
- **Answer key** — a finished third-party fact-check (PolitiFact, AFP, Factchequeado, Full Fact, Snopes, the various "VERIFICADO/Verificamos" outlets). Used **only to grade a run**. It is **never fed to the pipeline.** The Exa retrieval call `excludeDomains` these so the verdict is reached *de novo*. Putting a fact-check's conclusion in the graph is the cheat we're avoiding.

**`excludeDomains` starter list:** `politifact.com, afp.com, factchequeado.com, fullfact.org, snopes.com, mediabiasfactcheck.com, newsguardrealitycheck.com, revistaespejo.com, lacuartatransformacion.org, verificat.cat, prensalibre.com` (+ any other "verificado/debunked" outlet you spot). Tune as you test.

**What this build can honestly check de novo:** *event/existence* and *official-denial* sub-claims. **What it cannot:** *media-provenance*, *synthetic-media*, and *origin/rumor-chain* sub-claims — no pixels, no reverse-image/geo/detector tooling — those correctly return **Not-Enough-Evidence**. Pixel handling is the deferred image/video stretch.

| Story | Role in the demo | Why |
| ----- | ---------------- | --- |
| **2 — El Mencho / GDL airport** | **DE NOVO HERO** — demo this live | Drama is in event + official-denial sub-claims, both checkable from primaries with zero fact-checkers. |
| 1 — Venezuela / Maduro | Eval-only / NEI-expected | Its Refuted beats are media-provenance + synthetic-media → can't check de novo this build. |
| 3 — Springfield / pets | Eval-only / teaching | Origin-trace beat needs someone's investigation → not de novo. Use to *explain* the thesis, not as a live de-novo run. |

---

## Story 1 — Venezuela, post-Maduro "citizens celebrating"

**Input text (paste this):**

> "VÍDEO: venezolanos salen a las calles a celebrar la caída de Maduro y agradecen, entre lágrimas, a Donald Trump por la liberación del país."

**Context:** A US military operation removed Nicolás Maduro on 3 Jan 2026. In the following hours, AI-generated and mislabeled videos of "Venezuelans celebrating" went viral; experts estimated more fake than real content was circulating.

### Sub-claim A — "Maduro was removed (3 Jan 2026)" → expected **Supported**
- CNBC — AI content spreads after Maduro's removal: https://www.cnbc.com/2026/01/06/ai-generated-deepfake-videos-venezuelan-viral-us-military-maduro-misinformation.html
- NPR — How AI-generated content increased disinformation after Maduro's removal: https://www.npr.org/2026/01/10/nx-s1-5669478/how-ai-generated-content-increased-disinformation-after-maduros-removal

### Sub-claim B — "The celebration scenes are from Venezuela" → expected **Refuted (provenance / mislabeled location)**
- AFP / CNBC: footage actually filmed in Chile, Panama City and Buenos Aires; one clip was 2017 soccer-fan footage relabeled.
- TheJournal.ie — Debunked: old and fake footage claimed to show the US seizing Maduro and the aftermath: https://www.thejournal.ie/factcheck-debunked-fake-fotoage-ai-generated-old-videos-maduro-seizure-capture-arrest-us-special-forces-celebrations-rallies-6919368-Jan2026/
- WRAL — Fact check: does video show millions of Venezuelans celebrating Maduro's capture?: https://www.wral.com/news/local/fact-check-video-millions-venezuelans-celebrating-maduro-capture-jan-2026/

### Sub-claim C — "Crowds crying tears of joy thanking Trump" (the "Wall Street Apes" clip) → expected **Refuted (AI-generated)**
- PolitiFact — After Maduro's capture, AI-generated images and videos go viral: https://www.politifact.com/factchecks/2026/jan/05/social-media/venezuela-maduro-artificial-intelligence-images/
- CNBC (clip details: >5.6M views, ~38,000 reshares, reposted then removed by Musk): https://www.cnbc.com/2026/01/06/ai-generated-deepfake-videos-venezuelan-viral-us-military-maduro-misinformation.html

**Why it's a good demo:** mixed verdicts in one document — one **Supported**, two **Refuted** — and sub-claim B is a *real* video with a *false* caption, so it lands on "Refuted via provenance," not "fake video." Shows the nuance the tool is built for.

---

## Story 2 — Mexico, El Mencho aftermath (GDL airport / Puerto Vallarta)

**Input text (paste this):**

> "ÚLTIMA HORA: Tras la muerte de 'El Mencho' el 22 de febrero, comandos armados del CJNG tomaron por asalto el Aeropuerto Internacional de Guadalajara y mantienen como rehenes a turistas estadounidenses. Mientras tanto, Puerto Vallarta arde en llamas."

**Context:** Nemesio Oseguera Cervantes ("El Mencho") was killed on 22 Feb 2026. Within 48 hours, an estimated 200–500 false/unverified posts circulated; 20–40 went highly viral.

### Sub-claim A — "El Mencho died on 22 Feb 2026" → expected **Supported**
- CNN en Español — live coverage 22–23 Feb 2026: https://cnnespanol.cnn.com/mexico/live-news/ultima-hora-nemesio-mencho-oseguera-orix
- Expansión — caída de 'El Mencho' provoca 200–500 fake news en 48 horas: https://expansion.mx/tecnologia/2026/02/23/caida-el-mencho-provoca-200-y-500-fake-news-en-48-horas

### Sub-claim B — "CJNG seized Guadalajara airport and is holding US tourists hostage" → expected **Refuted (official denial)**
- Infobae — ¿Sicarios en el Aeropuerto de Guadalajara? La versión de las autoridades: https://www.infobae.com/mexico/2026/02/22/sicarios-en-el-aeropuerto-de-guadalajara-la-version-de-las-autoridades-l-videos/
- Revista Espejo — VERIFICADO: Falso, supuesta toma del Aeropuerto de Guadalajara: https://revistaespejo.com/2026/02/22/verificado-espejo-falso-supuesta-toma-del-aeropuerto-de-guadalajara/
- La Cuarta Transformación — cómo se fabricó la falsa "toma" del Aeropuerto de Guadalajara: https://www.lacuartatransformacion.org/la-mentira-del-caos-asi-se-fabrico-la-falsa-toma-del-aeropuerto-de-guadalajara-para-sembrar-panico/
- Factchequeado — Desinformaciones sobre los disturbios en México tras la muerte de 'El Mencho' (Mexican Embassy in US called the hostage claim "false"): https://factchequeado.com/teexplicamos/20260224/desinformaciones-disturbios-mexico-muerte-mencho/

### Sub-claim C — "Puerto Vallarta is burning / engulfed in flames" → expected **Refuted (AI-generated image + recycled footage)**
- Prensa Libre — Verificamos: ¿qué videos relacionados con "El Mencho" son falsos? (burning-airplane image was AI; a coastal-fire video was actually Santa Marta, Colombia): https://www.prensalibre.com/internacional/verificamos-por-usted-que-videos-en-redes-relacionados-con-el-mencho-son-falsos/
- El Mañana — Las fake news que sembraron el pánico durante la detención de 'El Mencho': https://elmanana.com.mx/nacional/2026/2/23/las-fake-news-que-sembraron-el-panico-resultaron-ser-falsas-durante-la-detencion-de-el-mencho-170594.html

### Background / scale (for the narration, not a sub-claim)
- Verificat — La ola de desinformación tras la muerte de El Mencho amplificó el pánico y narrativas intervencionistas: https://www.verificat.cat/es/la-ola-de-desinformacion-a-raiz-de-la-muerte-de-el-mencho-en-mexico-amplifico-el-panico-y-las-narrativas-intervencionistas/
- Observatorio de Medios Digitales (Tec de Monterrey) — volumen, velocidad y alcance: https://omd.tec.mx/noticia/desinformacion-tras-el-abatimiento-de-el-mencho-volumen-velocidad-y-alcance

**Why it's the DE NOVO HERO:** A (death) → **Supported** from the news wire, and B (airport seizure / hostages) → **Refuted** from the **official authority/Embassy denial** — both reached from primaries with the fact-checkers excluded. On stage: "no fact-checkers in this graph; it re-derived the verdict." C (Puerto Vallarta "burning" = AI image) is **synthetic-media → expect Not-Enough-Evidence** this build (no pixels); keep it as the honest-NEI beat or drop it. Mexico-local, very recent.

**Primary evidence for the pipeline (B's denial, retrievable de novo):** Infobae (authorities' version, line 45); Factchequeado quotes the **Mexican Embassy calling the hostage claim "false"** — but Factchequeado itself is Answer key, so let Exa find a *non-fact-check* outlet carrying the Embassy/authority denial. The "VERIFICADO/Verificamos" links here are Answer key only.

---

## Story 3 — USA, Springfield "they're eating the pets" (2024 — the canonical example)

**Input text (paste this):**

> "In Springfield, they're eating the dogs. The people that came in, they're eating the cats, they're eating the pets of the people that live there."

**Context:** Spoken by Trump at the 10 Sep 2024 debate before ~67M viewers about Haitian immigrants in Springfield, Ohio. PolitiFact rated it "Pants on Fire" and named it the **2024 Lie of the Year**. Not 2026-recent, but it is the purest demonstration of *process-based explainability*: the claim traces back to a single Facebook post that the originator later retracted. Pure text/quote — ideal modality fit.

### Sub-claim A — "Haitian immigrants in Springfield are stealing and eating pets" → expected **Refuted (official denial)**
- PolitiFact — Trump repeats baseless claims that Haitian immigrants eat pets: https://www.politifact.com/factchecks/2024/sep/11/donald-trump/trump-repeats-baseless-claims-that-haitian-immigra/
- ABC News — Trump pushes false claim (city spokesperson: "no credible reports"): https://abcnews.com/Politics/trump-pushes-false-claim-haitian-migrants-stealing-eating/story?id=113570407
- NPR — Trump doubles down on false stereotypes in debate: https://www.npr.org/2024/09/11/nx-s1-5108401/donald-trump-debate-eating-dogs-cats-immigrants-false-stereotype

### Sub-claim B — "There are documented police/city reports of this" → expected **Refuted (absence of record)**
- Springfield Police / Mayor Rob Rue: no reports of pets stolen and eaten; no documented cases (cited in the PolitiFact and ABC pieces above).

### Sub-claim C — origin trace: "the rumor came from a credible eyewitness" → expected **Refuted (originator retracted)**
- Wikipedia — Springfield pet-eating hoax (traces the rumor to a Facebook post the poster admitted was secondhand and false): https://en.wikipedia.org/wiki/Springfield_pet-eating_hoax
- PolitiFact — Lie of the Year writeup: https://www.politifact.com/article/2024/dec/17/theyre-eating-the-pets-trump-vance-earn-politifact/

**Why it's a good demo:** the headline differentiator. The refuting edge isn't an authority saying "no" — it's the **evidence trail collapsing to a single retracted rumor**. Shows the verdict emerging from *tracing provenance*, exactly the thesis. Caveat: politically charged and from 2024, so use as the "canonical / teaching" example rather than the live-recency hero.

### Springfield — full link collection

**Official / fact-check (the claim is false)**
- PolitiFact — Trump repeats baseless claims: https://www.politifact.com/factchecks/2024/sep/11/donald-trump/trump-repeats-baseless-claims-that-haitian-immigra/
- ABC News — Trump pushes false claim: https://abcnews.com/Politics/trump-pushes-false-claim-haitian-migrants-stealing-eating/story?id=113570407
- NPR — Trump doubles down on false stereotypes: https://www.npr.org/2024/09/11/nx-s1-5108401/donald-trump-debate-eating-dogs-cats-immigrants-false-stereotype
- NPR — Vance defends spreading the claims: https://www.npr.org/2024/09/15/nx-s1-5113140/vance-false-claims-haitian-migrants-pets
- PBS NewsHour — Trump amplifies false racist rumor in debate: https://www.pbs.org/newshour/politics/watch-trump-amplifies-false-racist-rumor-about-ohios-haitian-immigrants-in-debate
- NBC News — Trump pushes baseless claim at debate: https://www.nbcnews.com/politics/2024-election/trump-pushes-baseless-claim-immigrants-eating-pets-rcna170537
- Media Bias/Fact Check — Fact vs. Fiction: https://mediabiasfactcheck.com/fact-vs-fiction-claims-of-haitian-immigrants-abducting-and-eating-pets-in-springfield-ohio/

**Origin trace (the rumor collapses to a retracted 4th-hand Facebook post)**
- NewsGuard — Triple Hearsay: original sources admit no first-hand knowledge: https://www.newsguardrealitycheck.com/p/origins-haitians-eating-pets-claim
- The Hill — Woman whose post ignited the claim says it was based on rumor: https://thehill.com/homenews/state-watch/4879994-springfield-rumor-haitian-immigrants-facebook-post/
- NBC News — "It just exploded": Springfield woman never meant to spark rumors: https://www.nbcnews.com/news/us-news/-just-exploded-springfield-woman-says-never-meant-spark-rumors-haitian-rcna171099
- Newsweek — Erika Lee (woman behind the rumor) speaks out: https://www.newsweek.com/springfield-woman-erika-lee-haitians-eating-pets-rumor-speaks-out-1953851
- WCPO — "I feel for the Haitian community": https://www.wcpo.com/news/state/state-ohio/woman-who-posted-viral-springfield-cat-eating-claims-i-feel-for-the-haitian-community

**Misattributed "evidence" (real incidents, wrong place/people — Refuted via provenance)**
- Full Fact — Video does NOT show a Haitian immigrant eating a cat in Springfield: https://fullfact.org/us/haitian-immigrant-springfield-ohio-cat-claim-false/
- Yahoo/USA Today — Ohio woman who ate a cat is from Canton, not Springfield (no Haiti connection): https://www.yahoo.com/news/fact-check-ohio-woman-accused-003015124.html
- WKYC — Canton police bodycam of Allexis Ferrell arrest (the misused footage): https://www.wkyc.com/article/news/local/canton/ohio-woman-eat-cat-canton-police-bodycam-footage-arrest-springfield/95-204df879-5de1-4a07-9aab-10d19aca3ba4
- Newsweek — Canton woman pleads guilty (US-born, unrelated to Springfield): https://www.newsweek.com/ohio-woman-jailed-eating-cat-springfield-haitian-claims-1994783
- Wikipedia — goose photo was Columbus roadkill, man not Haitian (see article body): https://en.wikipedia.org/wiki/Springfield_pet-eating_hoax

**Lie of the Year / aftermath**
- PolitiFact — 2024 Lie of the Year writeup: https://www.politifact.com/article/2024/dec/17/theyre-eating-the-pets-trump-vance-earn-politifact/
- Poynter — behind the scenes of the Lie of the Year pick: https://www.poynter.org/commentary/2024/how-politifact-chose-lie-year-haitians-eating-pets-springfield-ohio/
- Springfield News-Sun — local coverage of the Lie of the Year: https://www.springfieldnewssun.com/news/lie-of-the-year-politifact-singles-out-trumpvance-springfield-eating-pets/45E5OIUWFFFXPN77WWVOQEBAJA/
- WLRN — Trump, Vance earn PolitiFact's Lie of the Year: https://www.wlrn.org/government-politics/2024-12-17/trump-vance-false-haitian-claims-politifact-lie-of-the-year