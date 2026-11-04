# Mnemo — Redesign Draft v2 (olive / red, explainable)

## 1. Why redesign
v1 read as a polished AI dashboard: dark readiness card, vermilion accent, dense micro-labels. Judges and the team need
something that feels like studying, not analytics, and that can be explained end to end without hand-waving.

## 2. Direction
- **Mood:** a study desk. Parchment paper, olive ink, brick red for urgency, serif headings, thin rules, dotted list lines.
- **Simple:** one idea per block. Sentence-case labels instead of uppercase micro-text everywhere. Fewer cards.
- **Palette:** paper `#f2eddf`, card `#faf6e8`, ink `#24211a`, olive `#3f4a2b` / `#5c6b3d`,
  red `#a63c2c`, muted `#625c4b`, line `#d8d0bc`.
- **Type:** Instrument Serif display + Inter Tight body. Numbers in serif; prose short.
- **Nav:** Today · Library · Progress · How it works. Active item olive with a red left rule.
- **Review stays dark**, but olive-black (`#1c2116`) rather than near-black blue.

## 3. Explainability requirement (new)
The site must answer "what is this, how do I use it, how was it built" without a person talking.

1. **Today** explains the loop in one sentence and links to the guide.
2. **Library** explains what a topic contains and why the note matters.
3. **Review** explains retrieval-before-reveal and why confidence is asked first.
4. **Progress** labels every chart with what it means.
5. **How it works** is a full page: four-step loop, the formula with a symbol legend, architecture
   (front end / data layer / AI), limits, and demo controls.

## 4. Architecture page content (must be truthful)
- **Front end:** static `index.html` + `style.css` + `app.js`, no framework or build step; one state object renders every view; charts are hand-written SVG; Google Fonts with fallbacks.
- **Data layer:** no server. `localStorage` key `mnemo.v1`; all math runs in the browser. Why: privacy, zero setup, offline demo. Trade-off: per-device only, no sync.
- **AI use:** AI drafted and reviewed the spec (Elephant–Goldfish with fresh-context reviewers, one on Qwen 3.8 Flash) and helped draft seed content. The runtime scheduler is deterministic math, not a model — that is deliberate, so every number is reproducible. Possible extension: LLM-generated recall prompts behind an opt-in API key.
- **Limits:** self-grading is subjective; readiness assumes the schedule is kept.

## 5. Code impact
- `style.css` rewritten (tokens + components + guide classes).
- `app.js`: add `renderGuide`, nav/crumb entry, update stat markup to `.stat-label`, add guide link in the method strip, tighten copy on Today/Library/Progress/Review.
- `index.html`: add nav buttons (desktop + mobile 4 columns).
- State shape unchanged; existing localStorage data stays valid.
- Demo controls unchanged: skip 7 days + reset.

## 6. Risks
- Olive/red contrast on parchment could fail for small text; verify with axe.
- Guide page can become a wall of text; keep it scannable with cards and short paragraphs.
- "Simple" must not remove decision-critical information (due count, why a topic is due).
- Four nav items at 390px could crowd; test labels and tap size.
- Do not claim AI capability the app does not have.
