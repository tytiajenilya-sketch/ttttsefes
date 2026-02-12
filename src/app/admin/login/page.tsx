"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Login failed.");
      }
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 sm:px-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
        <header className="rounded-3xl border border-white/60 bg-white/70 p-8 shadow-[var(--shadow)]">
          <p className="text-sm uppercase tracking-[0.35em] text-[var(--muted)]">
            Admin Login
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Best CA Shop</h1>
          <p className="mt-3 text-[var(--muted)]">
            Secure access to the booking dashboard.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/70 bg-[var(--surface)] p-8 shadow-[var(--shadow)]"
        >
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-semibold">Username</label>
              <input
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
                className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[var(--accent-deep)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
