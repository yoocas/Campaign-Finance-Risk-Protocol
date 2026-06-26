"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Lock } from "lucide-react";

export default function GatePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Only honor same-origin relative paths to avoid open redirects. */
  function safeDestination(): string {
    if (typeof window === "undefined") return "/";
    const from = new URLSearchParams(window.location.search).get("from");
    if (from && from.startsWith("/") && !from.startsWith("//")) return from;
    return "/";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/demo-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(safeDestination());
        router.refresh();
        return;
      }
      setError(
        res.status === 401
          ? "Incorrect password. Please try again."
          : "Something went wrong. Please try again.",
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage text-white shadow-sm">
            <BarChart3 size={20} strokeWidth={2.2} aria-hidden />
          </span>
          <div>
            <h1 className="font-serif text-lg font-semibold leading-tight tracking-tight text-ink">
              Campaign Risk Copilot Demo
            </h1>
            <p className="text-xs text-muted">Synthetic-data prototype</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label
            htmlFor="demo-password"
            className="block text-xs font-medium text-ink-soft"
          >
            Demo access password
          </label>
          <div className="relative">
            <Lock
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <input
              id="demo-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded-lg border border-line bg-card-alt py-2.5 pl-9 pr-3 text-sm text-ink outline-none focus:border-sage focus:bg-card"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-danger-line bg-danger-bg px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="w-full rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sage-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Checking…" : "Enter"}
          </button>
        </form>

        <p className="mt-5 flex items-start gap-2 border-t border-line-soft pt-4 text-[11px] leading-relaxed text-warn">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
          Use synthetic or anonymized data only.
        </p>
      </div>
    </main>
  );
}
