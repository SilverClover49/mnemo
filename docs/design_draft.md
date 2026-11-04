# Mnemo — Design Draft (v1)

## 1. Stack & constraints
- Static site, no build step: `index.html`, `style.css`, `app.js`. Served from `file://` or any static host.
- Vanilla JS, single global state object, render functions per screen.
- Persistence: `localStorage` key `mnemo.v1`. Seeded demo data on first run so the demo is never empty.
- No network calls at runtime; fonts from Google Fonts with system fallbacks.

## 2. Data model
```
state = {
  student: { name, examDate (ISO), dailyGoal },
  subjects: [{ id, name, color, weight }],
  topics:   [{ id, subjectId, title, note, stability, lastReviewed, reps, history:[{t, grade, predicted}] }],
  sessions: [{ id, startedAt, endedAt, grades }],
  streak: { count, lastDay }
}
```
`stability` in days, min 0.2. `lastReviewed` epoch ms. Topic "due" when retention < 0.85 or never reviewed.

## 3. Memory engine
- `retention(topic, at) = exp(-dtDays / stability)` clamped [0,1]; never-reviewed = 0.
- Grade multipliers: Again ×0.35, Hard ×1.25, Good ×1.9, Easy ×2.8 (bounded 0.2–120 days).
- After review: stability = max(0.2, stability * multiplier), lastReviewed = now, reps++.
- Exam readiness = Σ(weight_i × retention_i(examDate)) / Σ(weight_i), where weight = subject weight.
- Queue = topics sorted by `urgency = (1 - retention(examDate)) * subjectWeight`, capped at dailyGoal (default 6).
- Calibration: `error = predicted/100 - actualScore`, actualScore ∈ {Again .2, Hard .45, Good .75, Easy .95}. Subject calibration = mean error. |mean| < .08 = "well calibrated".

## 4. Screens
1. **Today** — greeting, exam countdown, readiness ring, "today's plan" list (checkable, launches recall), decay chart of fleet retention over next 14 days, streak, quick stats.
2. **Library** — subject filter chips, search, topic cards with retention bar + next-review label; add/edit/delete topic modal; add subject inline.
3. **Review** — full-screen focus: progress (n of m), prompt "Explain {title}", optional note folded away, confidence slider (20–100) BEFORE reveal, reveal note, four grade buttons with keyboard 1–4, session summary with calibration delta.
4. **Insights** — calibration by subject (bar chart with over/under), per-topic retention curves (SVG sparkline + projected exam point), strongest/weakest topics, review activity (last 14 days).

## 5. Design direction
- Warm paper background `#F5F2EA`, ink `#14140F`, vermilion accent `#E8461E`, deep green `#0E3B2E`, hairline borders `#DCD6C8`.
- Display serif (Instrument Serif) for headlines/numbers; Inter for UI. Big readiness numeral as the hero.
- Asymmetric two-column today screen; generous whitespace; subtle paper grain via CSS gradient; 1px borders instead of shadows; 2px radius max.
- Motion: ring fill on load, staggered card reveal, count-up numbers. Respect `prefers-reduced-motion`.
- Review screen flips to dark ink background for focus contrast.
- Responsive to 380px: nav becomes bottom bar.

## 6. Edge cases & risks
- Exam date in past → clamp countdown to 0, show "Exam day".
- Zero topics → empty states with CTA, never NaN.
- All stability math guarded; retention clamped.
- Delete subject cascades topics; confirm via inline two-step, not `confirm()`.
- localStorage corrupt → try/catch, reseed.
- Dates via local midnight to avoid timezone off-by-one.
- Seed data must not make the app look fake during judging: realistic ECE topics, dates relative to today.

## 7. Verification
- Open in Chromium at 1440×900 and 390×844; screenshot both.
- Manual flow: add topic → appears in queue → complete review with confidence → stability/readiness change → reload → state persists.
- Check console for errors; keyboard shortcuts; no dead buttons.
- Test empty state by resetting storage.
