"use client";

import { FormEvent, useState } from "react";

type RedeemState = "idle" | "loading" | "success" | "error";

export default function RedeemPage() {
  const [status, setStatus] = useState<RedeemState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [chatCode, setChatCode] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    fullName: "",
    email: "",
    roomLink: "",
    city: "",
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response
        .json()
        .catch(() => ({ error: "Request failed." }));

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to redeem code.");
      }

      setStatus("success");
      setMessage("Redemption received. Continue to chat with the admin.");
      setChatCode(payload.code ?? form.code.trim());
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unable to redeem.");
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="rounded-3xl border border-white/60 bg-white/70 p-8 shadow-[var(--shadow)]">
          <p className="text-sm uppercase tracking-[0.35em] text-[var(--muted)]">
            Best CA Shop
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Cheap booking redemption</h1>
          <p className="mt-3 text-[var(--muted)]">
            Step 1: enter the redemption code from antistock.io. Step 2: share
            your booking details so we can secure the reservation.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/70 bg-[var(--surface)] p-8 shadow-[var(--shadow)]"
        >
          <div className="grid gap-6">
            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                Step 1
              </p>
              <label className="mt-3 block text-sm font-semibold">
                Redemption code
              </label>
              <input
                required
                value={form.code}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, code: event.target.value }))
                }
                placeholder="ANTISTOCK-AB12"
                className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
              />
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                Step 2
              </p>
              <div className="mt-3 grid gap-4">
                <div>
                  <label className="text-sm font-semibold">Full legal name</label>
                  <input
                    required
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        fullName: event.target.value,
                      }))
                    }
                    placeholder="Name as on ID"
                    className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Email address</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    placeholder="you@email.com"
                    className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">
                    City where you want to book
                  </label>
                  <input
                    required
                    value={form.city}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, city: event.target.value }))
                    }
                    placeholder="City or hotel name"
                    className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">
                    Room link (optional)
                  </label>
                  <input
                    value={form.roomLink}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        roomLink: event.target.value,
                      }))
                    }
                    placeholder="https://hotel.com/room"
                    className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {message && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  status === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-full bg-[var(--accent-deep)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {status === "loading" ? "Submitting..." : "Continue to chat"}
            </button>
          </div>
        </form>

        {chatCode && (
          <a
            href={`/chat?code=${encodeURIComponent(chatCode)}`}
            className="rounded-full bg-[var(--accent)] px-6 py-3 text-center text-sm font-semibold text-white"
          >
            Open chat
          </a>
        )}
      </div>
    </div>
  );
}
