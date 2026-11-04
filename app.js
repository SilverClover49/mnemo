(() => {
  "use strict";

  const DAY = 86400000;
  const STORE = "mnemo.v1";
  const REVIEW_THRESHOLD = 0.85;

  const GRADE = {
    again: { label: "Again", hint: "Missed it", score: 0.2, mult: 0.35, key: "1" },
    hard:  { label: "Hard",  hint: "Shaky",    score: 0.45, mult: 1.25, key: "2" },
    good:  { label: "Good",  hint: "Got it",   score: 0.75, mult: 1.9,  key: "3" },
    easy:  { label: "Easy",  hint: "Instant",  score: 0.95, mult: 2.8,  key: "4" }
  };

  const COLORS = ["#a63c2c", "#3f4a2b", "#5c6b3d", "#8a6a2f", "#6b5a45"];
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

  const $ = (sel, root = document) => root.querySelector(sel);
  const viewEl = document.getElementById("view");
  const modalRoot = document.getElementById("modalRoot");
  const reviewRoot = document.getElementById("reviewRoot");
  const toastEl = document.getElementById("toast");

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = (p) => p + Math.random().toString(36).slice(2, 8);
  const startOfDay = (ts = Date.now()) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const pct = (v) => Math.round(clamp(v, 0, 1) * 100);
  const wordFor = (n) => WORDS[n] || String(n);

  const fmt = (ts, opts) => new Intl.DateTimeFormat("en-GB", opts).format(new Date(ts));
  const fmtDay = (ts) => fmt(ts, { day: "numeric", month: "short" });
  const fmtLongDay = (ts) => fmt(ts, { weekday: "long", day: "numeric", month: "long" });
  const fmtTopDate = (ts) => fmt(ts, { weekday: "short", day: "numeric", month: "short" });

  const daysBetween = (a, b) => (startOfDay(b) - startOfDay(a)) / DAY;
  const daysToExam = () => Math.max(0, Math.round((startOfDay(state.student.examDate) - startOfDay()) / DAY));

  /* ------------------------------------------------------------------ model */

  function seedTopic(subjectId, title, note, stability, reviewedDaysAgo, reps, history) {
    const last = Date.now() - reviewedDaysAgo * DAY;
    return {
      id: uid("t_"), subjectId, title, note,
      stability,
      lastReviewed: last,
      reps,
      history: (history || []).map((h) => ({
        t: Date.now() - h.daysAgo * DAY,
        predicted: h.predicted,
        grade: h.grade
      }))
    };
  }

  function seed() {
    const subjects = [
      { id: "s1", name: "Digital Signal Processing", color: COLORS[0], weight: 1.2 },
      { id: "s2", name: "Electromagnetics", color: COLORS[1], weight: 1.0 },
      { id: "s3", name: "Microcontrollers", color: COLORS[2], weight: 1.15 },
      { id: "s4", name: "Communication Systems", color: COLORS[3], weight: 1.05 }
    ];

    const topics = [
      seedTopic("s1", "Z-transform & ROC",
        "ROC is the set of z-values where X(z) converges. A right-sided sequence converges outside a circle, |z| > r; a two-sided sequence converges on an annulus.",
        12, 3, 4, [{ daysAgo: 3, predicted: 82, grade: "good" }, { daysAgo: 9, predicted: 76, grade: "hard" }]),
      seedTopic("s1", "Butterworth filter order",
        "For |H(jω)|² = 1 / (1 + (ω/ωc)^2n) the response is 3 dB down at cutoff and rolls off at 20n dB per decade. Order n is read off the transition-band spec.",
        8, 0.5, 3, [{ daysAgo: 5, predicted: 74, grade: "good" }]),
      seedTopic("s1", "Sampling theorem",
        "A band-limited signal must be sampled above twice its highest frequency. Below that limit, high frequencies fold back into the baseband as aliasing.",
        0.8, 1, 1, [{ daysAgo: 1, predicted: 95, grade: "again" }]),
      seedTopic("s2", "Poynting vector",
        "S = E × H gives instantaneous power density; the time average is ½ Re(E × H*). Its direction is the direction of propagation.",
        4, 2, 2, [{ daysAgo: 6, predicted: 85, grade: "hard" }, { daysAgo: 2, predicted: 70, grade: "hard" }]),
      seedTopic("s2", "Boundary conditions",
        "Tangential E and normal B are continuous across an interface. Normal D jumps by surface charge density; tangential H jumps by surface current density.",
        22, 4, 6, [{ daysAgo: 12, predicted: 62, grade: "easy" }]),
      seedTopic("s2", "Wave impedance",
        "Free space has intrinsic impedance 377 Ω. Inside a medium η = √(μ/ε), and reflections come from the mismatch between η1 and η2.",
        15, 10, 5, [{ daysAgo: 10, predicted: 55, grade: "good" }]),
      seedTopic("s3", "Timer prescaler math",
        "Timer tick = prescaler / f_clk. At 72 MHz, a prescaler of 72 and ARR of 999 gives a 1 kHz update — one millisecond per tick.",
        6, 2, 3, [{ daysAgo: 4, predicted: 88, grade: "again" }]),
      seedTopic("s3", "UART frame format",
        "One start bit, five to nine data bits, optional parity, one or two stop bits. Both ends must agree on baud; 8N1 is the common default.",
        3.2, 1, 2, [{ daysAgo: 7, predicted: 70, grade: "good" }]),
      seedTopic("s3", "Interrupts vs polling",
        "Interrupts free the CPU and cut response latency. Polling burns cycles but is deterministic and simpler when events arrive very often.",
        1.2, 0.2, 1, [{ daysAgo: 0.2, predicted: 90, grade: "hard" }]),
      seedTopic("s4", "Shannon capacity",
        "C = B log2(1 + S/N). Doubling bandwidth doubles capacity, while improving SNR helps only logarithmically.",
        30, 1, 8, [{ daysAgo: 8, predicted: 65, grade: "easy" }]),
      seedTopic("s4", "QPSK constellation",
        "QPSK carries two bits per symbol across four phases, doubling the bit rate of BPSK in the same bandwidth. The cost is tighter phase accuracy at the receiver.",
        9, 1, 4, [{ daysAgo: 11, predicted: 72, grade: "good" }]),
      seedTopic("s4", "Fourier series vs transform",
        "Periodic signals expand into discrete harmonics; aperiodic signals need a continuous transform. Both are projections onto sinusoids.",
        2.5, 0.1, 2, [{ daysAgo: 0.1, predicted: 68, grade: "good" }])
    ];

    return {
      version: 1,
      student: { name: "Aarav", examDate: startOfDay() + 38 * DAY, dailyGoal: 6 },
      streak: { count: 6, lastDay: startOfDay() },
      subjects,
      topics
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.topics) && Array.isArray(parsed.subjects)) {
          parsed.subjects.forEach((s, i) => { s.color = COLORS[i % COLORS.length]; });
          return parsed;
        }
      }
    } catch (err) { /* corrupted state falls back to seed */ }
    const fresh = seed();
    persist(fresh);
    return fresh;
  }

  function persist(next) {
    try { localStorage.setItem(STORE, JSON.stringify(next || state)); } catch (err) { /* private mode */ }
  }

  let state = loadState();
  const ui = { view: "today", subject: "all", query: "", showSubjectForm: false };

  const examTs = () => state.student.examDate;
  const subjectOf = (id) => state.subjects.find((s) => s.id === id) || { name: "Unfiled", color: "#6f6a5e", weight: 1 };
  const topicOf = (id) => state.topics.find((t) => t.id === id);

  function retention(topic, at = Date.now()) {
    if (!topic.lastReviewed) return 0;
    const dt = Math.max(0, (at - topic.lastReviewed) / DAY);
    return clamp(Math.exp(-dt / Math.max(0.2, topic.stability)), 0, 1);
  }

  function nextReviewAt(topic) {
    const base = topic.lastReviewed || Date.now();
    const interval = Math.max(0.15, topic.stability * Math.log(1 / REVIEW_THRESHOLD));
    return base + interval * DAY;
  }

  function projectedRetention(topic, exam = examTs()) {
    if (exam <= Date.now()) return retention(topic, Date.now());
    let s = Math.max(0.3, topic.stability || 0.5);
    let last = topic.lastReviewed || Date.now();
    let guard = 0;
    while (guard++ < 80) {
      const step = Math.max(0.15, s * Math.log(1 / REVIEW_THRESHOLD));
      const next = last + step * DAY;
      if (next >= exam) break;
      s = clamp(s * 1.9, 0.2, 180);
      last = next;
    }
    return clamp(Math.exp(-Math.max(0, exam - last) / DAY / s), 0, 1);
  }

  function readiness() {
    if (!state.topics.length) return 0;
    let num = 0, den = 0;
    state.topics.forEach((t) => {
      const w = subjectOf(t.subjectId).weight || 1;
      num += projectedRetention(t) * w;
      den += w;
    });
    return den ? num / den : 0;
  }

  function avgRetention(at = Date.now()) {
    if (!state.topics.length) return 0;
    return state.topics.reduce((sum, t) => sum + retention(t, at), 0) / state.topics.length;
  }

  function dueTopics() {
    return state.topics.filter((t) => retention(t) < REVIEW_THRESHOLD)
      .sort((a, b) => retention(a) - retention(b));
  }

  function buildPlan() {
    const due = dueTopics();
    const list = due.length ? due : [...state.topics].sort((a, b) => retention(a) - retention(b)).slice(0, 3);
    return list.slice(0, Math.max(1, state.student.dailyGoal));
  }

  function calibration() {
    const out = { n: 0, mean: 0, bySubject: {} };
    state.subjects.forEach((s) => { out.bySubject[s.id] = { n: 0, sum: 0 }; });
    state.topics.forEach((t) => {
      (t.history || []).forEach((h) => {
        if (h.predicted == null || !GRADE[h.grade]) return;
        const err = h.predicted - GRADE[h.grade].score * 100;
        out.n += 1;
        out.mean += err;
        const b = out.bySubject[t.subjectId];
        if (b) { b.n += 1; b.sum += err; }
      });
    });
    out.mean = out.n ? out.mean / out.n : 0;
    Object.keys(out.bySubject).forEach((k) => {
      const b = out.bySubject[k];
      b.mean = b.n ? b.sum / b.n : 0;
    });
    return out;
  }

  function reviewActivity(days = 14) {
    const buckets = [];
    const today = startOfDay();
    for (let i = days - 1; i >= 0; i--) buckets.push({ day: today - i * DAY, count: 0 });
    state.topics.forEach((t) => (t.history || []).forEach((h) => {
      const d = startOfDay(h.t);
      const b = buckets.find((x) => x.day === d);
      if (b) b.count += 1;
    }));
    return buckets;
  }

  function streak() {
    const last = state.streak.lastDay;
    const diff = daysBetween(last, Date.now());
    if (diff <= 1) return state.streak.count;
    return 0;
  }

  function markReviewed() {
    const today = startOfDay();
    const diff = daysBetween(state.streak.lastDay, Date.now());
    if (diff === 1) state.streak.count += 1;
    else if (diff > 1) state.streak.count = 1;
    state.streak.lastDay = today;
  }

  /* ----------------------------------------------------------------- charts */

  function pathFromPoints(points, smoothing = 0.16) {
    if (!points.length) return "";
    let d = `M${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) * smoothing;
      const c1y = p1[1] + (p2[1] - p0[1]) * smoothing;
      const c2x = p2[0] - (p3[0] - p1[0]) * smoothing;
      const c2y = p2[1] - (p3[1] - p1[1]) * smoothing;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function decayChart() {
    const W = 460, H = 168;
    const top = 18, bottom = 126, left = 4, right = 456;
    const days = 14;
    const y = (v) => bottom - clamp(v, 0, 1) * (bottom - top);
    const pts = [];
    for (let i = 0; i <= days; i += (i >= days - 1 ? 1 : 1)) {
      const ts = Date.now() + i * DAY;
      pts.push([left + (i / days) * (right - left), y(avgRetention(ts))]);
    }
    const line = pathFromPoints(pts);
    const area = `${line} L${right},${bottom} L${left},${bottom} Z`;
    const threshold = y(REVIEW_THRESHOLD);
    const nowY = y(avgRetention());
    return `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Average retention over the next 14 days">
        <defs>
          <linearGradient id="fadeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#a63c2c" stop-opacity=".14"/>
            <stop offset="100%" stop-color="#a63c2c" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${[0, 0.5, 1].map((v) => `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#e0d8c2" stroke-width="1"/>`).join("")}
        <line x1="${left}" x2="${right}" y1="${threshold}" y2="${threshold}" stroke="#9a927f" stroke-width="1" stroke-dasharray="3 4"/>
        <text x="${right - 2}" y="${threshold - 6}" text-anchor="end" font-family="Inter Tight, sans-serif" font-size="9" fill="#6b6659">review threshold 85%</text>
        <path d="${area}" fill="url(#fadeFill)"/>
        <path d="${line}" fill="none" stroke="#3f4a2b" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="${left}" cy="${nowY}" r="3.4" fill="#a63c2c"/>
        <circle cx="${left}" cy="${nowY}" r="7" fill="#a63c2c" opacity=".16"/>
        <text x="${left}" y="${bottom + 18}" font-family="Inter Tight, sans-serif" font-size="9.5" fill="#6b6659">today</text>
        <text x="${right}" y="${bottom + 18}" text-anchor="end" font-family="Inter Tight, sans-serif" font-size="9.5" fill="#6b6659">in 14 days</text>
        <text x="${left + 2}" y="${y(avgRetention()) - 12}" font-family="Inter Tight, sans-serif" font-size="10" fill="#3f4a2b" font-weight="500">${pct(avgRetention())}%</text>
      </svg>`;
  }

  function sparkline(topic) {
    const W = 150, H = 42;
    const samples = 56;
    const span = Math.max(DAY, examTs() - Date.now());
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const ts = Date.now() + (i / samples) * span;
      const r = projectedRetention(topic, ts);
      const y = H - 4 - clamp((r - 0.5) / 0.5, 0, 1) * (H - 8);
      pts.push([2 + (i / samples) * (W - 4), y]);
    }
    const end = pts[pts.length - 1];
    const thresholdY = H - 4 - clamp((REVIEW_THRESHOLD - 0.5) / 0.5, 0, 1) * (H - 8);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <line x1="2" x2="${W - 2}" y1="${thresholdY}" y2="${thresholdY}" stroke="#c5bba3" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>
      <path d="${pathFromPoints(pts, 0.05)}" fill="none" stroke="${subjectOf(topic.subjectId).color}" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
      <circle cx="${end[0]}" cy="${end[1]}" r="2.2" fill="${subjectOf(topic.subjectId).color}"/>
    </svg>`;
  }

  function ringSvg(value) {
    const C = 276.46;
    return `<svg class="ring" viewBox="0 0 96 96" aria-hidden="true">
      <circle class="track" cx="48" cy="48" r="44"></circle>
      <circle class="fill" cx="48" cy="48" r="44" style="stroke-dasharray:${C};stroke-dashoffset:${C}"></circle>
    </svg>`;
  }

  /* ------------------------------------------------------------------- views */

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }

  function crumbFor(view) {
    const map = {
      today: ["Today", "Your daily queue, and why it exists"],
      library: ["Library", "One idea per topic"],
      insights: ["Progress", "What will survive to exam day"],
      guide: ["How it works", "Front end, data layer, and AI use"]
    };
    return map[view] || map.today;
  }

  function setView(view) {
    if (!["today", "library", "insights", "guide"].includes(view)) view = "today";
    ui.view = view;
    document.querySelectorAll(".rail-nav [data-view], .mobile-nav [data-view]").forEach((b) => {
      const active = b.dataset.view === view;
      b.classList.toggle("is-active", active);
      if (active) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    const [title, sub] = crumbFor(view);
    $("#crumb").textContent = title;
    $("#crumbSub").textContent = sub;
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    if (ui.view === "library") renderLibrary();
    else if (ui.view === "insights") renderInsights();
    else if (ui.view === "guide") renderGuide();
    else renderToday();
    renderChrome();
  }

  function renderChrome() {
    $("#topDate").textContent = fmtTopDate(Date.now());
    const d = daysToExam();
    $("#examMini").innerHTML = `<span>Exam in</span><strong>${d} days</strong>${fmtDay(examTs())} · ${state.student.name}`;
  }

  function renderToday() {
    const plan = buildPlan();
    const due = dueTopics().length;
    const ready = readiness();
    const avg = avgRetention();
    const cal = calibration();
    const fadeCount = due;
    const headline = due === 0
      ? `<em>Nothing</em> needs you today.`
      : `<em>${wordFor(fadeCount).replace(/^./, (c) => c.toUpperCase())} topics</em> need you today.`;
    const planLabel = plan.length + (due > plan.length ? ` of ${due}` : "");

    const planRows = plan.length ? plan.map((t, i) => {
      const r = retention(t);
      const subj = subjectOf(t.subjectId);
      const dueNow = r < REVIEW_THRESHOLD;
      return `
        <div class="plan-row" data-action="start-topic" data-id="${t.id}" role="button" tabindex="0" aria-label="Review ${esc(t.title)}">
          <span class="plan-idx">${String(i + 1).padStart(2, "0")}</span>
          <div>
            <div class="plan-title">${esc(t.title)}</div>
            <div class="plan-meta"><i class="dot" style="background:${subj.color}"></i>${esc(subj.name)}</div>
          </div>
          <div>
            <div class="meter ${r < 0.5 ? "is-low" : ""}"><span style="width:${pct(r)}%"></span></div>
            <div class="meter-label"><span>${pct(r)}% retained</span><span>${dueNow ? "now" : "in " + Math.max(1, Math.round((nextReviewAt(t) - Date.now()) / DAY)) + "d"}</span></div>
          </div>
          <span class="plan-arrow" aria-hidden="true">→</span>
        </div>`;
    }).join("") : `<div class="plan-empty"><span>Your queue is clear. Memory is stable.</span><button class="btn ghost sm" data-view="library">Add a topic</button></div>`;

    const calPts = Math.round(cal.mean);
    const calText = cal.n === 0 ? "Review a few topics to see how well your confidence tracks reality."
      : calPts > 8 ? `You rate yourself <b>${calPts} points</b> higher than your recall. That gap is where marks leak.`
      : calPts < -8 ? `You are <b>${Math.abs(calPts)} points</b> harder on yourself than your recall deserves.`
      : `Your confidence tracks your recall within <b>${Math.abs(calPts)} points</b>. That is rare.`;

    viewEl.innerHTML = `
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">${fmtLongDay(Date.now())} · ${daysToExam()} days to exam</p>
          <h1 class="display">${greeting()}, ${esc(state.student.name)}.<br>${headline}</h1>
          <p class="lede">Mnemo keeps a stability score for every topic and schedules the reviews that hold it above 85% until exam day. Today's list is the shortest one that does the job.</p>
          <div class="hero-actions">
            <button class="btn accent" data-action="start-plan">Start today's recall · ${planLabel} <span aria-hidden="true">→</span></button>
            <button class="btn ghost" data-view="guide">How it works</button>
          </div>
        </div>
        <div class="readiness card ink">
          <div>
            <p class="micro">Projected exam readiness</p>
            <div class="readiness-main">
              ${ringSvg(ready)}
              <div>
                <div class="big-num">${pct(ready)}<span>%</span></div>
                <p class="proj">Projected for ${fmtDay(examTs())} · if you keep this schedule</p>
              </div>
            </div>
          </div>
          <div class="readiness-foot">
            <span>${due} due now</span>
            <span><b>${pct(avg)}%</b> in memory</span>
          </div>
        </div>
      </section>

      <section class="stats">
        <div class="stat"><p class="stat-label">Due today</p><div class="stat-num">${due}<small>topics</small></div></div>
        <div class="stat"><p class="stat-label">In memory now</p><div class="stat-num">${pct(avg)}<small>%</small></div></div>
        <div class="stat"><p class="stat-label">Review streak</p><div class="stat-num">${streak()}<small>days</small></div></div>
      </section>

      <section class="today-grid">
        <div>
          <div class="card-head" style="margin-bottom:0">
            <div>
              <h2 class="section-title">Today's recall</h2>
              <p class="section-sub">Most decayed first. Reviewing a topic resets its curve.</p>
            </div>
            <button class="btn ghost sm" data-action="start-plan">Review all</button>
          </div>
          <div class="plan">${planRows}</div>
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head" style="margin-bottom:4px">
              <div>
                <p class="micro">Forecast</p>
                <h2 class="section-title" style="font-size:23px;margin-top:4px">Memory, next 14 days</h2>
              </div>
            </div>
            <div class="chart-wrap">${decayChart()}</div>
            <div class="chart-legend"><span><i></i>average retention if you keep this schedule</span></div>
          </div>
          <div class="card">
            <p class="micro">Calibration</p>
            <div class="calib-strip">
              <span class="calib-num">${cal.n ? (calPts > 0 ? "+" : "") + calPts : "—"}<span style="font-size:18px">pts</span></span>
              <p class="calib-text">${calText}</p>
            </div>
            <button class="icon-btn" style="margin-top:14px" data-view="insights">See calibration by subject →</button>
          </div>
        </div>
      </section>

      <section class="method">
        <div class="method-head">
          <div>
            <p class="micro">Start to finish</p>
            <h2 class="section-title" style="margin-top:3px">How Mnemo works</h2>
          </div>
          <button class="icon-btn" data-view="guide">The full guide →</button>
        </div>
        <div class="method-grid">
          <div class="method-item">
            <span class="method-n">01</span>
            <div><h3>Add what you're learning</h3><p>One idea per topic, plus the note you want to reproduce in the exam. The note is what you recall against.</p></div>
          </div>
          <div class="method-item">
            <span class="method-n">02</span>
            <div><h3>Review at the edge of forgetting</h3><p>When a topic drops below 85% retention it enters the queue. Recalling it there strengthens it most.</p></div>
          </div>
          <div class="method-item">
            <span class="method-n">03</span>
            <div><h3>Check what will survive</h3><p>Progress projects every topic to exam day and shows where your confidence and your recall disagree.</p></div>
          </div>
        </div>
      </section>

      <footer class="page-foot">
        <span>Mnemo · a study desk for memory</span>
        <span>WEBNOVA '26 · Smart Education · HKBK College of Engineering</span>
      </footer>

      <div class="demo-row">
        <span class="micro">Demo</span>
        <button class="icon-btn" data-action="fast-forward">Skip 7 days ahead</button>
        <button class="icon-btn" data-action="reset-demo">Reset demo data</button>
      </div>`;

    animateRing(ready);
  }

  function animateRing(value) {
    const fill = $(".ring .fill");
    if (!fill) return;
    const C = 276.46;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { fill.style.strokeDashoffset = String(C * (1 - clamp(value, 0, 1))); });
    });
  }

  function renderLibrary() {
    const counts = {};
    state.topics.forEach((t) => { counts[t.subjectId] = (counts[t.subjectId] || 0) + 1; });
    const chips = [
      `<button class="chip ${ui.subject === "all" ? "is-active" : ""}" data-action="filter" data-subject="all">All <span class="count">${state.topics.length}</span></button>`,
      ...state.subjects.map((s) => `<button class="chip ${ui.subject === s.id ? "is-active" : ""}" data-action="filter" data-subject="${s.id}"><i class="dot" style="background:${s.color}"></i>${esc(s.name)} <span class="count">${counts[s.id] || 0}</span></button>`)
    ].join("");

    viewEl.innerHTML = `
      <section>
        <div class="lib-head">
          <div>
            <p class="eyebrow">Your knowledge base</p>
            <h1 class="display" style="font-size:clamp(38px,4vw,54px);margin-top:8px">Library</h1>
            <p class="section-sub" style="margin-top:8px">Each topic carries one idea and the note you'll recall against. ${state.topics.length} topics, ${state.subjects.length} subjects.</p>
          </div>
          <div class="lib-tools">
            <label class="search"><span aria-hidden="true">⌕</span>
              <input id="libSearch" type="search" placeholder="Search topics" value="${esc(ui.query)}" aria-label="Search topics">
            </label>
            <button class="btn ghost sm" data-action="new-subject-open">New subject</button>
          </div>
        </div>
        ${ui.showSubjectForm ? `<form class="subject-form" id="subjectForm"><input class="input" id="subjectName" placeholder="Subject name, e.g. Control Systems" autocomplete="off"><button class="btn accent sm" type="submit">Add</button><button class="btn ghost sm" type="button" data-action="cancel-subject">Cancel</button></form>` : ""}
        <div class="chips">${chips}</div>
        <div class="topic-grid" id="libGrid"></div>
      </section>`;

    renderLibraryGrid();
    if (ui.showSubjectForm) {
      const input = $("#subjectName");
      if (input) input.focus();
    }
    const search = $("#libSearch");
    if (search) {
      search.addEventListener("input", (e) => {
        ui.query = e.target.value;
        renderLibraryGrid();
      });
    }
  }

  function filteredTopics() {
    const q = ui.query.trim().toLowerCase();
    return state.topics.filter((t) => {
      const subjOk = ui.subject === "all" || t.subjectId === ui.subject;
      const qOk = !q || t.title.toLowerCase().includes(q) || (t.note || "").toLowerCase().includes(q);
      return subjOk && qOk;
    }).sort((a, b) => retention(a) - retention(b));
  }

  function renderLibraryGrid() {
    const grid = $("#libGrid");
    if (!grid) return;
    const topics = filteredTopics();
    grid.innerHTML = topics.map((t) => {
      const subj = subjectOf(t.subjectId);
      const r = retention(t);
      const dueNow = r < REVIEW_THRESHOLD;
      const proj = pct(projectedRetention(t));
      return `
        <article class="topic-card card" data-action="start-topic" data-id="${t.id}" role="button" tabindex="0" aria-label="Review ${esc(t.title)}">
          <div class="subj"><i class="dot" style="background:${subj.color}"></i>${esc(subj.name)}</div>
          <h3>${esc(t.title)}</h3>
          <p class="note">${esc(t.note || "No note yet. Add one so future-you can check their recall.")}</p>
          <div class="topic-foot">
            <div class="meter ${r < 0.5 ? "is-low" : ""}"><span style="width:${pct(r)}%"></span></div>
            <div class="meter-label"><span>${pct(r)}% retained</span><span>${dueNow ? "due now" : "next in " + Math.max(1, Math.round((nextReviewAt(t) - Date.now()) / DAY)) + "d"}</span></div>
            <div class="topic-actions">
              <button class="icon-btn" data-action="edit-topic" data-id="${t.id}">Edit</button>
              <span class="icon-btn" style="cursor:default">${proj}% at exam</span>
            </div>
          </div>
        </article>`;
    }).join("") + `
      <button class="new-card" data-action="new-topic">
        <b>+</b><span>Add a topic you need to remember</span>
      </button>`;
  }

  function renderGuide() {
    viewEl.innerHTML = `
      <section class="guide-hero">
        <p class="eyebrow">The whole system</p>
        <h1 class="display" style="margin-top:10px">From a blank page<br>to <em>exam day.</em></h1>
        <p class="lede">Mnemo is one loop, repeated. These are the four steps it asks of you, the formula underneath them, and exactly how the front end, the data layer and the AI fit together.</p>
        <div class="guide-links">
          <button class="btn accent" data-view="today">Go to today's queue <span aria-hidden="true">→</span></button>
          <button class="btn ghost" data-view="insights">See the projection</button>
        </div>
      </section>

      <section class="steps">
        <article class="step">
          <div class="step-top"><span class="step-num">01</span><span class="step-when">Before the first review</span></div>
          <h3>Add what you're learning</h3>
          <p>A topic is one idea plus the note you want to reproduce in the exam. Subject and note are the only inputs — there is no question bank to write.</p>
          <p class="why">Why it works: retrieval needs a clear target. One idea per topic keeps the target honest.</p>
        </article>
        <article class="step">
          <div class="step-top"><span class="step-num">02</span><span class="step-when">Every day</span></div>
          <h3>Review at the edge of forgetting</h3>
          <p>When predicted retention falls below 85%, the topic becomes due. The queue is ordered by decay, then by subject weight.</p>
          <p class="why">Why it works: recalling something just before you would forget it strengthens memory most.</p>
        </article>
        <article class="step">
          <div class="step-top"><span class="step-num">03</span><span class="step-when">During a review</span></div>
          <h3>Predict, then reveal</h3>
          <p>Commit to a confidence percentage before seeing the note. Then grade what you actually produced: Again, Hard, Good or Easy.</p>
          <p class="why">Why it works: the gap between confidence and outcome is calibration — the part most students never see.</p>
        </article>
        <article class="step">
          <div class="step-top"><span class="step-num">04</span><span class="step-when">Before planning study time</span></div>
          <h3>Read the projection</h3>
          <p>Progress simulates the reviews still ahead and reports retention on exam day, the thinnest margins, and where confidence and recall disagree.</p>
          <p class="why">Why it works: the final week should go to what will not survive, not to what already feels familiar.</p>
        </article>
      </section>

      <section class="card formula-card">
        <div>
          <p class="micro">The model</p>
          <h2 class="section-title" style="margin-top:4px;font-size:28px">One curve, three decisions</h2>
          <div class="formula">R(t) = e<sup>−t / S</sup></div>
          <p class="small muted" style="max-width:38ch">The queue, the readiness ring and the exam projection all read from this one value. Grades multiply S: Again ×0.35, Hard ×1.25, Good ×1.9, Easy ×2.8, bounded to 0.2–180 days.</p>
        </div>
        <div class="formula-legend">
          <b>R</b><span>Retention now — the chance you could recall this topic unprompted.</span>
          <b>t</b><span>Days since your last review.</span>
          <b>S</b><span>Stability, in days: how long the topic survives without review. Each successful recall grows it.</span>
          <b>85%</b><span>The review threshold. Below it, the topic enters today's queue.</span>
        </div>
      </section>

      <h2 class="section-title" style="margin-top:32px">How it is put together</h2>
      <p class="section-sub">A static site, no server, and a scheduler you can check by hand.</p>

      <section class="arch-grid">
        <article class="arch-card">
          <span class="arch-label">Front end</span>
          <h3>Three files, no framework</h3>
          <p>index.html, style.css and one app.js. Every screen renders from a single state object, so the interface cannot drift from the data.</p>
          <ul class="arch-list">
            <li>Charts are hand-written SVG, not a library</li>
            <li>No build step and no runtime dependencies</li>
            <li>Responsive from 390px to a projector</li>
          </ul>
        </article>
        <article class="arch-card">
          <span class="arch-label">Data layer</span>
          <h3>No server. This browser.</h3>
          <p>State is one JSON object in <code>localStorage</code> under <code>mnemo.v1</code>. All scheduling runs in the page, which keeps notes private and the demo offline-safe.</p>
          <div class="code">topic = {<br>&nbsp;&nbsp;title, note,<br>&nbsp;&nbsp;<b>stability</b>: 12.4,<br>&nbsp;&nbsp;<b>lastReviewed</b>: timestamp,<br>&nbsp;&nbsp;history: [{ grade, predicted }]<br>}</div>
          <p class="small muted" style="margin-top:9px">Trade-off: data stays on this device. No accounts, no sync.</p>
        </article>
        <article class="arch-card">
          <span class="arch-label red">AI</span>
          <h3>Used to build it, not to fake it</h3>
          <p>AI drafted this spec and the seed content. Two fresh-context reviewers then attacked the design before code — one of them running Qwen 3.8 Flash. The live scheduler is plain arithmetic.</p>
          <ul class="arch-list">
            <li>No model sits inside readiness or retention</li>
            <li>No randomness — only the clock moves</li>
            <li>Next: opt-in LLM-generated recall prompts</li>
          </ul>
        </article>
      </section>

      <section class="card guide-note">
        <h3>What the numbers mean — and what they don't</h3>
        <p>Every figure on screen can be recomputed from a topic's stability and last review. That is deliberate: if a judge asks where 92% came from, the answer is a formula, not a model.</p>
        <p class="limits">Readiness assumes you keep the schedule and is not a predicted mark. Grades are self-reported, so honesty matters. Retention is a model, not a measurement.</p>
      </section>

      <footer class="page-foot">
        <span>Demo controls: “skip 7 days ahead” simulates neglect; “reset demo data” restores the seed.</span>
        <span>Built with the Elephant–Goldfish method</span>
      </footer>`;
  }

  function renderInsights() {
    const cal = calibration();
    const calPts = Math.round(cal.mean);
    const calLabel = cal.n === 0 ? "No data yet" : calPts > 0 ? "Overconfident" : calPts < 0 ? "Underconfident" : "Calibrated";
    const calRows = state.subjects.map((s) => {
      const b = cal.bySubject[s.id];
      const v = b && b.n ? b.mean : 0;
      const width = Math.min(50, Math.abs(v));
      const left = v >= 0 ? 50 : 50 - width;
      return `<div class="calib-row">
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</span>
        <span class="calib-track"><span class="${Math.abs(v) <= 8 ? "good" : ""}" style="left:${left}%;width:${width}%"></span></span>
        <span class="calib-val">${v > 0 ? "+" : ""}${Math.round(v)}</span>
      </div>`;
    }).join("");

    const activity = reviewActivity(14);
    const maxCount = Math.max(1, ...activity.map((a) => a.count));
    const bars = activity.map((a, i) => `<div class="bar ${i === activity.length - 1 ? "is-today" : ""}" title="${a.count} reviews on ${fmtDay(a.day)}"><i style="height:${Math.round((a.count / maxCount) * 100)}%"></i></div>`).join("");

    const curves = [...state.topics]
      .sort((a, b) => projectedRetention(a) - projectedRetention(b))
      .slice(0, 6)
      .map((t) => `<div class="curve">
        <h4 title="${esc(t.title)}">${esc(t.title)}</h4>
        <div class="pct">${pct(projectedRetention(t))}%</div>
        ${sparkline(t)}
      </div>`).join("");

    const atRisk = [...state.topics]
      .sort((a, b) => projectedRetention(a) - projectedRetention(b))
      .slice(0, 5)
      .map((t) => {
        const subj = subjectOf(t.subjectId);
        return `<div class="risk-row">
          <span style="display:flex;align-items:center;gap:8px;min-width:0"><i class="dot" style="background:${subj.color}"></i><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</b></span>
          <span class="risk-pct">${pct(projectedRetention(t))}%<small>${pct(retention(t))}% now</small></span>
          <button class="icon-btn" data-action="start-topic" data-id="${t.id}">Review</button>
        </div>`;
      }).join("");

    viewEl.innerHTML = `
      <section>
        <p class="eyebrow">Evidence, not vibes</p>
        <h1 class="display" style="font-size:clamp(38px,4vw,54px);margin-top:8px">Progress</h1>
        <p class="lede" style="margin-top:12px">Two questions decide exam performance: what will still be in memory on exam day, and does your confidence agree with your recall?</p>
      </section>

      <section class="insight-grid">
        <div class="card">
          <div class="card-head"><div><p class="micro">Metacognition</p><h2 class="section-title" style="font-size:24px;margin-top:4px">Confidence vs outcome</h2></div></div>
          <div style="display:flex;align-items:baseline;gap:10px">
            <span style="font-family:var(--serif);font-size:56px;line-height:1">${cal.n ? (calPts > 0 ? "+" : "") + calPts : "—"}</span>
            <div><div style="font-size:12.5px;font-weight:500">${calLabel}</div><div class="small muted">points across ${cal.n} reviews</div></div>
          </div>
          <p class="small muted" style="margin-top:10px;line-height:1.55">You predict confidence before every reveal. The gap between prediction and performance is your calibration — the part of studying most students never see.</p>
          <div class="calib-rows">${calRows}</div>
          <p class="small muted" style="margin-top:16px;font-size:11px;line-height:1.55">Bars right of centre: you felt surer than you performed. Outcome is scored 20 / 45 / 75 / 95 for Again / Hard / Good / Easy, so a 1–100 confidence is directly comparable.</p>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-head" style="margin-bottom:2px"><div><p class="micro">Consistency</p><h2 class="section-title" style="font-size:24px;margin-top:4px">Reviews, last 14 days</h2></div><span class="small muted">${activity.reduce((s, a) => s + a.count, 0)} total</span></div>
            <div class="bars">${bars}</div>
            <div class="bar-labels"><span>${fmtDay(activity[0].day)}</span><span>today</span></div>
          </div>
          <div class="card">
            <div class="card-head" style="margin-bottom:10px"><div><p class="micro">Risk</p><h2 class="section-title" style="font-size:24px;margin-top:4px">Thinnest margins</h2><p class="section-sub">Projected retention on exam day</p></div></div>
            ${atRisk}
          </div>
        </div>
      </section>

      <section class="card" style="margin-top:22px">
        <div class="card-head"><div><p class="micro">Projection</p><h2 class="section-title" style="font-size:24px;margin-top:4px">Retention to ${fmtDay(examTs())}</h2><p class="section-sub">Each dip is a review scheduled at 85%. The line is projection, not measurement.</p></div><span class="small muted">assuming you keep the schedule</span></div>
        <div class="curve-grid">${curves}</div>
      </section>`;
  }

  /* ------------------------------------------------------------------ modal */

  let lastFocused = null;

  function openTopicModal(id) {
    const editing = id ? topicOf(id) : null;
    const t = editing || { subjectId: state.subjects[0] ? state.subjects[0].id : "", title: "", note: "" };
    lastFocused = document.activeElement;
    modalRoot.innerHTML = `
      <div class="overlay" data-action="close-modal-bg">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <h2 id="modalTitle">${editing ? "Edit topic" : "New topic"}</h2>
          <p class="sub">${editing ? "Update the note your future self will recall against." : "One idea per topic. A small, honest note beats a page of highlights."}</p>
          <form id="topicForm" data-id="${editing ? editing.id : ""}">
            <div class="field">
              <label for="fSubject">Subject</label>
              <select id="fSubject">${state.subjects.map((s) => `<option value="${s.id}" ${s.id === t.subjectId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
            </div>
            <div class="field">
              <label for="fTitle">Topic</label>
              <input class="input" id="fTitle" maxlength="80" placeholder="e.g. Nyquist criterion" value="${esc(t.title)}" required>
            </div>
            <div class="field">
              <label for="fNote">The note you will recall against</label>
              <textarea class="input" id="fNote" maxlength="600" placeholder="The core idea in two or three sentences. Write it as the answer you want to produce in the exam.">${esc(t.note || "")}</textarea>
            </div>
            <p class="error-text" id="formError"></p>
            <div class="modal-foot">
              <div>${editing ? `<button type="button" class="btn danger sm" data-action="delete-topic" data-id="${editing.id}">Delete</button>` : ""}</div>
              <div class="right">
                <button type="button" class="btn ghost sm" data-action="close-modal">Cancel</button>
                <button type="submit" class="btn accent sm">${editing ? "Save changes" : "Add topic"}</button>
              </div>
            </div>
          </form>
          <p class="modal-note">New topics start with low stability, so they enter today's queue immediately. Editing a note does not reset its memory.</p>
        </div>
      </div>`;
    document.body.style.overflow = "hidden";
    setTimeout(() => { const f = $("#fTitle"); if (f) f.focus(); }, 30);
  }

  function closeModal() {
    modalRoot.innerHTML = "";
    document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  /* ----------------------------------------------------------------- review */

  let session = null;

  function openReview(topics) {
    if (!topics || !topics.length) return;
    session = {
      items: topics.slice(),
      index: 0,
      results: [],
      predicted: 60,
      revealed: false,
      returnView: ui.view,
      startAvg: topics.reduce((s, t) => s + retention(t), 0) / topics.length,
      startedAt: Date.now()
    };
    renderReview();
  }

  function closeReview() {
    const returnView = session && session.returnView ? session.returnView : "today";
    session = null;
    reviewRoot.innerHTML = "";
    document.body.style.overflow = "";
    ui.view = returnView;
    setView(returnView);
  }

  function progressMarkup() {
    return session.items.map((_, i) => `<i class="${i < session.index ? "done" : i === session.index ? "now" : ""}"></i>`).join("");
  }

  function renderReview() {
    if (!session) return;
    document.body.style.overflow = "hidden";
    if (session.index >= session.items.length) {
      renderSummary();
      return;
    }
    const t = session.items[session.index];
    const subj = subjectOf(t.subjectId);
    const idx = session.index + 1;

    const body = session.revealed ? `
      <div class="review-card">
        <div class="review-eyebrow"><i class="dot" style="background:${subj.color}"></i>${esc(subj.name)} · Recall</div>
        <h2 class="review-prompt">${esc(t.title)}</h2>
        <div class="note-reveal">
          <p class="micro">Your note</p>
          <p>${esc(t.note || "No note yet. Say your definition out loud, then grade yourself honestly.")}</p>
        </div>
        <div class="grades">
          ${Object.entries(GRADE).map(([k, g]) => {
            const nextS = clamp(Math.max(0.3, t.stability || 0.5) * g.mult, 0.2, 180);
            const d = Math.max(0.15, nextS * Math.log(1 / REVIEW_THRESHOLD));
            const when = d < 1 ? "later today" : "next in " + Math.round(d) + "d";
            return `<button class="grade" data-grade="${k}"><b>${g.label}</b><span>${when} · ${g.key}</span></button>`;
          }).join("")}
        </div>
        <div class="review-foot">
          <span class="micro">You predicted ${session.predicted}% confidence</span>
          <button class="review-note-link" data-action="close-review">End session</button>
        </div>
      </div>` : `
      <div class="review-card">
        <div class="review-eyebrow"><i class="dot" style="background:${subj.color}"></i>${esc(subj.name)} · Active recall</div>
        <h2 class="review-prompt">Explain “${esc(t.title)}”</h2>
        <p class="review-hint">Say it out loud, or sketch it, before you reveal the note. Retrieval is what builds the memory — rereading only builds familiarity.</p>
        <div class="confidence">
          <div class="confidence-head">
            <span class="micro">How sure are you?</span>
            <span class="val" id="confVal">${session.predicted}<small>%</small></span>
          </div>
          <input id="confRange" type="range" min="10" max="100" step="5" value="${session.predicted}" aria-label="Predicted confidence">
          <div class="scale"><span>Guessing</span><span>Certain</span></div>
          <p class="review-fine">This is compared with your grade. It measures calibration, not effort.</p>
        </div>
        <div class="review-foot">
          <button class="btn accent" data-action="reveal" id="revealBtn">Reveal my note</button>
          <button class="review-note-link" data-action="close-review">End session</button>
        </div>
      </div>`;

    reviewRoot.innerHTML = `
      <div class="review" role="dialog" aria-modal="true" aria-label="Recall session">
        <div class="review-top">
          <div class="review-brand">mnemo<span>.</span></div>
          <div class="progress">${progressMarkup()}</div>
          <span class="review-count">${idx} / ${session.items.length}</span>
          <button class="review-close" data-action="close-review" aria-label="Close session">×</button>
        </div>
        <div class="review-body">${body}</div>
      </div>`;

    const range = $("#confRange");
    if (range) {
      range.addEventListener("input", (e) => {
        session.predicted = Number(e.target.value);
        const val = $("#confVal");
        if (val) val.innerHTML = `${session.predicted}<small>%</small>`;
      });
    }
  }

  function reveal() {
    if (!session) return;
    session.revealed = true;
    renderReview();
  }

  function gradeItem(key) {
    if (!session || !session.revealed) return;
    const g = GRADE[key];
    if (!g) return;
    const t = session.items[session.index];
    const before = retention(t);
    const stability = clamp(Math.max(0.3, t.stability || 0.5) * g.mult, 0.2, 180);
    t.stability = Math.round(stability * 100) / 100;
    t.lastReviewed = Date.now();
    t.reps = (t.reps || 0) + 1;
    t.history = t.history || [];
    t.history.push({ t: Date.now(), predicted: session.predicted, grade: key });

    session.results.push({ predicted: session.predicted, score: g.score, before, id: t.id });
    markReviewed();
    persist();

    session.index += 1;
    session.revealed = false;
    session.predicted = 60;
    renderReview();
  }

  function renderSummary() {
    const n = session.results.length;
    const predictedAvg = n ? session.results.reduce((s, r) => s + r.predicted, 0) / n : 0;
    const scoreAvg = n ? session.results.reduce((s, r) => s + r.score, 0) / n : 0;
    const gap = Math.round(predictedAvg - scoreAvg * 100);
    const endAvg = n ? session.results.reduce((s, r) => s + retention(topicOf(r.id) || {}), 0) / n : 0;
    const lift = Math.round((endAvg - session.startAvg) * 100);
    const msg = n === 0
      ? "No topics graded this session. Nothing was lost."
      : Math.abs(gap) <= 8
        ? "Your confidence matched your recall closely. That is genuine exam-day composure — keep grading honestly."
        : gap > 0
          ? `You felt about ${gap} points surer than you performed. Mnemo will shorten the interval on these, so the gap cannot grow quietly.`
          : `You were ${Math.abs(gap)} points harder on yourself than your recall deserved. Trust the evidence, not the anxiety.`;

    reviewRoot.innerHTML = `
      <div class="review" role="dialog" aria-modal="true" aria-label="Session summary">
        <div class="review-top">
          <div class="review-brand">mnemo<span>.</span></div>
          <div class="progress">${session.items.map(() => '<i class="done"></i>').join("")}</div>
          <span class="review-count">complete</span>
          <button class="review-close" data-action="finish-review" aria-label="Close summary">×</button>
        </div>
        <div class="review-body">
          <div class="summary">
            <p class="micro">Session complete</p>
            <div class="big">${n}<span class="big-label">reviewed</span></div>
            <div class="summary-grid">
              <div><p class="micro">Confidence</p><div class="v">${n ? Math.round(predictedAvg) : 0}%</div></div>
              <div><p class="micro">Recall score</p><div class="v">${n ? Math.round(scoreAvg * 100) : 0}%</div></div>
              <div><p class="micro">Retention lift</p><div class="v">${lift >= 0 ? "+" : ""}${lift}<span style="font-size:14px"> pts</span></div></div>
              <div><p class="micro">Streak</p><div class="v">${streak()}<span style="font-size:14px"> days</span></div></div>
            </div>
            <p class="msg">${msg}</p>
            <div style="margin-top:26px;display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn accent" data-action="finish-review">Back to today</button>
              <button class="btn ghost" data-action="start-plan">Review next queue</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ toast */

  let toastTimer = null;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  /* ---------------------------------------------------------------- actions */

  function handleAction(action, node) {
    switch (action) {
      case "new-topic":
        openTopicModal();
        break;
      case "edit-topic": {
        const id = node.dataset.id;
        if (id) openTopicModal(id);
        break;
      }
      case "start-topic": {
        const id = node.dataset.id;
        const t = id && topicOf(id);
        if (t) openReview([t]);
        break;
      }
      case "start-plan": {
        const plan = buildPlan();
        if (!plan.length) { toast("Add a topic first."); openTopicModal(); break; }
        if (session) { session = null; reviewRoot.innerHTML = ""; }
        openReview(plan);
        break;
      }
      case "filter":
        ui.subject = node.dataset.subject || "all";
        renderLibrary();
        break;
      case "new-subject-open":
        ui.showSubjectForm = true;
        renderLibrary();
        break;
      case "cancel-subject":
        ui.showSubjectForm = false;
        renderLibrary();
        break;
      case "reveal":
        reveal();
        break;
      case "close-modal":
        closeModal();
        break;
      case "close-modal-bg":
        if (node === node.parentElement) closeModal();
        break;
      case "close-review":
        closeReview();
        break;
      case "finish-review":
        closeReview();
        toast("Session saved. Your queue is rebuilt.");
        break;
      case "delete-topic": {
        if (node.dataset.arm !== "1") {
          node.dataset.arm = "1";
          node.textContent = "Click again to delete";
          node.classList.add("danger");
          return;
        }
        const id = node.dataset.id;
        state.topics = state.topics.filter((t) => t.id !== id);
        persist();
        closeModal();
        render();
        toast("Topic deleted.");
        break;
      }
      case "fast-forward": {
        const days = 7;
        state.topics.forEach((t) => {
          if (t.lastReviewed) t.lastReviewed -= days * DAY;
          (t.history || []).forEach((h) => { h.t -= days * DAY; });
        });
        state.student.examDate = Math.max(startOfDay() + DAY, state.student.examDate - days * DAY);
        if (state.streak.lastDay) state.streak.lastDay = Math.max(0, state.streak.lastDay - days * DAY);
        persist();
        render();
        toast(`Skipped ${days} days. Watch retention fall.`);
        break;
      }
      case "reset-demo": {
        if (node.dataset.arm !== "1") {
          node.dataset.arm = "1";
          node.textContent = "Click again to reset";
          return;
        }
        localStorage.removeItem(STORE);
        state = seed();
        persist();
        ui.subject = "all";
        ui.query = "";
        ui.showSubjectForm = false;
        session = null;
        reviewRoot.innerHTML = "";
        node.textContent = "Reset demo data";
        delete node.dataset.arm;
        render();
        toast("Demo data restored.");
        break;
      }
      default:
        break;
    }
  }

  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-view]");
    if (nav) {
      e.preventDefault();
      setView(nav.dataset.view);
      return;
    }
    const grade = e.target.closest("[data-grade]");
    if (grade) {
      gradeItem(grade.dataset.grade);
      return;
    }
    const actionEl = e.target.closest("[data-action]");
    if (actionEl) {
      if (actionEl.dataset.action === "close-modal-bg" && e.target !== actionEl) return;
      handleAction(actionEl.dataset.action, actionEl);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (modalRoot.innerHTML) return;
    if (["input", "textarea", "select"].includes((e.target.tagName || "").toLowerCase())) return;
    const inReview = !!reviewRoot.querySelector(".review");
    if (!inReview) return;

    if (e.key === "Escape") { closeReview(); return; }

    if (session && session.index < session.items.length) {
      if (!session.revealed && (e.key === " " || e.key === "Enter") && e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") {
        e.preventDefault();
        reveal();
        return;
      }
      if (session.revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        gradeItem({ "1": "again", "2": "hard", "3": "good", "4": "easy" }[e.key]);
      }
    }
  });

  document.addEventListener("submit", (e) => {
    if (e.target.id === "topicForm") {
      e.preventDefault();
      const id = e.target.dataset.id;
      const title = $("#fTitle").value.trim();
      const note = $("#fNote").value.trim();
      const subjectId = $("#fSubject").value;
      if (!title) {
        $("#formError").textContent = "Give the topic a name.";
        return;
      }
      if (id) {
        const t = topicOf(id);
        if (t) { t.title = title; t.note = note; t.subjectId = subjectId; }
        toast("Topic updated.");
      } else {
        state.topics.push({
          id: uid("t_"), subjectId, title, note,
          stability: 0.5, lastReviewed: null, reps: 0, history: []
        });
        toast("Added. It is now in today's queue.");
      }
      persist();
      closeModal();
      render();
      return;
    }

    if (e.target.id === "subjectForm") {
      e.preventDefault();
      const name = $("#subjectName").value.trim();
      if (!name) return;
      if (state.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
        toast("That subject already exists.");
        return;
      }
      state.subjects.push({ id: uid("s_"), name, color: COLORS[state.subjects.length % COLORS.length], weight: 1 });
      ui.showSubjectForm = false;
      persist();
      renderLibrary();
      toast("Subject added.");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalRoot.innerHTML) closeModal();
  });

  /* ------------------------------------------------------------------- boot */

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches(".plan-row, .topic-card")) {
      const id = e.target.dataset.id;
      const t = id && topicOf(id);
      if (t) openReview([t]);
    }
  });

  setView("today");
})();
