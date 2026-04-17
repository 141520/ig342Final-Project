import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { db } from "../db/gameDb";
import MusicTempo from "music-tempo";

// ══════════════════════════════════════════════════════════════
// FONTS
// ══════════════════════════════════════════════════════════════
const F_DISPLAY = "'Bebas Neue', Impact, sans-serif";
const F_UI      = "'Inter', system-ui, sans-serif";
const F_SCORE   = "'Orbitron', monospace";

// ══════════════════════════════════════════════════════════════
// SONGS
// ══════════════════════════════════════════════════════════════
const SONGS = [
  { id: 1, name: "Sunset Valley", bpm: 95,  diff: "EASY",   file: "/ig342Final-Project/easy.mp3",    color: "#a78bfa" },
  { id: 2, name: "Neon City",     bpm: 128, diff: "NORMAL", file: "/ig342Final-Project/normal1.mp3", color: "#22d3ee" },
  { id: 3, name: "Cyber Drive",   bpm: 135, diff: "NORMAL", file: "/ig342Final-Project/normal2.mp3", color: "#34d399" },
  { id: 4, name: "Hard Core 1",   bpm: 160, diff: "HARD",   file: "/ig342Final-Project/hard1.mp3",   color: "#f87171" },
  { id: 5, name: "Dark Energy",   bpm: 175, diff: "HARD",   file: "/ig342Final-Project/hard2.mp3",   color: "#fb923c" },
  { id: 6, name: "The Boss",      bpm: 190, diff: "HARD",   file: "/ig342Final-Project/hard3.mp3",   color: "#e879f9" },
];

const DIFF_ORDER = { EASY: 0, NORMAL: 1, HARD: 2 };

// ══════════════════════════════════════════════════════════════
// GAME CONSTANTS
// ══════════════════════════════════════════════════════════════
const DIRS        = ["l", "d", "u", "r"];
const ARROWS      = { l: "←", d: "↓", u: "↑", r: "→" };
const DIR_LABEL   = { l: "LEFT", d: "DOWN", u: "UP", r: "RIGHT" };
const FALL_MS     = 1500;
const HIT_WINDOW  = 165;
const HIT_ZONE_PX = 75;

const NOTE_COLOR = { l: "#ff4f91", d: "#00ccff", u: "#7fff6e", r: "#ffe600" };
const NOTE_DARK  = { l: "#3d0018", d: "#003040", u: "#154500", r: "#403300" };

// ══════════════════════════════════════════════════════════════
// KEY BINDING DEFAULTS & STORAGE
// ══════════════════════════════════════════════════════════════
const DEFAULT_BINDINGS = {
  p1: { l: "a", d: "s", u: "w", r: "d" },
  p2: { l: "arrowleft", d: "arrowdown", u: "arrowup", r: "arrowright" },
};

function loadBindings() {
  try {
    const p1 = JSON.parse(localStorage.getItem("bd_p1")) || DEFAULT_BINDINGS.p1;
    const p2 = JSON.parse(localStorage.getItem("bd_p2")) || DEFAULT_BINDINGS.p2;
    return { p1, p2 };
  } catch { return DEFAULT_BINDINGS; }
}

function saveBindings(pid, obj) {
  localStorage.setItem(`bd_${pid}`, JSON.stringify(obj));
}

function keyLabel(k) {
  const m = {
    arrowleft:"←", arrowright:"→", arrowup:"↑", arrowdown:"↓",
    " ":"SPC", escape:"ESC", enter:"↵", backspace:"⌫",
    shift:"⇧", control:"CTL", alt:"ALT", tab:"TAB",
  };
  return m[k] || k.toUpperCase();
}

// ══════════════════════════════════════════════════════════════
// BEAT ANALYSIS ENGINE  (module-level cache)
// ══════════════════════════════════════════════════════════════
const beatCache   = {};
const beatStatus  = {};

function bpmBeats(bpm, n = 400) {
  const d = 60 / bpm;
  return Array.from({ length: n }, (_, i) => i * d);
}

async function runBeatAnalysis(song, onDone) {
  if (beatCache[song.id] || beatStatus[song.id] === "loading") return;
  beatStatus[song.id] = "loading";
  try {
    const res  = await fetch(song.file);
    if (!res.ok) throw new Error("fetch failed");
    const buf  = await res.arrayBuffer();
    const ctx  = new AudioContext();
    const dec  = await ctx.decodeAudioData(buf);
    ctx.close();
    const mt   = new MusicTempo(dec.getChannelData(0), { sampleRate: dec.sampleRate });
    beatCache[song.id] = { beats: mt.beats, bpm: mt.tempo };
    beatStatus[song.id] = "done";
  } catch (e) {
    console.warn("Beat analysis failed:", song.name, e.message);
    beatCache[song.id] = { beats: bpmBeats(song.bpm), bpm: song.bpm };
    beatStatus[song.id] = "error";
  }
  onDone(song.id);
}

// ══════════════════════════════════════════════════════════════
// NOTE HELPERS
// ══════════════════════════════════════════════════════════════
function calcNoteBottom(spawnTs, hwH) {
  return (1 - (performance.now() - spawnTs) / FALL_MS) * (hwH + 50);
}

let _noteId = 0;
function mkNote(pid, dir) {
  return { id: ++_noteId, pid, dir, spawnTs: performance.now(), hit: false };
}

// ══════════════════════════════════════════════════════════════
// CSS CHARACTER COMPONENT
// ══════════════════════════════════════════════════════════════
function getArmAngles(state, dir) {
  if (state === "miss") return { l: 65, r: -65 };
  if (state === "hit") {
    if (dir === "l") return { l: -115, r: -15 };
    if (dir === "r") return { l: 15,   r: 115  };
    if (dir === "u") return { l: -140, r: 140  };
    if (dir === "d") return { l: 60,   r: -60  };
  }
  return { l: -22, r: 22 };
}

function getLegAngles(state, dir) {
  if (state === "miss") return { l: 6, r: -6 };
  if (state === "hit") {
    if (dir === "l") return { l: -32, r: 12 };
    if (dir === "r") return { l: -12, r: 32 };
    if (dir === "u") return { l: -6,  r: 6  };
    if (dir === "d") return { l: -28, r: 28 };
  }
  return { l: -13, r: 13 };
}

function getBodyTransform(state, dir) {
  if (state === "miss") return "rotate(12deg) translateY(10px)";
  if (state === "hit") {
    if (dir === "l") return "rotate(-9deg)";
    if (dir === "r") return "rotate(9deg)";
    if (dir === "u") return "translateY(-15px) scale(1.1)";
    if (dir === "d") return "translateY(9px) scaleY(0.88)";
  }
  return "translateY(0px)"; // idle uses CSS animation override
}

const PARTICLE_DIRS = Array.from({ length: 8 }, (_, i) => {
  const deg = i * 45 - 90;
  return {
    x: Math.round(Math.cos(deg * Math.PI / 180) * 46),
    y: Math.round(Math.sin(deg * Math.PI / 180) * -46),
  };
});

function CSSChar({ pid, state, dir, color, combo = 0, beatBob = false }) {
  const isMiss  = state === "miss";
  const isHit   = state === "hit";
  const isIdle  = state === "idle";
  const robot   = pid === "p2";

  const comboTier  = combo >= 30 ? 3 : combo >= 15 ? 2 : combo >= 5 ? 1 : 0;
  const comboExtra = [0, 8, 18, 34][comboTier];

  const arms = getArmAngles(state, dir);
  const legs = getLegAngles(state, dir);

  const glowColor = isMiss ? "#f87171" : color;
  const glowBase  = isMiss ? 20 : isHit ? 26 : 8;

  const filterStr = [
    `drop-shadow(0 0 ${glowBase + comboExtra}px ${glowColor})`,
    comboTier >= 2 ? `drop-shadow(0 0 ${comboExtra}px ${color}88)` : null,
    comboTier >= 3 ? `drop-shadow(0 0 ${comboExtra * 1.5}px ${color}44)` : null,
  ].filter(Boolean).join(" ");

  const idleAnim = comboTier >= 3
    ? "cIdleDance 0.5s ease-in-out infinite"
    : "cIdleFloat 2.2s ease-in-out infinite";

  const bobShift = (isIdle && beatBob) ? " translateY(-6px) scaleY(0.94)" : "";

  const wrapStyle = {
    position: "relative",
    width: 58, height: 84,
    display: "inline-block",
    transform: getBodyTransform(state, dir) + bobShift,
    transition: beatBob ? "transform 0.07s ease-out" : "transform 0.13s ease-out",
    filter: filterStr,
    animation: isIdle && !beatBob ? idleAnim : "none",
  };

  const mkArm = (angle) => ({
    position: "absolute",
    top: 31, left: "50%",
    width: 5, height: 20,
    background: `${color}dd`,
    borderRadius: 3,
    transformOrigin: "top center",
    transform: `translateX(-50%) rotate(${angle}deg)`,
    transition: "transform 0.12s ease-out",
    boxShadow: isHit ? `0 0 7px ${color}88` : "none",
  });

  const mkLeg = (angle, offset) => ({
    position: "absolute",
    top: 53, left: `calc(50% + ${offset}px)`,
    width: 6, height: 24,
    background: `${color}99`,
    borderRadius: 3,
    transformOrigin: "top center",
    transform: `translateX(-50%) rotate(${angle}deg)`,
    transition: "transform 0.12s ease-out",
  });

  return (
    <div style={wrapStyle}>
      {/* Combo aura ring */}
      {comboTier >= 2 && isIdle && (
        <div style={{
          position: "absolute", inset: -14,
          borderRadius: "50%",
          border: `2px solid ${color}${comboTier >= 3 ? "cc" : "55"}`,
          animation: `comboAuraRing ${comboTier >= 3 ? 0.45 : 0.8}s ease-in-out infinite alternate`,
          pointerEvents: "none",
        }} />
      )}

      {/* HEAD */}
      <div style={{
        position: "absolute", top: 0, left: "50%",
        transform: "translateX(-50%)",
        width: 26, height: 26,
        borderRadius: robot ? 5 : "50%",
        background: `linear-gradient(135deg, ${color}, ${color}88)`,
        boxShadow: `0 0 ${10 + comboExtra}px ${color}99`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* Eyes */}
        {isMiss ? (
          <div style={{ display: "flex", gap: 4 }}>
            {["✕", "✕"].map((x, i) => (
              <span key={i} style={{ fontSize: 7, fontWeight: "900", color: "#fff", lineHeight: 1 }}>{x}</span>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: robot ? 5 : 4 }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                width: robot ? 5 : 4,
                height: (isHit && dir === "u") ? 7 : robot ? 3 : 4,
                borderRadius: robot ? 1 : 2,
                background: "#fff",
                boxShadow: "0 0 3px rgba(255,255,255,0.9)",
                transform: isHit
                  ? (dir === "l" && i === 0 ? "rotate(-15deg)" :
                     dir === "r" && i === 1 ? "rotate(15deg)"  : "none")
                  : "none",
              }} />
            ))}
          </div>
        )}
      </div>

      {/* NECK */}
      <div style={{
        position: "absolute", top: 26, left: "50%",
        transform: "translateX(-50%)",
        width: 4, height: 5,
        background: color, borderRadius: 2,
      }} />

      {/* BODY */}
      <div style={{
        position: "absolute", top: 30, left: "50%",
        transform: "translateX(-50%)",
        width: robot ? 22 : 16, height: 24,
        borderRadius: robot ? 4 : 8,
        background: `${color}cc`,
        boxShadow: `0 0 8px ${color}44`,
      }}>
        {/* chest detail */}
        {robot && (
          <div style={{
            position: "absolute", top: 5, left: "50%",
            transform: "translateX(-50%)",
            width: 8, height: 8, borderRadius: 2,
            background: `${color}ff`,
            boxShadow: `0 0 5px ${color}`,
            animation: isHit ? "robotCore 0.2s ease-out" : "robotPulse 1.5s ease-in-out infinite",
          }} />
        )}
      </div>

      {/* LEFT ARM */}
      <div style={mkArm(arms.l)} />
      {/* RIGHT ARM */}
      <div style={mkArm(arms.r)} />
      {/* LEFT LEG */}
      <div style={mkLeg(legs.l, -4)} />
      {/* RIGHT LEG */}
      <div style={mkLeg(legs.r, 4)} />

      {/* Hit burst ring */}
      {isHit && (
        <div style={{
          position: "absolute", inset: -6,
          borderRadius: robot ? 8 : "50%",
          border: `2px solid ${color}`,
          animation: "charHitRing 0.3s ease-out forwards",
          pointerEvents: "none",
        }} />
      )}

      {/* Second hit ring at high combo */}
      {isHit && comboTier >= 1 && (
        <div style={{
          position: "absolute", inset: -16,
          borderRadius: "50%",
          border: `2px solid ${color}88`,
          animation: "charHitRing 0.45s ease-out forwards",
          animationDelay: "0.05s",
          pointerEvents: "none",
        }} />
      )}

      {/* Miss danger ring */}
      {isMiss && (
        <div style={{
          position: "absolute", inset: -8,
          borderRadius: "50%",
          border: "2px solid #f87171",
          animation: "charMissRing 0.4s ease-out forwards",
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function Beatdown({ defaultName = "" }) {

  /* ─── screens & setup ─── */
  const [screen,       setScreen]       = useState("menu");
  const [selectedSong, setSelectedSong] = useState(SONGS[0]);
  const [mode,         setMode]         = useState(1);
  const [p1Name,       setP1Name]       = useState(defaultName);
  const [p2Name,       setP2Name]       = useState("");
  const [resultData,   setResultData]   = useState(null);
  const [analysed,     setAnalysed]     = useState({});

  /* ─── key bindings ─── */
  const [bindings,     setBindings]     = useState(loadBindings);
  const [listeningFor, setListeningFor] = useState(null);

  /* ─── leaderboard ─── */
  const [lbData,   setLbData]   = useState([]);
  const [lbFilter, setLbFilter] = useState("ALL");

  /* ─── live game data ─── */
  const [score1,    setScore1]    = useState(0);
  const [score2,    setScore2]    = useState(0);
  const [combo1,    setCombo1]    = useState(0);
  const [combo2,    setCombo2]    = useState(0);
  const [acc1,      setAcc1]      = useState(100);
  const [feedback,  setFeedback]  = useState({ text: "", cls: "" });

  /* ─── visuals ─── */
  const [charState,     setCharState]     = useState({ p1: "idle", p2: "idle" });
  const [charDir,       setCharDir]       = useState({ p1: null,   p2: null   });
  const [recPressed,    setRecPressed]    = useState({});
  const [laneFlash,     setLaneFlash]     = useState({});
  const [hitEffects,    setHitEffects]    = useState([]);
  const [hitParticles,  setHitParticles]  = useState([]);
  const [notePositions, setNotePositions] = useState({ p1: [], p2: [] });
  const [beatPulse,     setBeatPulse]     = useState(false);
  const [missFlash,     setMissFlash]     = useState(false);
  const [missShake,     setMissShake]     = useState(false);

  /* ─── game refs ─── */
  const playing       = useRef(false);
  const audioRef      = useRef(null);
  const rafRef        = useRef(null);
  const nextBeatRef   = useRef(0);
  const beatsRef      = useRef([]);
  const notesRef      = useRef({ p1: [], p2: [] });
  const hwHRef        = useRef(400);
  const hwRef         = useRef(null);
  const modeRef       = useRef(1);
  const scoreRef      = useRef({ p1: 0, p2: 0 });
  const comboRef      = useRef({ p1: 0, p2: 0 });
  const maxCombo      = useRef({ p1: 0, p2: 0 });
  const hitsRef       = useRef({ p1: 0, p2: 0 });
  const missRef       = useRef({ p1: 0, p2: 0 });
  const lastBeatIdx   = useRef(0);
  const sfxCtxRef     = useRef(null); // Web Audio for SFX

  /* ─── computed key maps (key → dir) ─── */
  const p1KeyMap = useMemo(() =>
    Object.fromEntries(Object.entries(bindings.p1).map(([d, k]) => [k, d])),
    [bindings.p1]);
  const p2KeyMap = useMemo(() =>
    Object.fromEntries(Object.entries(bindings.p2).map(([d, k]) => [k, d])),
    [bindings.p2]);

  // ════════════════════════════════════════════════
  // BEAT ANALYSIS
  // ════════════════════════════════════════════════
  useEffect(() => {
    const tick = id => setAnalysed(p => ({ ...p, [id]: beatStatus[id] }));
    if (screen === "menu") {
      SONGS.forEach(s => runBeatAnalysis(s, tick));
    } else {
      runBeatAnalysis(selectedSong, tick);
    }
  }, [screen, selectedSong]);

  // ════════════════════════════════════════════════
  // MISS SFX  (Web Audio API synthesizer)
  // ════════════════════════════════════════════════
  const playMissSfx = useCallback(() => {
    try {
      if (!sfxCtxRef.current) sfxCtxRef.current = new AudioContext();
      const ctx = sfxCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;

      // Deep "BWAH" bass drop — FNF-style miss tone
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const masterGain = ctx.createGain();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(160, now);
      osc1.frequency.exponentialRampToValueAtTime(55, now + 0.25);

      osc2.type = "square";
      osc2.frequency.setValueAtTime(80, now);
      osc2.frequency.exponentialRampToValueAtTime(40, now + 0.25);

      masterGain.gain.setValueAtTime(0.32, now);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);

      osc1.connect(masterGain);
      osc2.connect(masterGain);
      masterGain.connect(ctx.destination);

      osc1.start(now); osc1.stop(now + 0.30);
      osc2.start(now); osc2.stop(now + 0.30);

      // Music stutter — volume ducks momentarily (vinyl-scratch feel)
      if (audioRef.current && audioRef.current.readyState > 0) {
        audioRef.current.volume = 0.04;
        audioRef.current.playbackRate = 0.82;
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.volume = 1.0;
            audioRef.current.playbackRate = 1.0;
          }
        }, 200);
      }

      // Red screen flash
      setMissFlash(true);
      setTimeout(() => setMissFlash(false), 230);

    } catch (e) { console.warn("SFX error:", e); }
  }, []);

  // ════════════════════════════════════════════════
  // KEY BINDING LISTENER (settings screen)
  // ════════════════════════════════════════════════
  useEffect(() => {
    if (!listeningFor) return;
    const onKey = (e) => {
      e.preventDefault();
      const k = e.key.toLowerCase();
      if (k === "escape") { setListeningFor(null); return; }
      const { pid, dir } = listeningFor;
      const updated = { ...bindings[pid], [dir]: k };
      setBindings(prev => ({ ...prev, [pid]: updated }));
      saveBindings(pid, updated);
      setListeningFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listeningFor, bindings]);

  const resetBindings = () => {
    setBindings(DEFAULT_BINDINGS);
    saveBindings("p1", DEFAULT_BINDINGS.p1);
    saveBindings("p2", DEFAULT_BINDINGS.p2);
  };

  // ════════════════════════════════════════════════
  // ANIMATION HELPERS
  // ════════════════════════════════════════════════
  const fbTimer = useRef(null);
  const showFeedback = useCallback((text, cls) => {
    setFeedback({ text, cls });
    clearTimeout(fbTimer.current);
    fbTimer.current = setTimeout(() => setFeedback({ text: "", cls: "" }), 700);
  }, []);

  const charTimers = useRef({ p1: null, p2: null });
  const animChar = useCallback((pid, st, dir = null) => {
    setCharState(s => ({ ...s, [pid]: st }));
    setCharDir(s   => ({ ...s, [pid]: dir }));
    clearTimeout(charTimers.current[pid]);
    charTimers.current[pid] = setTimeout(() => {
      setCharState(s => ({ ...s, [pid]: "idle" }));
      setCharDir(s   => ({ ...s, [pid]: null  }));
    }, st === "miss" ? 480 : 260);
  }, []);

  const addHitEffect = useCallback((pid, dir, quality) => {
    const id = performance.now() + Math.random();
    setHitEffects(p => [...p, { id, pid, dir, quality }]);
    setTimeout(() => setHitEffects(p => p.filter(e => e.id !== id)), 480);
  }, []);

  const addHitParticles = useCallback((pid, dir) => {
    const id = performance.now() + Math.random();
    setHitParticles(p => [...p, { id, pid, dir }]);
    setTimeout(() => setHitParticles(p => p.filter(e => e.id !== id)), 700);
  }, []);

  // ════════════════════════════════════════════════
  // HIT / MISS
  // ════════════════════════════════════════════════
  const handleHit = useCallback((pid, quality, dir) => {
    const pts   = quality === "PERFECT" ? 100 : quality === "GOOD" ? 70 : 40;
    comboRef.current[pid]++;
    hitsRef.current[pid]++;
    maxCombo.current[pid] = Math.max(maxCombo.current[pid], comboRef.current[pid]);
    const bonus = 1 + Math.floor(comboRef.current[pid] / 10) * 0.15;
    scoreRef.current[pid] += Math.round(pts * bonus);
    if (pid === "p1") {
      setScore1(scoreRef.current.p1);
      setCombo1(comboRef.current.p1);
      const t = hitsRef.current.p1 + missRef.current.p1;
      setAcc1(t > 0 ? Math.round((hitsRef.current.p1 / t) * 100) : 100);
      showFeedback(quality + "!", quality.toLowerCase());
    } else {
      setScore2(scoreRef.current.p2);
      setCombo2(comboRef.current.p2);
    }
    animChar(pid, "hit", dir);
    addHitEffect(pid, dir, quality);
    addHitParticles(pid, dir);
    setLaneFlash(p => ({ ...p, [`${pid}-${dir}`]: Date.now() }));
    setTimeout(() => setLaneFlash(p => { const c = { ...p }; delete c[`${pid}-${dir}`]; return c; }), 110);
  }, [animChar, showFeedback, addHitEffect, addHitParticles]);

  const handleMiss = useCallback((pid) => {
    comboRef.current[pid] = 0;
    missRef.current[pid]++;
    if (pid === "p1") {
      setCombo1(0);
      const t = hitsRef.current.p1 + missRef.current.p1;
      setAcc1(t > 0 ? Math.round((hitsRef.current.p1 / t) * 100) : 100);
      showFeedback("MISS!", "miss");
    } else {
      setCombo2(0);
    }
    animChar(pid, "miss");
    playMissSfx();
    setMissShake(true);
    setTimeout(() => setMissShake(false), 450);
  }, [animChar, showFeedback, playMissSfx]);

  const tryHit = useCallback((pid, dir) => {
    if (!playing.current) return;
    setRecPressed(p => ({ ...p, [`${pid}-${dir}`]: true }));
    setTimeout(() => setRecPressed(p => ({ ...p, [`${pid}-${dir}`]: false })), 110);
    const pool = notesRef.current[pid].filter(n => !n.hit && n.dir === dir);
    let best = null, bestDiff = Infinity;
    pool.forEach(n => {
      const diff = Math.abs(calcNoteBottom(n.spawnTs, hwHRef.current) - HIT_ZONE_PX);
      if (diff < HIT_WINDOW && diff < bestDiff) { best = n; bestDiff = diff; }
    });
    if (best) {
      best.hit = true;
      handleHit(pid, bestDiff < 30 ? "PERFECT" : bestDiff < 70 ? "GOOD" : "OK", dir);
    } else {
      handleMiss(pid);
    }
  }, [handleHit, handleMiss]);

  // ════════════════════════════════════════════════
  // GAME LOOP  (beat-timestamp driven)
  // ════════════════════════════════════════════════
  const spawnNote = useCallback((pid) => {
    notesRef.current[pid].push(mkNote(pid, DIRS[Math.floor(Math.random() * 4)]));
  }, []);

  const shouldSpawn = useCallback((idx, diff) => {
    if (diff === "EASY")   return idx % 2 === 0;
    if (diff === "NORMAL") return idx % 4 !== 3;
    return true;
  }, []);

  const gameLoop = useCallback((ts) => {
    if (!playing.current) return;
    const audio = audioRef.current;
    if (!audio) { rafRef.current = requestAnimationFrame(gameLoop); return; }

    const t = audio.currentTime;

    const bi = Math.floor(t / (60 / selectedSong.bpm));
    if (bi !== lastBeatIdx.current && t > 0) {
      lastBeatIdx.current = bi;
      setBeatPulse(true);
      setTimeout(() => setBeatPulse(false), 85);
    }

    const beats = beatsRef.current;
    while (nextBeatRef.current < beats.length &&
           t >= beats[nextBeatRef.current] - FALL_MS / 1000) {
      if (shouldSpawn(nextBeatRef.current, selectedSong.diff)) {
        spawnNote("p1");
        if (modeRef.current === 2) spawnNote("p2");
        if (selectedSong.diff === "HARD" && Math.random() > 0.6) {
          spawnNote("p1");
          if (modeRef.current === 2) spawnNote("p2");
        }
      }
      nextBeatRef.current++;
    }

    const dead = { p1: [], p2: [] };
    ["p1", "p2"].forEach(pid => {
      if (pid === "p2" && modeRef.current === 1) { notesRef.current.p2 = []; return; }
      notesRef.current[pid].forEach(n => {
        if (n.hit) { dead[pid].push(n.id); return; }
        if (calcNoteBottom(n.spawnTs, hwHRef.current) < -70) { dead[pid].push(n.id); handleMiss(pid); }
      });
      notesRef.current[pid] = notesRef.current[pid].filter(n => !dead[pid].includes(n.id));
    });

    setNotePositions({
      p1: notesRef.current.p1.filter(n => !n.hit).map(n => ({ id: n.id, dir: n.dir, bottom: Math.round(calcNoteBottom(n.spawnTs, hwHRef.current)) })),
      p2: notesRef.current.p2.filter(n => !n.hit).map(n => ({ id: n.id, dir: n.dir, bottom: Math.round(calcNoteBottom(n.spawnTs, hwHRef.current)) })),
    });

    rafRef.current = requestAnimationFrame(gameLoop);
  }, [selectedSong, spawnNote, shouldSpawn, handleMiss]);

  // ════════════════════════════════════════════════
  // GAME STATE CONTROLS
  // ════════════════════════════════════════════════
  const startGame = useCallback(() => {
    if (!p1Name.trim()) { alert("กรุณาใส่ชื่อผู้เล่น 1"); return; }
    if (mode === 2 && !p2Name.trim()) { alert("กรุณาใส่ชื่อผู้เล่น 2"); return; }

    const data = beatCache[selectedSong.id] || { beats: bpmBeats(selectedSong.bpm) };
    beatsRef.current = data.beats;

    _noteId = 0;
    notesRef.current  = { p1: [], p2: [] };
    scoreRef.current  = { p1: 0, p2: 0 };
    comboRef.current  = { p1: 0, p2: 0 };
    maxCombo.current  = { p1: 0, p2: 0 };
    hitsRef.current   = { p1: 0, p2: 0 };
    missRef.current   = { p1: 0, p2: 0 };
    nextBeatRef.current = 0;
    lastBeatIdx.current = 0;
    modeRef.current = mode;

    setScore1(0); setScore2(0); setCombo1(0); setCombo2(0); setAcc1(100);
    setNotePositions({ p1: [], p2: [] });
    setCharState({ p1: "idle", p2: "idle" });
    setHitEffects([]);
    setFeedback({ text: "♪ GET READY ♪", cls: "perfect" });
    setResultData(null);
    setMissFlash(false);
    setScreen("game");

    const audio = audioRef.current;
    if (audio) {
      audio.src = selectedSong.file;
      audio.load();
      audio.currentTime = 0;
      audio.volume = 1.0;
      audio.playbackRate = 1.0;
      audio.play().catch(e => { console.error(e); if (e.name !== "AbortError") alert(`หาไฟล์เพลงไม่เจอ: ${selectedSong.file}`); });
    }

    playing.current = true;
    cancelAnimationFrame(rafRef.current);
    setTimeout(() => {
      if (hwRef.current) hwHRef.current = hwRef.current.getBoundingClientRect().height;
      rafRef.current = requestAnimationFrame(gameLoop);
    }, 100);
  }, [mode, selectedSong, p1Name, p2Name, gameLoop]);

  const endGame = useCallback(async () => {
    playing.current = false;
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.volume = 1.0;
      audioRef.current.playbackRate = 1.0;
    }

    const acc = pid => {
      const t = hitsRef.current[pid] + missRef.current[pid];
      return t > 0 ? Math.round((hitsRef.current[pid] / t) * 100) : 0;
    };
    const p1 = { score: scoreRef.current.p1, hits: hitsRef.current.p1, misses: missRef.current.p1, maxCombo: maxCombo.current.p1, accuracy: acc("p1") };
    const p2 = modeRef.current === 2 ? { score: scoreRef.current.p2, hits: hitsRef.current.p2, misses: missRef.current.p2, maxCombo: maxCombo.current.p2, accuracy: acc("p2") } : null;
    const winner = modeRef.current === 2 ? (p1.score > p2.score ? "p1" : p2.score > p1.score ? "p2" : "draw") : null;
    setResultData({ p1, p2, winner });
    setScreen("result");

    try {
      const ms = modeRef.current === 2 ? "2P" : "1P";
      await db.history.add({ player: p1Name.trim(), score: p1.score, accuracy: p1.accuracy, song: selectedSong.name, mode: ms, date: new Date().toLocaleString() });
      if (modeRef.current === 2 && p2Name) {
        await db.history.add({ player: p2Name.trim(), score: p2.score, accuracy: p2.accuracy, song: selectedSong.name, mode: "2P", date: new Date().toLocaleString() });
      }
    } catch (e) { console.error(e); }
  }, [p1Name, p2Name, selectedSong]);

  const loadLeaderboard = async () => {
    try {
      const d = await db.history.toArray();
      setLbData(d.sort((a, b) => b.score - a.score));
      setLbFilter("ALL");
      setScreen("leaderboard");
    } catch { alert("ไม่มีข้อมูล"); }
  };

  // Keyboard (game)
  useEffect(() => {
    const onDown = e => {
      const k = e.key.toLowerCase();
      if (screen !== "game") return;
      if (k === "escape") { endGame(); return; }
      if (p1KeyMap[k]) { e.preventDefault(); tryHit("p1", p1KeyMap[k]); }
      if (mode === 2 && p2KeyMap[k]) { e.preventDefault(); tryHit("p2", p2KeyMap[k]); }
    };
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, [screen, mode, tryHit, endGame, p1KeyMap, p2KeyMap]);

  useEffect(() => () => { playing.current = false; cancelAnimationFrame(rafRef.current); }, []);

  // ════════════════════════════════════════════════
  // RENDER HELPERS
  // ════════════════════════════════════════════════
  function analysisBadge(song) {
    if (beatStatus[song.id] === "done")    return { icon: "✅", tip: "Beat Synced" };
    if (beatStatus[song.id] === "loading") return { icon: "⏳", tip: "Analysing..." };
    if (beatStatus[song.id] === "error")   return { icon: "⚠️", tip: "BPM Mode" };
    return { icon: "🎵", tip: "Waiting" };
  }

  /* FNF diamond note/receptor */
  function Diamond({ dir, bottom, isRec = false, isPressed = false, isFlash = false }) {
    const col  = NOTE_COLOR[dir];
    const dark = NOTE_DARK[dir];
    return (
      <div style={{
        position: "absolute",
        bottom: isRec ? HIT_ZONE_PX : bottom,
        left: "50%",
        transform: `translateX(-50%) translateY(50%) rotate(45deg)${isPressed ? " scale(1.18)" : ""}`,
        width: isRec ? 54 : 49, height: isRec ? 54 : 49,
        borderRadius: 10,
        border: `3px solid ${col}`,
        background: isRec
          ? (isPressed ? `${col}cc` : `${dark}bb`)
          : `linear-gradient(135deg, ${col}ee, ${col}77)`,
        boxShadow: isRec
          ? (isPressed ? `0 0 28px ${col}, 0 0 56px ${col}55` : `0 0 8px ${col}44`)
          : `0 0 16px ${col}88, 0 0 32px ${col}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: isRec ? "all 0.06s" : "none",
        opacity: isRec ? (isPressed ? 1 : 0.62) : 1,
        zIndex: isRec ? 3 : 2,
        filter: isFlash ? `brightness(2) drop-shadow(0 0 10px ${col})` : "none",
      }}>
        <span style={{
          transform: "rotate(-45deg)",
          fontSize: isRec ? "1.25rem" : "1rem",
          color: isRec ? (isPressed ? "#fff" : col) : "#fff",
          fontWeight: "bold", lineHeight: 1, userSelect: "none",
          textShadow: `0 0 8px ${col}`,
          filter: "drop-shadow(0 0 3px rgba(0,0,0,0.9))",
        }}>{ARROWS[dir]}</span>
      </div>
    );
  }

  /* Particle burst on hit */
  function HitParticles({ dir }) {
    const col = NOTE_COLOR[dir];
    return (
      <>
        {PARTICLE_DIRS.map(({ x, y }, i) => (
          <div key={i} style={{
            position: "absolute",
            bottom: HIT_ZONE_PX + 27,
            left: "50%",
            width: 7, height: 7,
            borderRadius: 2,
            background: col,
            boxShadow: `0 0 8px ${col}, 0 0 16px ${col}66`,
            "--dx": `${x}px`,
            "--dy": `${y}px`,
            animation: "particleFly 0.55s ease-out forwards",
            animationDelay: `${i * 0.025}s`,
            pointerEvents: "none",
            zIndex: 15,
          }} />
        ))}
      </>
    );
  }

  /* Hit splash */
  function HitSplash({ dir, quality }) {
    const col = NOTE_COLOR[dir];
    return (
      <>
        {(quality === "PERFECT" ? [0, 1] : [0]).map(i => (
          <div key={i} style={{
            position: "absolute", bottom: HIT_ZONE_PX + 23, left: "50%",
            width: 54, height: 54,
            transform: "translateX(-50%) rotate(45deg)",
            borderRadius: 10,
            border: `3px solid ${col}`,
            boxShadow: `0 0 18px ${col}, 0 0 36px ${col}66`,
            animation: `fnfHit ${0.38 + i * 0.08}s ease-out forwards`,
            animationDelay: `${i * 0.06}s`,
            zIndex: 10, pointerEvents: "none",
          }} />
        ))}
        {quality === "PERFECT" && (
          <div style={{
            position: "absolute", bottom: HIT_ZONE_PX + 68, left: "50%",
            transform: "translateX(-50%)",
            fontFamily: F_DISPLAY, fontSize: "0.9rem", letterSpacing: 2,
            color: col, textShadow: `0 0 10px ${col}`,
            animation: "fnfLabel 0.6s ease-out forwards",
            zIndex: 11, whiteSpace: "nowrap", pointerEvents: "none",
          }}>PERFECT</div>
        )}
      </>
    );
  }

  /* Highway lane set */
  function Highway(pid, positions) {
    return (
      <div style={{ flex: 1, display: "flex", gap: 2, height: "100%" }}>
        {DIRS.map(dir => {
          const flash   = !!laneFlash[`${pid}-${dir}`];
          const pressed = !!recPressed[`${pid}-${dir}`];
          return (
            <div key={dir} style={{
              flex: 1, position: "relative", overflow: "hidden",
              borderRight: dir !== "r" ? "1px solid #12062a" : "none",
              background: flash ? `linear-gradient(to bottom, transparent 35%, ${NOTE_COLOR[dir]}15)` : "transparent",
              transition: "background 0.09s",
            }}>
              <div style={{ position: "absolute", bottom: HIT_ZONE_PX + 54, left: 0, right: 0, height: 1, background: `linear-gradient(to right, transparent, ${NOTE_COLOR[dir]}44, transparent)` }} />
              <Diamond dir={dir} isRec isPressed={pressed} isFlash={flash} />
              {positions.filter(n => n.dir === dir).map(n => <Diamond key={n.id} dir={dir} bottom={n.bottom} />)}
              {hitEffects.filter(e => e.pid === pid && e.dir === dir).map(e => <HitSplash key={e.id} dir={dir} quality={e.quality} />)}
              {hitParticles.filter(e => e.pid === pid && e.dir === dir).map(e => <HitParticles key={e.id} dir={dir} />)}
            </div>
          );
        })}
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // COMPUTED
  // ════════════════════════════════════════════════
  const filteredLb = lbFilter === "ALL"
    ? lbData.slice(0, 10)
    : lbData.filter(d => d.song === lbFilter).slice(0, 10);

  const p1HintKeys = DIRS.map(d => keyLabel(bindings.p1[d])).join("·");
  const p2HintKeys = DIRS.map(d => keyLabel(bindings.p2[d])).join("·");

  // ════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════
  return (
    <div style={S.wrap}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;700&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />
      <audio ref={audioRef} onEnded={endGame} preload="auto" />

      {/* ── Global miss flash overlay ── */}
      {missFlash && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(248,113,113,0.18)",
          pointerEvents: "none", zIndex: 200,
          animation: "missFlashFade 0.23s ease-out forwards",
        }} />
      )}

      {/* ────────────────────────────────────────
          MENU  (two-panel layout)
      ──────────────────────────────────────── */}
      {screen === "menu" && (
        <div style={{ width: "100%", maxWidth: 940, padding: "0 20px" }}>

          {/* Giant title */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h1 style={{
              fontFamily: F_DISPLAY, fontSize: "clamp(4.5rem, 10vw, 7.5rem)",
              letterSpacing: 10, margin: 0, lineHeight: 1,
              background: `linear-gradient(135deg, ${selectedSong.color} 0%, #60a5fa 50%, #f472b6 100%)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: `drop-shadow(0 0 40px ${selectedSong.color}55)`,
              transition: "filter 0.4s",
            }}>BEATDOWN</h1>
            <p style={{ fontFamily: F_UI, fontSize: "0.7rem", color: "#4b5563", letterSpacing: 5, marginTop: 4 }}>
              NEON RHYTHM BATTLE
            </p>
          </div>

          {/* Main card */}
          <div style={{
            display: "flex", borderRadius: 22,
            background: "rgba(12, 4, 30, 0.96)",
            border: `1px solid ${selectedSong.color}44`,
            overflow: "hidden",
            boxShadow: `0 0 80px ${selectedSong.color}18, 0 40px 100px rgba(0,0,0,0.7)`,
            transition: "border-color 0.4s, box-shadow 0.4s",
          }}>

            {/* LEFT: song list */}
            <div style={{ width: 210, borderRight: "1px solid rgba(255,255,255,0.05)", overflowY: "auto", paddingTop: 12 }}>
              <p style={{ fontFamily: F_UI, fontSize: "0.6rem", fontWeight: 700, color: "#374151", letterSpacing: 4, padding: "4px 18px 10px", textTransform: "uppercase" }}>
                SOUNDTRACK
              </p>
              {SONGS.map(s => {
                const active = s.id === selectedSong.id;
                const badge  = analysisBadge(s);
                return (
                  <button key={s.id} onClick={() => setSelectedSong(s)} style={{
                    width: "100%", textAlign: "left",
                    padding: "13px 18px",
                    background: active ? `${s.color}12` : "transparent",
                    border: "none",
                    borderLeft: `3px solid ${active ? s.color : "transparent"}`,
                    color: active ? "#f1f5f9" : "#6b7280",
                    cursor: "pointer",
                    display: "flex", flexDirection: "column", gap: 3,
                    transition: "all 0.15s",
                  }}>
                    <span style={{ fontFamily: F_UI, fontWeight: 700, fontSize: "0.875rem" }}>{s.name}</span>
                    <span style={{ fontFamily: F_UI, fontSize: "0.68rem", color: active ? s.color : "#374151", display: "flex", gap: 5, alignItems: "center" }}>
                      <span>{badge.icon}</span>
                      <span>{s.diff} · {s.bpm}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* RIGHT: details + controls */}
            <div style={{ flex: 1, padding: "32px 36px", display: "flex", flexDirection: "column", gap: 22, minHeight: 480 }}>

              {/* Song name */}
              <div>
                <h2 style={{
                  fontFamily: F_DISPLAY, fontSize: "3.8rem", letterSpacing: 4,
                  color: selectedSong.color, margin: 0, lineHeight: 1,
                  textShadow: `0 0 40px ${selectedSong.color}55`,
                  transition: "color 0.3s, text-shadow 0.3s",
                }}>
                  {selectedSong.name.toUpperCase()}
                </h2>

                <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: F_UI, fontWeight: 700, fontSize: "0.7rem", letterSpacing: 2, padding: "4px 14px", borderRadius: 20, background: `${selectedSong.color}22`, border: `1px solid ${selectedSong.color}66`, color: selectedSong.color }}>
                    {selectedSong.diff}
                  </span>
                  <span style={{ fontFamily: F_SCORE, fontSize: "0.8rem", color: "#94a3b8" }}>{selectedSong.bpm} BPM</span>
                  <span style={{ fontFamily: F_UI, fontSize: "0.7rem", color: beatStatus[selectedSong.id] === "done" ? "#4ade80" : "#fb923c" }}>
                    {analysisBadge(selectedSong).icon} {analysisBadge(selectedSong).tip}
                  </span>
                </div>

                <div style={{ marginTop: 18 }}>
                  <div style={{ height: 3, background: "#1e1035", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.round((selectedSong.bpm - 90) / 105 * 100)}%`,
                      background: `linear-gradient(to right, #7c3aed, ${selectedSong.color})`,
                      borderRadius: 2, transition: "width 0.4s ease",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                    {["SLOW", "MEDIUM", "FAST"].map(l => (
                      <span key={l} style={{ fontFamily: F_UI, fontSize: "0.6rem", fontWeight: 700, color: "#374151", letterSpacing: 2 }}>{l}</span>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
                  <span style={{ fontFamily: F_UI, fontSize: "0.6rem", fontWeight: 700, color: "#4b5563", letterSpacing: 3 }}>INTENSITY</span>
                  {[0, 1, 2].map(i => {
                    const on = i <= DIFF_ORDER[selectedSong.diff];
                    return (
                      <div key={i} style={{
                        width: on ? 22 : 7, height: 7, borderRadius: 4,
                        background: on ? selectedSong.color : "#1e1035",
                        boxShadow: on ? `0 0 8px ${selectedSong.color}` : "none",
                        transition: "all 0.3s",
                      }} />
                    );
                  })}
                </div>
              </div>

              {/* Game mode */}
              <div>
                <p style={{ fontFamily: F_UI, fontSize: "0.6rem", fontWeight: 700, color: "#4b5563", letterSpacing: 4, marginBottom: 10 }}>GAME MODE</p>
                <div style={{ display: "flex", gap: 10 }}>
                  {[1, 2].map(m => (
                    <button key={m} onClick={() => setMode(m)} style={{
                      flex: 1, padding: "11px",
                      fontFamily: F_UI, fontWeight: 700, fontSize: "0.9rem",
                      background: mode === m ? `${selectedSong.color}20` : "transparent",
                      border: `1px solid ${mode === m ? selectedSong.color : "#1e1035"}`,
                      color: mode === m ? selectedSong.color : "#4b5563",
                      borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                    }}>{m} PLAYER</button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => setScreen("nameInput")} style={{
                  padding: "16px", background: selectedSong.color, border: "none",
                  color: "#000", cursor: "pointer", borderRadius: 12,
                  fontFamily: F_DISPLAY, fontSize: "1.6rem", letterSpacing: 4,
                  boxShadow: `0 8px 30px ${selectedSong.color}55`,
                  transition: "all 0.15s",
                }}>
                  START GAME ▶
                </button>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { label: "🏆 LEADERBOARD", fn: loadLeaderboard },
                    { label: "⚙ KEY SETTINGS", fn: () => setScreen("settings") },
                  ].map(({ label, fn }) => (
                    <button key={label} onClick={fn} style={{
                      flex: 1, padding: "11px",
                      fontFamily: F_UI, fontWeight: 700, fontSize: "0.82rem",
                      background: "transparent",
                      border: "1px solid #1e1035",
                      color: "#6b7280", cursor: "pointer", borderRadius: 10,
                      transition: "all 0.15s",
                    }}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────
          NAME INPUT
      ──────────────────────────────────────── */}
      {screen === "nameInput" && (
        <div style={{ width: "100%", maxWidth: 460, padding: "0 20px" }}>
          <div style={{ background: "#0c0420", borderRadius: 20, overflow: "hidden", border: `1px solid ${selectedSong.color}44`, boxShadow: `0 0 60px ${selectedSong.color}18` }}>
            <div style={{ height: 4, background: `linear-gradient(to right, ${selectedSong.color}, #60a5fa)` }} />
            <div style={{ padding: "32px 32px" }}>
              <h2 style={{ fontFamily: F_DISPLAY, fontSize: "2.8rem", letterSpacing: 4, color: selectedSong.color, margin: "0 0 4px 0" }}>
                {selectedSong.name.toUpperCase()}
              </h2>
              <p style={{ fontFamily: F_UI, fontSize: "0.75rem", color: "#6b7280", marginBottom: 28, display: "flex", gap: 12 }}>
                <span>{selectedSong.diff}</span><span>·</span>
                <span>{selectedSong.bpm} BPM</span><span>·</span>
                <span>{analysisBadge(selectedSong).icon} {analysisBadge(selectedSong).tip}</span>
              </p>

              {[
                { label: "PLAYER 1", val: p1Name, set: setP1Name, color: "#c084fc" },
                ...(mode === 2 ? [{ label: "PLAYER 2", val: p2Name, set: setP2Name, color: "#22d3ee" }] : []),
              ].map(({ label, val, set, color }) => (
                <div key={label} style={{ marginBottom: 16 }}>
                  <p style={{ fontFamily: F_UI, fontSize: "0.65rem", fontWeight: 700, color, letterSpacing: 3, marginBottom: 6 }}>{label}</p>
                  <input
                    style={{ ...S.input, borderColor: "#1e1035" }}
                    placeholder={`Enter name for ${label}`}
                    value={val} onChange={e => set(e.target.value)}
                    onFocus={e => e.target.style.borderColor = color}
                    onBlur={e  => e.target.style.borderColor = "#1e1035"}
                  />
                </div>
              ))}

              <div style={{ background: "#080214", borderRadius: 10, padding: "10px 14px", marginBottom: 24, display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  { label: "P1 KEYS", keys: p1HintKeys, color: "#c084fc" },
                  ...(mode === 2 ? [{ label: "P2 KEYS", keys: p2HintKeys, color: "#22d3ee" }] : []),
                ].map(({ label, keys, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: F_UI, fontSize: "0.65rem", fontWeight: 700, color: "#4b5563", letterSpacing: 2 }}>{label}</span>
                    <span style={{ fontFamily: F_SCORE, fontSize: "0.8rem", color }}>{keys}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ flex: 1, padding: "13px", background: selectedSong.color, border: "none", color: "#000", cursor: "pointer", borderRadius: 10, fontFamily: F_DISPLAY, fontSize: "1.3rem", letterSpacing: 3 }} onClick={startGame}>
                  BATTLE START ⚡
                </button>
                <button style={{ padding: "13px 18px", background: "transparent", border: "1px solid #1e1035", color: "#6b7280", cursor: "pointer", borderRadius: 10, fontFamily: F_UI, fontWeight: 700, fontSize: "0.85rem" }} onClick={() => setScreen("menu")}>
                  ← BACK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────
          GAME SCREEN
      ──────────────────────────────────────── */}
      {screen === "game" && (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100vh", padding: "10px 18px", boxSizing: "border-box" }}>

          {/* HUD */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "stretch",
            marginBottom: 10, padding: "10px 20px", gap: 16,
            background: "rgba(8, 2, 20, 0.92)", borderRadius: 12,
            border: `1px solid ${beatPulse ? selectedSong.color + "99" : "#1e1035"}`,
            boxShadow: beatPulse ? `0 0 24px ${selectedSong.color}33` : "none",
            transition: "border-color 0.07s, box-shadow 0.07s",
          }}>
            {/* P1 stats */}
            <div style={{ minWidth: 130 }}>
              <p style={{ fontFamily: F_UI, fontWeight: 700, fontSize: "0.7rem", color: "#c084fc", letterSpacing: 2, margin: 0 }}>{p1Name || "P1"}</p>
              <p style={{ fontFamily: F_SCORE, fontWeight: 900, fontSize: "1.7rem", color: "#fff", margin: "2px 0", lineHeight: 1 }}>
                {score1.toLocaleString()}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontFamily: F_UI, fontSize: "0.7rem", color: "#fb923c" }}>×{combo1}</span>
                <span style={{ fontFamily: F_UI, fontSize: "0.7rem", color: acc1 >= 90 ? "#4ade80" : acc1 >= 70 ? "#facc15" : "#f87171" }}>{acc1}%</span>
              </div>
            </div>

            {/* Center */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontFamily: F_DISPLAY, fontSize: "1.1rem", letterSpacing: 3, color: selectedSong.color, margin: 0 }}>
                {selectedSong.name.toUpperCase()}
              </p>
              <p style={{ fontFamily: F_UI, fontSize: "0.65rem", color: "#374151", margin: "3px 0 0" }}>
                1P: {p1HintKeys}{mode === 2 ? ` · 2P: ${p2HintKeys}` : ""} · ESC: STOP
              </p>
              {feedback.text && (
                <p style={{
                  fontFamily: F_DISPLAY, fontSize: "1.5rem", letterSpacing: 3, margin: "4px 0 0",
                  color: feedback.cls === "perfect" ? "#c084fc" : feedback.cls === "good" ? "#22d3ee" : feedback.cls === "ok" ? "#4ade80" : "#f87171",
                  textShadow: "0 0 20px currentColor",
                  animation: "fnfFeedback 0.15s ease-out",
                }}>{feedback.text}</p>
              )}
            </div>

            {/* P2 stats or spacer */}
            {mode === 2 ? (
              <div style={{ minWidth: 130, textAlign: "right" }}>
                <p style={{ fontFamily: F_UI, fontWeight: 700, fontSize: "0.7rem", color: "#22d3ee", letterSpacing: 2, margin: 0 }}>{p2Name || "P2"}</p>
                <p style={{ fontFamily: F_SCORE, fontWeight: 900, fontSize: "1.7rem", color: "#fff", margin: "2px 0", lineHeight: 1 }}>
                  {score2.toLocaleString()}
                </p>
                <span style={{ fontFamily: F_UI, fontSize: "0.7rem", color: "#fb923c" }}>×{combo2}</span>
              </div>
            ) : <div style={{ minWidth: 130 }} />}
          </div>

          {/* Highway */}
          <div style={{
            flex: 1, display: "flex", gap: 20, overflow: "hidden",
            background: "#04000e",
            borderRadius: 14,
            border: `2px solid ${beatPulse ? selectedSong.color + "66" : "#0f0520"}`,
            padding: "14px 20px",
            transition: "border-color 0.07s",
            boxShadow: beatPulse ? `inset 0 0 40px ${selectedSong.color}18` : "none",
            animation: missShake ? "hwShake 0.42s ease-out" : "none",
          }}>
            {/* P1 side */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* CSS Character P1 */}
              <div style={{ textAlign: "center", marginBottom: 10, minHeight: 90 }}>
                <CSSChar pid="p1" state={charState.p1} dir={charDir.p1} color="#c084fc" combo={combo1} beatBob={beatPulse} />
              </div>
              <div style={{ flex: 1 }} ref={hwRef}>{Highway("p1", notePositions.p1)}</div>
            </div>

            {/* P2 side */}
            {mode === 2 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", borderLeft: "1px solid #12062a", paddingLeft: 20 }}>
                {/* CSS Character P2 */}
                <div style={{ textAlign: "center", marginBottom: 10, minHeight: 90 }}>
                  <CSSChar pid="p2" state={charState.p2} dir={charDir.p2} color="#22d3ee" combo={combo2} beatBob={beatPulse} />
                </div>
                <div style={{ flex: 1 }}>{Highway("p2", notePositions.p2)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────
          RESULT
      ──────────────────────────────────────── */}
      {screen === "result" && resultData && (
        <div style={{ textAlign: "center", background: "#08021a", padding: "40px 36px", borderRadius: 22, border: `1px solid ${selectedSong.color}55`, width: mode === 2 ? 740 : 420, maxWidth: "95vw", boxShadow: `0 0 80px ${selectedSong.color}22` }}>
          <h1 style={{ fontFamily: F_DISPLAY, fontSize: "3rem", letterSpacing: 6, color: selectedSong.color, margin: "0 0 4px" }}>
            {mode === 2 && resultData.winner === "draw" ? "⚖ DRAW" : "STAGE CLEAR"}
          </h1>
          {mode === 2 && resultData.winner !== "draw" && (
            <p style={{ fontFamily: F_DISPLAY, fontSize: "1.5rem", color: "#facc15", letterSpacing: 4, margin: "0 0 8px" }}>
              🏆 {resultData.winner === "p1" ? p1Name : p2Name} WINS
            </p>
          )}
          <p style={{ fontFamily: F_UI, fontSize: "0.8rem", color: "#6b7280", marginBottom: 28 }}>
            {selectedSong.name} · {selectedSong.diff}
          </p>

          <div style={{ display: "flex", gap: 14 }}>
            {[
              { pid: "p1", name: p1Name, d: resultData.p1, col: "#c084fc" },
              ...(mode === 2 && resultData.p2 ? [{ pid: "p2", name: p2Name, d: resultData.p2, col: "#22d3ee" }] : []),
            ].map(({ pid, name, d, col }) => (
              <div key={pid} style={{ flex: 1, background: "#100826", padding: "20px", borderRadius: 14, border: resultData.winner === pid ? "1px solid #facc15" : "1px solid #1e1035" }}>
                <p style={{ fontFamily: F_DISPLAY, fontSize: "1.2rem", letterSpacing: 3, color: col, margin: "0 0 14px", paddingBottom: 10, borderBottom: "1px solid #1e1035" }}>{name}</p>
                {[
                  ["SCORE",    d.score.toLocaleString(), col],
                  ["ACCURACY", d.accuracy + "%", d.accuracy >= 90 ? "#4ade80" : d.accuracy >= 70 ? "#facc15" : "#f87171"],
                  ["MAX COMBO",d.maxCombo, "#fb923c"],
                  ["HITS / MISS", `${d.hits} · ${d.misses}`, "#6b7280"],
                ].map(([lbl, val, vc]) => (
                  <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontFamily: F_UI, fontSize: "0.75rem", color: "#4b5563" }}>{lbl}</span>
                    <strong style={{ fontFamily: F_SCORE, fontSize: "0.9rem", color: vc }}>{val}</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
            <button style={S.btn(selectedSong.color)} onClick={() => setScreen("nameInput")}>▶ PLAY AGAIN</button>
            <button style={{ ...S.btn("#334155"), background: "transparent", border: "1px solid #334155", color: "#94a3b8" }} onClick={() => setScreen("menu")}>MENU</button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────
          LEADERBOARD  (per-song filter)
      ──────────────────────────────────────── */}
      {screen === "leaderboard" && (
        <div style={{ width: "100%", maxWidth: 600, padding: "0 20px" }}>
          <h1 style={{ fontFamily: F_DISPLAY, fontSize: "3rem", letterSpacing: 6, color: "#c084fc", textAlign: "center", margin: "0 0 20px" }}>
            🏆 LEADERBOARD
          </h1>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 18 }}>
            {["ALL", ...SONGS.map(s => s.name)].map(name => {
              const song = SONGS.find(s => s.name === name);
              const active = lbFilter === name;
              return (
                <button key={name} onClick={() => setLbFilter(name)} style={{
                  padding: "5px 14px", borderRadius: 20,
                  fontFamily: F_UI, fontWeight: 700, fontSize: "0.72rem", letterSpacing: 1,
                  background: active ? `${song?.color ?? "#c084fc"}25` : "transparent",
                  border: `1px solid ${active ? (song?.color ?? "#c084fc") : "#1e1035"}`,
                  color: active ? (song?.color ?? "#c084fc") : "#6b7280",
                  cursor: "pointer", transition: "all 0.14s",
                }}>
                  {name === "ALL" ? "🌐 ALL" : name}
                </button>
              );
            })}
          </div>

          <div style={{ background: "#0c0420", borderRadius: 16, border: "1px solid #1e1035", overflow: "hidden" }}>
            {filteredLb.length === 0 ? (
              <p style={{ fontFamily: F_UI, color: "#6b7280", padding: "32px", textAlign: "center" }}>ยังไม่มีคะแนนสำหรับด่านนี้</p>
            ) : filteredLb.map((d, i) => {
              const song = SONGS.find(s => s.name === d.song);
              const rankColor = i === 0 ? "#facc15" : i === 1 ? "#e2e8f0" : i === 2 ? "#fb923c" : "#4b5563";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 20px",
                  background: i % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent",
                  borderBottom: i < filteredLb.length - 1 ? "1px solid #1a0a3a" : "none",
                }}>
                  <span style={{ fontFamily: F_DISPLAY, fontSize: "1.5rem", color: rankColor, minWidth: 36, letterSpacing: 1 }}>
                    {i === 0 ? "👑" : `#${i + 1}`}
                  </span>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ fontFamily: F_UI, fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>{d.player}</p>
                    <p style={{ fontFamily: F_UI, fontSize: "0.7rem", color: song?.color ?? "#9ca3af", margin: "2px 0 0", display: "flex", gap: 6 }}>
                      <span>{d.song}</span><span>·</span><span>{d.mode}</span>
                      {d.accuracy != null && <><span>·</span><span>{d.accuracy}%</span></>}
                    </p>
                    <p style={{ fontFamily: F_UI, fontSize: "0.62rem", color: "#374151", margin: "2px 0 0" }}>{d.date}</p>
                  </div>
                  <span style={{ fontFamily: F_SCORE, fontWeight: 900, fontSize: "1.25rem", color: "#c084fc" }}>
                    {d.score.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>

          <button style={{ ...S.btn("#94a3b8"), background: "transparent", border: "1px solid #1e1035", color: "#6b7280", marginTop: 20, width: "100%" }} onClick={() => setScreen("menu")}>
            ← BACK
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────
          ⚙ KEY SETTINGS
      ──────────────────────────────────────── */}
      {screen === "settings" && (
        <div style={{ width: "100%", maxWidth: 680, padding: "0 20px" }}>
          <h1 style={{ fontFamily: F_DISPLAY, fontSize: "3.2rem", letterSpacing: 6, color: "#c084fc", textAlign: "center", margin: "0 0 6px" }}>
            ⚙ KEY SETTINGS
          </h1>
          <p style={{ fontFamily: F_UI, fontSize: "0.7rem", color: "#4b5563", textAlign: "center", letterSpacing: 2, marginBottom: 24 }}>
            CLICK A KEY → PRESS NEW KEY TO REMAP · ESC TO CANCEL
          </p>

          <div style={{ background: "#0c0420", borderRadius: 18, border: "1px solid #1e1035", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #1e1035" }}>
              {[["PLAYER 1", "#c084fc"], ["PLAYER 2", "#22d3ee"]].map(([label, col]) => (
                <div key={label} style={{ padding: "14px 24px", borderRight: label === "PLAYER 1" ? "1px solid #1e1035" : "none" }}>
                  <p style={{ fontFamily: F_DISPLAY, fontSize: "1.2rem", letterSpacing: 3, color: col, margin: 0 }}>{label}</p>
                  <p style={{ fontFamily: F_UI, fontSize: "0.65rem", color: "#374151", margin: "2px 0 0" }}>
                    {DIRS.map(d => keyLabel(bindings[label === "PLAYER 1" ? "p1" : "p2"][d])).join(" · ")}
                  </p>
                </div>
              ))}
            </div>

            {DIRS.map((dir, ri) => (
              <div key={dir} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                borderBottom: ri < DIRS.length - 1 ? "1px solid #0f0520" : "none",
              }}>
                {["p1", "p2"].map((pid, pi) => {
                  const isListen = listeningFor?.pid === pid && listeningFor?.dir === dir;
                  const curKey   = bindings[pid][dir];
                  const pidCol   = pid === "p1" ? "#c084fc" : "#22d3ee";
                  return (
                    <div key={pid} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 24px",
                      background: isListen ? `${pidCol}08` : "transparent",
                      borderRight: pi === 0 ? "1px solid #1e1035" : "none",
                      transition: "background 0.15s",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: F_SCORE, fontSize: "1.1rem", color: NOTE_COLOR[dir] }}>{ARROWS[dir]}</span>
                        <span style={{ fontFamily: F_UI, fontWeight: 700, fontSize: "0.8rem", color: "#94a3b8", letterSpacing: 1 }}>{DIR_LABEL[dir]}</span>
                      </div>
                      <button
                        onClick={() => setListeningFor(isListen ? null : { pid, dir })}
                        style={{
                          padding: "7px 18px",
                          fontFamily: F_SCORE, fontWeight: "bold", fontSize: "0.85rem",
                          background: isListen ? `${pidCol}22` : "rgba(255,255,255,0.04)",
                          border: `2px solid ${isListen ? pidCol : "#1e1035"}`,
                          color: isListen ? pidCol : "#e2e8f0",
                          borderRadius: 8, cursor: "pointer", minWidth: 90,
                          animation: isListen ? "settingPulse 0.9s ease-in-out infinite" : "none",
                          transition: "all 0.12s", letterSpacing: 1,
                        }}
                      >
                        {isListen ? "PRESS KEY" : keyLabel(curKey)}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 18, justifyContent: "center" }}>
            <button onClick={resetBindings} style={{ padding: "12px 26px", fontFamily: F_UI, fontWeight: 700, fontSize: "0.82rem", background: "transparent", border: "1px solid #7f1d1d", color: "#f87171", borderRadius: 10, cursor: "pointer" }}>
              ↺ RESET DEFAULTS
            </button>
            <button onClick={() => setScreen("menu")} style={{ padding: "12px 26px", fontFamily: F_UI, fontWeight: 700, fontSize: "0.82rem", background: "#c084fc22", border: "1px solid #c084fc", color: "#c084fc", borderRadius: 10, cursor: "pointer" }}>
              ← BACK TO MENU
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────
          CSS KEYFRAMES
      ──────────────────────────────────────── */}
      <style>{`
        /* ── FNF note effects ── */
        @keyframes fnfHit {
          0%   { transform: translateX(-50%) rotate(45deg) scale(1);   opacity: 1; }
          100% { transform: translateX(-50%) rotate(45deg) scale(2.9); opacity: 0; }
        }
        @keyframes fnfLabel {
          0%   { transform: translateX(-50%) translateY(0);    opacity: 1; }
          100% { transform: translateX(-50%) translateY(-30px); opacity: 0; }
        }
        @keyframes fnfFeedback {
          0%   { transform: scale(1.35); opacity: 0.7; }
          100% { transform: scale(1);    opacity: 1;   }
        }

        /* ── CSS Character animations ── */
        @keyframes cIdleFloat {
          0%,100% { transform: translateY(0px)   rotate(0deg);  }
          25%     { transform: translateY(-4px)  rotate(0.8deg); }
          75%     { transform: translateY(-2px)  rotate(-0.8deg); }
        }
        @keyframes charHitRing {
          0%   { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(2.2);  opacity: 0;   }
        }
        @keyframes charMissRing {
          0%   { transform: scale(0.9);  opacity: 1;   border-color: #f87171; }
          60%  { transform: scale(1.7);  opacity: 0.5; border-color: #fca5a5; }
          100% { transform: scale(2.4);  opacity: 0;   }
        }
        @keyframes robotPulse {
          0%,100% { opacity: 0.7; box-shadow: 0 0 4px currentColor; }
          50%     { opacity: 1;   box-shadow: 0 0 12px currentColor; }
        }
        @keyframes robotCore {
          0%   { transform: translateX(-50%) scale(1.8); opacity: 1; }
          100% { transform: translateX(-50%) scale(1);   opacity: 0.8; }
        }

        /* ── Miss screen flash ── */
        @keyframes missFlashFade {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }

        /* ── Settings key listen pulse ── */
        @keyframes settingPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(192,132,252,0.5); }
          50%     { box-shadow: 0 0 0 7px rgba(192,132,252,0); }
        }

        /* ── High combo idle dance ── */
        @keyframes cIdleDance {
          0%,100% { transform: translateY(0)    rotate(0deg)   scaleX(1);    }
          25%     { transform: translateY(-8px)  rotate(4deg)   scaleX(1.06); }
          75%     { transform: translateY(-5px)  rotate(-4deg)  scaleX(0.96); }
        }

        /* ── Combo aura ring (idle) ── */
        @keyframes comboAuraRing {
          0%   { transform: scale(0.88); opacity: 0.7; }
          100% { transform: scale(1.15); opacity: 0.15; }
        }

        /* ── Highway shake on miss ── */
        @keyframes hwShake {
          0%   { transform: translateX(0);   }
          12%  { transform: translateX(-9px); }
          27%  { transform: translateX(9px);  }
          42%  { transform: translateX(-6px); }
          57%  { transform: translateX(6px);  }
          75%  { transform: translateX(-3px); }
          100% { transform: translateX(0);   }
        }

        /* ── Hit particles ── */
        @keyframes particleFly {
          0%   { transform: translateX(-50%) rotate(45deg) translate(0px, 0px) scale(1);   opacity: 1; }
          100% { transform: translateX(-50%) rotate(45deg) translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SHARED STYLES
// ══════════════════════════════════════════════════════════════
const S = {
  wrap: {
    minHeight: "100vh",
    background: "#04010e",
    backgroundImage: "radial-gradient(ellipse at 50% 0%, #0e042e 0%, #04010e 65%)",
    color: "#fff",
    fontFamily: "'Inter', system-ui, sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "24px 0",
  },
  input: {
    padding: "12px 16px", width: "100%",
    background: "#06011a", border: "1px solid #1e1035",
    color: "#f1f5f9", marginBottom: 4,
    borderRadius: 10, boxSizing: "border-box",
    fontFamily: "'Inter', sans-serif", fontSize: "0.95rem",
    outline: "none", transition: "border-color 0.15s",
  },
  btn: col => ({
    padding: "13px 32px", background: col, border: "none",
    color: "#000", cursor: "pointer", borderRadius: 50,
    fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.15rem",
    letterSpacing: 2, transition: "all 0.15s",
    boxShadow: `0 6px 22px ${col}55`,
  }),
};
