"use client";

import React, { useState } from "react";

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUsername === "admin" && loginPassword === "admin123") {
      onLoginSuccess();
    } else {
      alert("Invalid credentials. Try admin / admin123.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="bg-orange-500 p-2 rounded-2xl h-16 w-16 shrink-0 shadow-lg shadow-orange-500/20 flex items-center justify-center">
            <img 
              src="/splash_logo_dark.png" 
              alt="Presenza Logo" 
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="font-extrabold text-2xl tracking-tight text-slate-800">
            PRESENZA ADMIN
          </h1>
          <p className="text-sm text-slate-400 font-semibold">Sign in to manage students &amp; faculty</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Username</label>
            <input
              type="text"
              placeholder="Username"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500"
              required
              suppressHydrationWarning
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500"
              required
              suppressHydrationWarning
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all shadow-md shadow-orange-500/10 cursor-pointer text-center"
            suppressHydrationWarning
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
