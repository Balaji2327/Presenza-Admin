"use client";

import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const trimmed = loginIdentifier.trim();
    // Allow typing either "admin" (mapped to admin@presenza.app) or full email
    const email = trimmed.includes("@") ? trimmed : `${trimmed.toLowerCase()}@presenza.app`;

    try {
      await signInWithEmailAndPassword(auth, email, loginPassword);
      onLoginSuccess();
    } catch (err: any) {
      console.error("Firebase auth login error:", err);
      let msg = "Invalid credentials. Please verify your admin email and password.";
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        msg = "Invalid email or password. Please try again.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Too many failed attempts. Please wait a minute and try again.";
      } else if (err.code === "auth/network-request-failed") {
        msg = "Network connection failed. Please check your internet.";
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 sm:p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="bg-orange-100 p-2 rounded-2xl h-16 w-16 shrink-0 shadow-lg shadow-orange-500/20 flex items-center justify-center">
            <img 
              src="/splash_logo_dark.png" 
              alt="Presenza Logo" 
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="font-extrabold text-2xl tracking-tight text-slate-800">
            PRESENZA ADMIN
          </h1>
          <p className="text-sm text-slate-400 font-semibold">Sign in with Firebase Admin Account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email or Username</label>
            <input
              type="text"
              placeholder="admin@presenza.app or admin"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500"
              required
              suppressHydrationWarning
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl font-bold transition-all shadow-md shadow-orange-500/10 cursor-pointer text-center"
            suppressHydrationWarning
          >
            {isLoading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>

      {errorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-50 border border-rose-100 mb-4">
              <svg className="h-6 w-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-extrabold text-slate-800">Login Failed</h3>
            <p className="text-xs text-slate-500 font-semibold mt-2">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="mt-5 w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer"
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
