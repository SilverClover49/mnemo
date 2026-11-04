# Mnemo — Concept Brief

**One line:** A memory-aware study OS that schedules revision by the forgetting curve, so students revise what is about to be forgotten — not what they already know.

**Problem (Smart Education):** Students re-read notes, feel productive, and still blank in the exam hall. Study time is spent on familiar material, not on material at risk of decay. Existing planners schedule tasks, not memory.

**Insight:** Retention decays exponentially (Ebbinghaus). A topic's stability grows with each successful retrieval. If the app models that curve, it can tell a student *exactly* what to review today and *how ready* they will be on exam day.

**Core loop:**
1. Add subjects and topics (title + note).
2. Each topic has memory stability `S` (days) and last-review time.
3. `retention = exp(-t / S)`; readiness today and projected on exam date.
4. Daily queue = topics with retention below 0.85, ranked by exam weight × urgency.
5. Active recall session: prompt → student thinks/writes → reveal → self-grade (Again / Hard / Good / Easy) → `S` updated, next review scheduled.
6. **Innovation twist — calibration:** before revealing, the student predicts confidence (0–100). Mnemo compares prediction with the grade and reports over/under-confidence per subject. Most study apps track completion; Mnemo tracks whether the student *knows what they know*.

**Why it wins:** Functionality is real (working SRS engine, persistence, analytics). Theme is direct (smart education). The forgetting-curve visual + calibration score are demo-able in 30 seconds and are a genuine, research-backed twist rather than an AI wrapper.

**Scope:** Client-side only, zero backend, localStorage. No build step: index.html + style.css + app.js. Works offline, demo-safe.

**Non-goals:** accounts, sync, AI-generated questions, mobile-native.
