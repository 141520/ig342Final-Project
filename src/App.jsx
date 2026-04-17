import React, { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/sidebar";
import Beatdown from "./pages/Beatdown";
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from "./firebase";

// ─────────────────────────────────────────────────────────────
// MAIN APP COMPONENT
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");

  // ฟัง auth state จาก Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    setLoginError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login error:", err);
      if (err.code === "auth/popup-closed-by-user") return;
      setLoginError("เข้าสู่ระบบล้มเหลว กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05050a]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-violet-400 font-bold tracking-widest text-sm">LOADING...</p>
        </div>
      </div>
    );
  }

  // ── ยังไม่ Login → แสดงหน้า Landing + Login ──
  if (!user) {
    return <LandingPage onLogin={handleLogin} error={loginError} />;
  }

  // ── Login แล้ว → แสดงแอปพลิเคชันหลัก ──
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} onLogout={handleLogout} />
      <div className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/"        element={<Beatdown defaultName={user.displayName} />} />
          <Route path="/beatdown" element={<Beatdown defaultName={user.displayName} />} />
        </Routes>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LANDING PAGE — แสดงข้อมูลแอปและปุ่ม Login
// ─────────────────────────────────────────────────────────────
function LandingPage({ onLogin, error }) {
  return (
    <div className="min-h-screen bg-[#05050a] text-white font-sans overflow-y-auto">
      <link
        href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Grotesk:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-20 pb-16">
        {/* Glow background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-900/20 blur-3xl" />
        </div>

        {/* ชื่อโปรแกรม (EN + TH) */}
        <h1
          className="text-7xl md:text-8xl font-black tracking-widest leading-none mb-2"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            background: "linear-gradient(135deg, #a78bfa, #60a5fa, #f472b6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "none",
          }}
        >
          BEATDOWN
        </h1>
        <p className="text-2xl font-bold text-violet-300 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          บีทดาวน์
        </p>
        <p className="text-sm text-slate-500 mb-10 tracking-widest uppercase">
          Neon Rhythm Battle Game · เกมจังหวะนีออน
        </p>

        {/* Login Button */}
        <button
          onClick={onLogin}
          className="flex items-center gap-3 bg-white text-gray-800 font-bold px-8 py-4 rounded-full text-lg shadow-2xl hover:shadow-violet-500/30 hover:scale-105 transition-all duration-200 active:scale-95"
        >
          <GoogleIcon />
          เข้าสู่ระบบด้วย Google
        </button>
        {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}

        {/* GitHub Pages link */}
        <a
          href="https://141520.github.io/ig342Final-Project/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 text-xs text-slate-600 hover:text-violet-400 transition-colors underline underline-offset-4"
        >
          🌐 GitHub Pages: 141520.github.io/ig342Final-Project/
        </a>
      </section>

      {/* ── คำอธิบายแอปพลิเคชัน ── */}
      <section className="max-w-5xl mx-auto px-6 pb-16 grid md:grid-cols-3 gap-6">
        {/* What it does */}
        <InfoCard
          icon="🎮"
          title="ทำอะไรได้บ้าง"
          titleEn="What It Does"
          color="#a78bfa"
        >
          <ul className="text-sm text-slate-300 space-y-2 text-left">
            <li>🎵 เล่นเกมจังหวะตามบีทของเพลง (6 เพลง)</li>
            <li>🥊 โหมด 1 ผู้เล่น หรือ 2 ผู้เล่น</li>
            <li>⭐ สะสมคะแนนจาก PERFECT / GOOD / OK</li>
            <li>🔥 Combo Multiplier เพิ่มคะแนน</li>
            <li>🏆 ดู Leaderboard Top 10</li>
            <li>📴 เล่น Offline ได้ (PWA)</li>
          </ul>
        </InfoCard>

        {/* How to use */}
        <InfoCard
          icon="🕹️"
          title="วิธีการเล่น"
          titleEn="How to Play"
          color="#60a5fa"
        >
          <div className="text-sm text-slate-300 space-y-3 text-left">
            <div>
              <p className="font-bold text-blue-400 mb-1">ผู้เล่น 1 (1P)</p>
              <div className="grid grid-cols-4 gap-1 text-center">
                {[["A","←"],["S","↓"],["W","↑"],["D","→"]].map(([k,a]) => (
                  <div key={k} className="bg-slate-800 rounded px-1 py-2 text-xs">
                    <div className="font-black text-white">{k}</div>
                    <div className="text-slate-500">{a}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-bold text-blue-400 mb-1">ผู้เล่น 2 (2P)</p>
              <div className="grid grid-cols-4 gap-1 text-center">
                {[["←","←"],["↓","↓"],["↑","↑"],["→","→"]].map(([k,a]) => (
                  <div key={k} className="bg-slate-800 rounded px-1 py-2 text-xs">
                    <div className="font-black text-white">{k}</div>
                    <div className="text-slate-500">{a}</div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500">กด ESC เพื่อออกจากเกม</p>
          </div>
        </InfoCard>

        {/* Who it's for */}
        <InfoCard
          icon="👥"
          title="เหมาะกับใคร"
          titleEn="Who It's For"
          color="#f472b6"
        >
          <ul className="text-sm text-slate-300 space-y-2 text-left">
            <li>🎧 คนที่ชอบเพลงและเกมจังหวะ</li>
            <li>🎮 เกมเมอร์ที่ชอบ Arcade / Rhythm</li>
            <li>👫 เล่นสองคนแข่งกันสนุก</li>
            <li>📱 ใช้ได้บน Desktop / Laptop</li>
            <li>🏫 โปรเจกต์วิชา IG342 DPU</li>
          </ul>
        </InfoCard>
      </section>

      {/* ── ข้อมูลที่เก็บ ── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8">
          <h2 className="text-lg font-black text-violet-400 mb-6 tracking-widest uppercase flex items-center gap-2">
            🗄️ ข้อมูลที่แอปพลิเคชันเก็บ / Data Storage
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <DataRow
              icon="👤"
              title="บัญชีผู้ใช้ (Google)"
              detail="ชื่อ · อีเมล · รูปโปรไฟล์ เก็บชั่วคราวใน Session — ออกจากระบบแล้วหายทันที"
              where="Firebase Auth (Google)"
              color="text-yellow-400"
            />
            <DataRow
              icon="🏆"
              title="คะแนน Leaderboard"
              detail="ชื่อผู้เล่น · คะแนน · เพลง · โหมด · วันที่ เก็บบนอุปกรณ์ผู้ใช้ Top 10"
              where="IndexedDB (Dexie) — บนเครื่องผู้ใช้"
              color="text-green-400"
            />
            <DataRow
              icon="⚙️"
              title="Cache ออฟไลน์"
              detail="ไฟล์แอปและเพลงถูก Cache ไว้เพื่อใช้งานแบบ Offline"
              where="Service Worker (PWA Cache)"
              color="text-blue-400"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-slate-700">
        IG342 Final Project · Dhurakij Pundit University · 65112488
      </footer>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────
function InfoCard({ icon, title, titleEn, color, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-black text-base mb-0.5" style={{ color }}>
        {title}
      </h3>
      <p className="text-xs text-slate-600 mb-4">{titleEn}</p>
      {children}
    </div>
  );
}

function DataRow({ icon, title, detail, where, color }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <span className={`font-bold text-sm ${color}`}>{title}</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{detail}</p>
      <p className="text-xs text-slate-600 italic">📍 {where}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
