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
      if (process.env.NODE_ENV !== "production") {
        console.error("Auth error code:", err?.code);
      }
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
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] font-sans p-4 sm:p-6">
      <div className="w-full max-w-[420px] bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_1px_3px_0_rgba(15,23,42,0.06),0_10px_25px_-5px_rgba(15,23,42,0.04)] p-7 sm:p-9 space-y-7">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center p-2 shadow-xs">
            <img 
              src="/splash_logo_dark.png" 
              alt="Presenza Logo" 
              className="h-full w-full object-contain"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Presenza Administration
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              Sign in with institutional administrator credentials
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              Email or Username
            </label>
            <input
              type="text"
              placeholder="admin@presenza.app or admin"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 disabled:bg-slate-50 disabled:text-slate-400"
              required
              suppressHydrationWarning
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-700">
                Password
              </label>
            </div>
            <input
              type="password"
              placeholder="Enter your account password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 disabled:bg-slate-50 disabled:text-slate-400"
              required
              suppressHydrationWarning
              disabled={isLoading}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:bg-orange-300 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
              suppressHydrationWarning
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>

        {/* Security Notice Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center font-normal">
          <span>Protected by Firebase Enterprise Auth</span>
        </div>
      </div>

      {/* Error Dialog Modal */}
      {errorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-150">
            <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-full bg-rose-50 border border-rose-100 mb-3.5">
              <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Authentication Failed</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="mt-5 w-full py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
