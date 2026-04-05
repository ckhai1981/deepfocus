import { useState, useEffect, useRef, useCallback } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=JetBrains+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');`;

const HABITS = [
  { id: "meditation", label: "Morning Meditation", icon: "🧘", desc: "5+ min mindfulness" },
  { id: "noPhone", label: "Phone-Free Block", icon: "📵", desc: "1hr without phone" },
  { id: "deepWork", label: "Deep Work Session", icon: "🔱", desc: "Complete a focus session" },
  { id: "journal", label: "Focus Journal", icon: "📓", desc: "Write your intentions" },
  { id: "exercise", label: "Body Movement", icon: "⚡", desc: "Exercise for clarity" },
  { id: "sleep", label: "Sleep by 11pm", icon: "🌙", desc: "Rest fuels focus" },
];

const TIMER_PRESETS = [
  { label: "Flow", work: 25, break: 5 },
  { label: "Deep", work: 50, break: 10 },
  { label: "Sprint", work: 15, break: 3 },
];

const BREATHS = [
  { phase: "Inhale", duration: 4, color: "#c9a96e" },
  { phase: "Hold", duration: 4, color: "#a0c4b8" },
  { phase: "Exhale", duration: 6, color: "#7b9eb8" },
  { phase: "Hold", duration: 2, color: "#b8a07b" },
];

const todayKey = () => new Date().toISOString().split("T")[0];

// 👇 Replace "yourname" with your actual Buy Me a Coffee username
const BMC_URL = "https://buymeacoffee.com/ckhai";

export default function FocusApp() {
  const [tab, setTab] = useState("timer");
  const [timerPreset, setTimerPreset] = useState(0);
  const [isWork, setIsWork] = useState(true);
  const [seconds, setSeconds] = useState(TIMER_PRESETS[0].work * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [habits, setHabits] = useState({});
  const [streaks, setStreaks] = useState({});
  const [history, setHistory] = useState({});
  const [breathPhase, setBreathPhase] = useState(0);
  const [breathRunning, setBreathRunning] = useState(false);
  const [breathProgress, setBreathProgress] = useState(0);
  const [totalFocusMin, setTotalFocusMin] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const intervalRef = useRef(null);
  const breathRef = useRef(null);
  const breathElapsed = useRef(0);

  // Load from storage
  useEffect(() => {
    const load = async () => {
      try {
        const h = await window.storage.get("focus_habits");
        const s = await window.storage.get("focus_streaks");
        const hist = await window.storage.get("focus_history");
        const total = await window.storage.get("focus_total_min");
        const sess = await window.storage.get("focus_sessions");
        if (h) setHabits(JSON.parse(h.value));
        if (s) setStreaks(JSON.parse(s.value));
        if (hist) setHistory(JSON.parse(hist.value));
        if (total) setTotalFocusMin(parseInt(total.value) || 0);
        if (sess) setSessions(parseInt(sess.value) || 0);
      } catch {}
      setLoaded(true);
    };
    load();
  }, []);

  const save = useCallback(async (key, value) => {
    try { await window.storage.set(key, JSON.stringify(value)); } catch {}
  }, []);

  // Timer logic
  const preset = TIMER_PRESETS[timerPreset];
  const totalSecs = (isWork ? preset.work : preset.break) * 60;
  const progress = 1 - seconds / totalSecs;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            if (isWork) {
              const newSessions = sessions + 1;
              const newTotal = totalFocusMin + preset.work;
              setSessions(newSessions);
              setTotalFocusMin(newTotal);
              save("focus_sessions", newSessions);
              save("focus_total_min", newTotal);
              // Mark deep work habit
              const today = todayKey();
              const newHabits = { ...habits };
              if (!newHabits[today]) newHabits[today] = {};
              newHabits[today]["deepWork"] = true;
              setHabits(newHabits);
              save("focus_habits", newHabits);
            }
            setIsWork(w => !w);
            return isWork ? preset.break * 60 : preset.work * 60;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, isWork, preset, sessions, totalFocusMin, habits]);

  const resetTimer = () => {
    setRunning(false);
    clearInterval(intervalRef.current);
    setIsWork(true);
    setSeconds(TIMER_PRESETS[timerPreset].work * 60);
  };

  const switchPreset = (i) => {
    setTimerPreset(i);
    setRunning(false);
    clearInterval(intervalRef.current);
    setIsWork(true);
    setSeconds(TIMER_PRESETS[i].work * 60);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Habit logic
  const today = todayKey();
  const todayHabits = habits[today] || {};

  const toggleHabit = async (id) => {
    const newHabits = { ...habits };
    if (!newHabits[today]) newHabits[today] = {};
    newHabits[today][id] = !newHabits[today][id];
    setHabits(newHabits);
    // Update streak
    const newStreaks = { ...streaks };
    if (newHabits[today][id]) {
      newStreaks[id] = (newStreaks[id] || 0) + 1;
    } else {
      newStreaks[id] = Math.max(0, (newStreaks[id] || 1) - 1);
    }
    setStreaks(newStreaks);
    await save("focus_habits", newHabits);
    await save("focus_streaks", newStreaks);
  };

  const habitsDone = HABITS.filter(h => todayHabits[h.id]).length;

  // Breath logic
  useEffect(() => {
    if (breathRunning) {
      const phase = BREATHS[breathPhase];
      const duration = phase.duration * 1000;
      breathRef.current = setInterval(() => {
        breathElapsed.current += 50;
        setBreathProgress(breathElapsed.current / duration);
        if (breathElapsed.current >= duration) {
          breathElapsed.current = 0;
          setBreathPhase(p => (p + 1) % BREATHS.length);
          setBreathProgress(0);
        }
      }, 50);
    }
    return () => clearInterval(breathRef.current);
  }, [breathRunning, breathPhase]);

  const radius = 110;
  const circ = 2 * Math.PI * radius;

  if (!loaded) return <div style={{ background: "#0d0f14", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9a96e", fontFamily: "JetBrains Mono" }}>loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0b0d12", color: "#e8e0d0", fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <style>{FONTS}{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0b0d12; } ::-webkit-scrollbar-thumb { background: #2a2d35; }
        .tab-btn { background: none; border: none; cursor: pointer; padding: 10px 18px; font-family: 'DM Sans'; font-size: 13px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #4a5060; transition: all 0.25s; border-bottom: 2px solid transparent; }
        .tab-btn.active { color: #c9a96e; border-bottom-color: #c9a96e; }
        .tab-btn:hover { color: #8a8f9e; }
        .pill-btn { background: none; border: 1px solid #2a2d35; border-radius: 20px; padding: 6px 14px; font-size: 12px; cursor: pointer; color: #6a7080; transition: all 0.2s; font-family: 'JetBrains Mono'; }
        .pill-btn.active { background: #c9a96e22; border-color: #c9a96e88; color: #c9a96e; }
        .pill-btn:hover { border-color: #4a5060; color: #9a9fae; }
        .habit-row { display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-radius: 12px; background: #12151c; border: 1px solid #1e2128; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; }
        .habit-row:hover { border-color: #2e3140; background: #14171f; }
        .habit-row.done { border-color: #c9a96e44; background: #c9a96e08; }
        .check-box { width: 22px; height: 22px; border-radius: 6px; border: 1.5px solid #2e3140; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
        .check-box.checked { background: #c9a96e; border-color: #c9a96e; }
        .stat-card { background: #12151c; border: 1px solid #1e2128; border-radius: 14px; padding: 20px; }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 20px #c9a96e22} 50%{box-shadow:0 0 40px #c9a96e44} }
        .timer-ring { animation: ${running ? "pulseGlow 2s infinite" : "none"}; border-radius: 50%; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .fade-in { animation: fadeIn 0.4s ease; }
        .start-btn { background: linear-gradient(135deg, #c9a96e, #b8905a); border: none; border-radius: 50px; padding: 14px 40px; color: #0b0d12; font-family: 'DM Sans'; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; letter-spacing: 0.04em; }
        .start-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px #c9a96e44; }
        .start-btn.pause { background: #1e2128; color: #e8e0d0; border: 1px solid #2e3140; }
        .bmc-btn { display: inline-flex; align-items: center; gap: 7px; background: #c9a96e18; border: 1px solid #c9a96e55; border-radius: 50px; padding: 7px 16px; color: #c9a96e; font-size: 13px; font-family: 'DM Sans'; font-weight: 500; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .bmc-btn:hover { background: #c9a96e28; border-color: #c9a96e99; transform: translateY(-1px); box-shadow: 0 4px 16px #c9a96e22; }
        .bmc-float { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #c9a96e, #b8905a); border: none; border-radius: 50px; padding: 12px 24px; color: #0b0d12; font-size: 13px; font-family: 'DM Sans'; font-weight: 600; cursor: pointer; text-decoration: none; box-shadow: 0 4px 20px #c9a96e44; transition: all 0.2s; z-index: 100; white-space: nowrap; }
        .bmc-float:hover { box-shadow: 0 8px 28px #c9a96e55; }
        @keyframes floatPulse { 0%,100%{box-shadow:0 4px 20px #c9a96e44} 50%{box-shadow:0 4px 30px #c9a96e77} }
        .bmc-float { animation: floatPulse 3s infinite; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "24px 28px 0", borderBottom: "1px solid #1a1d24" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond'", fontSize: 26, fontWeight: 300, letterSpacing: "0.04em", color: "#e8e0d0" }}>
              deep<span style={{ color: "#c9a96e" }}>focus</span>
            </h1>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#3a3f50", letterSpacing: "0.1em" }}>TRAIN YOUR MIND</span>
            <div style={{ marginLeft: "auto" }}>
              <a href={BMC_URL} target="_blank" rel="noopener noreferrer" className="bmc-btn">☕ Support</a>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["timer", "habits", "breathe", "stats"].map(t => (
              <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 20px 100px" }}>

        {/* TIMER TAB */}
        {tab === "timer" && (
          <div className="fade-in">
            <div style={{ display: "flex", gap: 8, marginBottom: 32, justifyContent: "center" }}>
              {TIMER_PRESETS.map((p, i) => (
                <button key={i} className={`pill-btn ${timerPreset === i ? "active" : ""}`} onClick={() => switchPreset(i)}>
                  {p.label} · {p.work}m
                </button>
              ))}
            </div>

            {/* Timer Ring */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
              <div className="timer-ring" style={{ position: "relative", width: 260, height: 260 }}>
                <svg width="260" height="260" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="130" cy="130" r={radius} fill="none" stroke="#1a1d24" strokeWidth="6" />
                  <circle cx="130" cy="130" r={radius} fill="none" stroke={isWork ? "#c9a96e" : "#7b9eb8"}
                    strokeWidth="6" strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
                    strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 48, fontWeight: 300, color: "#e8e0d0", letterSpacing: "-2px" }}>{fmt(seconds)}</div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: isWork ? "#c9a96e" : "#7b9eb8", letterSpacing: "0.15em", marginTop: 4 }}>
                    {isWork ? "FOCUS" : "REST"}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 28 }}>
              <button className={`start-btn ${running ? "pause" : ""}`} onClick={() => setRunning(r => !r)}>
                {running ? "⏸ Pause" : "▶ Start Focus"}
              </button>
              <button className="pill-btn" style={{ padding: "12px 18px" }} onClick={resetTimer}>↺</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="stat-card" style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 32, color: "#c9a96e", fontWeight: 300 }}>{sessions}</div>
                <div style={{ fontSize: 12, color: "#4a5060", marginTop: 4, letterSpacing: "0.06em" }}>SESSIONS TODAY</div>
              </div>
              <div className="stat-card" style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 32, color: "#c9a96e", fontWeight: 300 }}>{totalFocusMin}</div>
                <div style={{ fontSize: 12, color: "#4a5060", marginTop: 4, letterSpacing: "0.06em" }}>TOTAL MINUTES</div>
              </div>
            </div>

            <div className="stat-card" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>💡</span>
              <div>
                <div style={{ fontSize: 13, color: "#8a8f9e", lineHeight: 1.5 }}>
                  {sessions === 0 ? "Start your first session. Close all distractions, set an intention." :
                   sessions < 3 ? "Good momentum. Each session trains your focus muscle." :
                   "Excellent discipline. You're building a powerful mind."}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HABITS TAB */}
        {tab === "habits" && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: "Cormorant Garamond", fontSize: 22, fontWeight: 300, color: "#e8e0d0" }}>Today's Rituals</div>
                <div style={{ fontSize: 13, color: "#4a5060", marginTop: 2 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 24, color: "#c9a96e" }}>{habitsDone}/{HABITS.length}</div>
                <div style={{ fontSize: 11, color: "#4a5060", letterSpacing: "0.06em" }}>COMPLETE</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 3, background: "#1a1d24", borderRadius: 2, marginBottom: 24, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg, #c9a96e, #e8c87a)", borderRadius: 2, width: `${(habitsDone / HABITS.length) * 100}%`, transition: "width 0.5s ease" }} />
            </div>

            {HABITS.map(h => {
              const done = !!todayHabits[h.id];
              const streak = streaks[h.id] || 0;
              return (
                <div key={h.id} className={`habit-row ${done ? "done" : ""}`} onClick={() => toggleHabit(h.id)}>
                  <div className={`check-box ${done ? "checked" : ""}`}>
                    {done && <span style={{ fontSize: 13, color: "#0b0d12" }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 22 }}>{h.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: done ? "#c9a96e" : "#c0bdb0" }}>{h.label}</div>
                    <div style={{ fontSize: 12, color: "#4a5060", marginTop: 1 }}>{h.desc}</div>
                  </div>
                  {streak > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "JetBrains Mono", fontSize: 12, color: "#c9a96e" }}>
                      🔥{streak}
                    </div>
                  )}
                </div>
              );
            })}

            {habitsDone === HABITS.length && (
              <div style={{ textAlign: "center", marginTop: 24, padding: "20px", background: "#c9a96e0a", border: "1px solid #c9a96e33", borderRadius: 14 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
                <div style={{ fontFamily: "Cormorant Garamond", fontSize: 20, color: "#c9a96e" }}>Perfect Day</div>
                <div style={{ fontSize: 13, color: "#6a7080", marginTop: 4 }}>All rituals complete. Your mind is sharp.</div>
              </div>
            )}
          </div>
        )}

        {/* BREATHE TAB */}
        {tab === "breathe" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontFamily: "Cormorant Garamond", fontSize: 22, fontWeight: 300, textAlign: "center", marginBottom: 6 }}>Box Breathing</div>
            <div style={{ fontSize: 13, color: "#4a5060", textAlign: "center", marginBottom: 36 }}>4-4-6-2 · Activates calm focus</div>

            {/* Breath circle */}
            <div style={{ position: "relative", width: 220, height: 220, marginBottom: 28 }}>
              <svg width="220" height="220" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="110" cy="110" r="90" fill="none" stroke="#1a1d24" strokeWidth="4" />
                <circle cx="110" cy="110" r="90" fill="none"
                  stroke={BREATHS[breathPhase].color}
                  strokeWidth="4"
                  strokeDasharray={2 * Math.PI * 90}
                  strokeDashoffset={2 * Math.PI * 90 * (1 - breathProgress)}
                  strokeLinecap="round"
                  style={{ transition: "stroke 0.5s" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{
                  width: breathRunning ? `${60 + breathProgress * 40}px` : "60px",
                  height: breathRunning ? `${60 + breathProgress * 40}px` : "60px",
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${BREATHS[breathPhase].color}44, ${BREATHS[breathPhase].color}11)`,
                  border: `1.5px solid ${BREATHS[breathPhase].color}66`,
                  transition: "all 0.1s linear",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                </div>
                <div style={{ marginTop: 12, fontFamily: "JetBrains Mono", fontSize: 13, color: BREATHS[breathPhase].color, letterSpacing: "0.1em" }}>
                  {breathRunning ? BREATHS[breathPhase].phase.toUpperCase() : "READY"}
                </div>
                <div style={{ fontSize: 12, color: "#3a3f50", marginTop: 2 }}>
                  {breathRunning ? `${BREATHS[breathPhase].duration}s` : ""}
                </div>
              </div>
            </div>

            <button className="start-btn" onClick={() => {
              if (breathRunning) { setBreathRunning(false); setBreathPhase(0); breathElapsed.current = 0; setBreathProgress(0); }
              else setBreathRunning(true);
            }}>
              {breathRunning ? "⏹ Stop" : "▶ Begin"}
            </button>

            {/* Phase guide */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 32, width: "100%" }}>
              {BREATHS.map((b, i) => (
                <div key={i} style={{ padding: "14px", background: breathPhase === i && breathRunning ? `${b.color}15` : "#12151c", border: `1px solid ${breathPhase === i && breathRunning ? b.color + "44" : "#1e2128"}`, borderRadius: 10, transition: "all 0.4s" }}>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: b.color, letterSpacing: "0.08em" }}>{b.phase.toUpperCase()}</div>
                  <div style={{ fontFamily: "Cormorant Garamond", fontSize: 22, color: "#c0bdb0", fontWeight: 300, marginTop: 2 }}>{b.duration}s</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, padding: "16px", background: "#12151c", border: "1px solid #1e2128", borderRadius: 12, width: "100%", fontSize: 13, color: "#6a7080", lineHeight: 1.6 }}>
              Box breathing reduces cortisol and activates the parasympathetic system — placing your mind in an optimal state for sustained focus.
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {tab === "stats" && (
          <div className="fade-in">
            <div style={{ fontFamily: "Cormorant Garamond", fontSize: 22, fontWeight: 300, marginBottom: 24 }}>Focus Intelligence</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div className="stat-card">
                <div style={{ fontSize: 11, color: "#4a5060", letterSpacing: "0.08em", marginBottom: 8 }}>TOTAL FOCUS TIME</div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 30, color: "#c9a96e", fontWeight: 300 }}>{totalFocusMin}</div>
                <div style={{ fontSize: 12, color: "#3a3f50", marginTop: 2 }}>minutes</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: 11, color: "#4a5060", letterSpacing: "0.08em", marginBottom: 8 }}>SESSIONS</div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 30, color: "#c9a96e", fontWeight: 300 }}>{sessions}</div>
                <div style={{ fontSize: 12, color: "#3a3f50", marginTop: 2 }}>completed</div>
              </div>
            </div>

            {/* Habit streaks */}
            <div className="stat-card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#4a5060", letterSpacing: "0.08em", marginBottom: 16 }}>HABIT STREAKS</div>
              {HABITS.map(h => {
                const s = streaks[h.id] || 0;
                const pct = Math.min(s / 30, 1);
                return (
                  <div key={h.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: "#8a8f9e" }}>{h.icon} {h.label}</span>
                      <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: s > 0 ? "#c9a96e" : "#3a3f50" }}>
                        {s > 0 ? `🔥 ${s}` : "—"}
                      </span>
                    </div>
                    <div style={{ height: 3, background: "#1a1d24", borderRadius: 2 }}>
                      <div style={{ height: "100%", background: "linear-gradient(90deg, #c9a96e88, #c9a96e)", width: `${pct * 100}%`, borderRadius: 2, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Focus score */}
            <div className="stat-card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#4a5060", letterSpacing: "0.08em", marginBottom: 12 }}>TODAY'S FOCUS SCORE</div>
              {(() => {
                const score = Math.round(((habitsDone / HABITS.length) * 50) + Math.min(sessions * 10, 50));
                const grade = score >= 90 ? ["S", "#c9a96e"] : score >= 70 ? ["A", "#a0c4b8"] : score >= 50 ? ["B", "#7b9eb8"] : ["C", "#8a7b9e"];
                return (
                  <>
                    <div style={{ fontFamily: "Cormorant Garamond", fontSize: 64, color: grade[1], fontWeight: 300, lineHeight: 1 }}>{grade[0]}</div>
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: "#4a5060", marginTop: 4 }}>{score} / 100</div>
                    <div style={{ fontSize: 13, color: "#6a7080", marginTop: 10 }}>
                      {score >= 90 ? "Elite focus. Rare discipline." : score >= 70 ? "Strong session. Keep the momentum." : score >= 50 ? "Solid start. Push a little further." : "Every master was once a beginner."}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Support card */}
            <div style={{ marginTop: 12, padding: "20px", background: "#c9a96e08", border: "1px solid #c9a96e22", borderRadius: 14, textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>☕</div>
              <div style={{ fontFamily: "Cormorant Garamond", fontSize: 18, color: "#c9a96e", fontWeight: 400, marginBottom: 6 }}>This app is free & always will be</div>
              <div style={{ fontSize: 13, color: "#6a7080", lineHeight: 1.6, marginBottom: 16 }}>
                If deepfocus helped you build better habits, consider buying me a coffee. It keeps this tool alive and ad-free. 🙏
              </div>
              <a href={BMC_URL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #c9a96e, #b8905a)", borderRadius: 50, padding: "11px 28px", color: "#0b0d12", fontWeight: 600, fontSize: 14, textDecoration: "none", fontFamily: "DM Sans" }}>
                ☕ Buy Me a Coffee
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Floating donate button */}
      <a href={BMC_URL} target="_blank" rel="noopener noreferrer" className="bmc-float">
        ☕ <span>Buy me a coffee</span>
      </a>
    </div>
  );
}
