# Mnemo

**A study desk for memory.**

WEBNOVA '26 · Smart Education · Department of ECE, HKBK College of Engineering

Mnemo schedules revision by the forgetting curve instead of by a calendar. You add what you are learning, it tells you what is about to be forgotten, and it measures whether your confidence matches your actual recall.

![Today screen](assets/today.png)

---

## Why it exists

Students reread notes, feel productive, and blank in the exam hall. Reading builds familiarity; only retrieval builds memory. Mnemo keeps a stability score for every topic, predicts when retention drops below 85%, and puts that topic in today's queue — so study time goes to what is actually leaking.

## The loop, start to finish

1. **Add what you're learning.** One idea per topic plus the note you want to reproduce. A subject and a note are the only inputs.
2. **Review at the edge of forgetting.** When predicted retention falls below 85%, the topic becomes due. The queue is ordered by decay, then subject weight.
3. **Predict, then reveal.** Commit to a confidence percentage before seeing the note, then grade what you produced: Again / Hard / Good / Easy.
4. **Read the projection.** Progress simulates the reviews still ahead and reports retention on exam day, the thinnest margins, and where confidence and recall disagree.

| Screen | What it answers |
|---|---|
| **Today** | What should I study in the next hour, and why? |
| **Library** | What am I learning, and what note will I recall against? |
| **Progress** | What will survive to exam day? Where is my confidence wrong? |
| **How it works** | How does the whole system work, including the build? |

![Progress screen](assets/progress.png)
![Recall session](assets/review.png)

## Run it

Double-click `index.html`, or serve the folder:

```powershell
cd "E:\IEEE day contests\Mnemo"
python -m http.server 8080
# open http://localhost:8080
```

No build step, no dependencies, no API keys. State lives in `localStorage`; the demo ships with seeded ECE topics so nothing is empty on first load. Tested in Chromium at 1280×720, 1536×776 and 390×844.

## 60-second demo

1. **Today** — 8 topics are below threshold; readiness is projected for 12 Dec.
2. **Start today's recall** → set confidence (say 80%) → reveal → press **3** (Good). The four buttons show the next interval each grade would produce.
3. Finish → the summary shows **retention lift** and the **confidence gap**.
4. **Progress** — calibration by subject, "thinnest margins" with projected *and* current retention, retention-to-exam curves.
5. **How it works** — the four steps, the formula, and the architecture.
6. Click **Demo · skip 7 days ahead** (sidebar, or the demo row on Today): retention collapses from ~76% to ~28% and the queue refills. **Reset demo data** restores everything.

## How the math works

```
retention R(t) = e^(−t / S)
```

- `t` — days since the last review.
- `S` — stability in days. A grade multiplies it: Again ×0.35, Hard ×1.25, Good ×1.9, Easy ×2.8, bounded 0.2–180.
- A topic is due at **R < 0.85**.
- **Exam readiness** simulates the reviews still ahead to the exam date and reports where you land if you keep the schedule. The card also shows today's retained percentage, so projection and current state are never confused.
- **Calibration** compares predicted confidence with the grade outcome (Again 20 / Hard 45 / Good 75 / Easy 95).

Everything is plain arithmetic. Given the same stored state and the same day, the same numbers come out.

## How it is built

**Front end — three files, no framework.** `index.html`, `style.css`, one `app.js`. Every view renders from a single state object, so the interface cannot drift from the data. Charts are hand-written SVG. Fonts are the only network request, with serif/system fallbacks.

**Data layer — no server.** One JSON object in `localStorage` under `mnemo.v1`. All scheduling runs in the page, which keeps notes private and makes the demo offline-safe. The trade-off is honest: per-device data only, no accounts or sync.

**AI — used to build it, not to fake it.** AI drafted the specification and seed content, then two zero-context reviewers attacked the design before implementation using the Elephant–Goldfish method (one reviewer ran on Qwen 3.8 Flash). The runtime scheduler deliberately contains no model, so every score is reproducible and explainable. A sensible next step is opt-in LLM-generated recall prompts — not a hidden model in the readiness number.

![How it works](assets/guide.png)

**Limits.** Grades are self-reported, so honesty matters. Retention is a model, not a measurement. Readiness assumes the schedule is kept and is not a predicted mark.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Shell, navigation, mount points |
| `style.css` | Design tokens and all components |
| `app.js` | Memory engine, views, review session, charts, persistence |
| `assets/` | Screenshots used above |
| `docs/concepts_brief.md` | Product brief |
| `docs/design_draft.md` | Original data model and screens |
| `docs/redesign_draft.md` | Olive/red redesign and explainability brief |

## Judging map

- **Functionality (35%)** — working scheduler, persistence, topic CRUD, subject filters, search, keyboard grading, demo fast-forward, reset.
- **Relevance (20%)** — retention and exam preparation for students; nothing decorative.
- **UX (15%)** — four-step loop explained in-product, honest empty states, responsive to phone width, axe contrast clean.
- **Rapid execution & polish (15%)** — no build step, seeded demo, consistent olive/red system, no dead buttons.
- **Innovation (10%)** — forgetting-curve scheduling plus a metacognitive confidence-gap metric.
- **Pitch (5%)** — the demo above runs in under a minute.

Built with the [Elephant–Goldfish](https://github.com/google/elephant-goldfish-model) method: draft with full context, review with fresh ones.
