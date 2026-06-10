"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Shield } from "lucide-react";
import { EditorPulseLogo } from "@/components/editor-pulse-logo";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/admin";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Login failed");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-950/70 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <EditorPulseLogo className="h-12 w-12 rounded-2xl shadow-lg shadow-cyan-950/40 ring-1 ring-white/10" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">Admin Login</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">EditorPulse secure access</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold">
            <Shield className="h-4 w-4" />
            Protected area
          </div>
          <p className="mt-2 text-slate-400">
            Enter your admin username and password to access uploads, edits, and delete controls.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
              autoComplete="username"
              placeholder="Admin username"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
              autoComplete="current-password"
              placeholder="Password"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Enter Admin"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          Secure session cookies are used for this panel.
        </p>
      </div>
    </div>
  );
}
