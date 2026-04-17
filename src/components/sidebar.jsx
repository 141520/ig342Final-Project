import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Sidebar({ user, onLogout }) {
  const location = useLocation();

  const menuItems = [
    { path: "/beatdown", label: "BEATDOWN", icon: "🎧" },
  ];

  return (
    <nav className="w-72 bg-[#0f172a] text-slate-200 p-6 flex flex-col h-screen sticky top-0 border-r border-slate-800 shadow-2xl">
      {/* Branding */}
      <div className="mb-8 px-2">
        <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 w-12 h-12 rounded-2xl mb-4 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <span className="text-xl font-black text-white">BD</span>
        </div>
        <h2 className="text-xl font-black text-white tracking-tight">BEATDOWN</h2>
        <h2 className="text-sm font-bold text-violet-400 tracking-wide">บีทดาวน์</h2>
      </div>

      {/* Nav Links */}
      <div className="flex flex-col gap-2 mb-auto">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 ${
              location.pathname === item.path || location.pathname === "/"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-105"
                : "hover:bg-slate-800 text-slate-400 hover:text-slate-100"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      {/* User Info + Logout */}
      {user && (
        <div className="mt-6 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="profile"
                className="w-9 h-9 rounded-full border-2 border-violet-500"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold text-white">
                {(user.displayName || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {user.displayName || "Player"}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-900/30 py-2 px-3 rounded-xl transition-all text-left"
          >
            🚪 ออกจากระบบ
          </button>
        </div>
      )}

      {/* System Status */}
      <div className="mt-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">System Status</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-[10px] font-bold text-green-500 uppercase">Ready to Play</p>
        </div>
        <p className="text-[10px] text-slate-600 mt-1">65112488</p>
      </div>
    </nav>
  );
}
