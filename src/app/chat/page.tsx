"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Message = {
  id: string;
  orderId: string;
  sender: "CUSTOMER" | "ADMIN";
  body: string;
  createdAt: string;
};

type Order = {
  id: string;
  fullName: string;
  email: string;
  city: string;
  roomLink: string | null;
  stage: string;
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

function ChatClient() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") ?? "";
  const [code, setCode] = useState(initialCode);
  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);

  const isReady = useMemo(() => code.trim().length > 0, [code]);

  useEffect(() => {
    if (!isReady) return;

    const controller = new AbortController();
    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        const response = await fetch(
          `/api/chat/messages?code=${encodeURIComponent(code)}`,
          { signal: controller.signal }
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load chat.");
        }
        setOrder(payload.order);
        setMessages(payload.messages ?? []);
        setStatus("ready");
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unable to load chat.");
          setStatus("error");
        }
      }
    };

    load();

    const source = new EventSource(
      `/api/chat/stream?code=${encodeURIComponent(code)}`
    );

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Message;
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === payload.id)) return prev;
          return [...prev, payload];
        });
      } catch {
        return;
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      controller.abort();
      source.close();
    };
  }, [code, isReady]);

  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/chat/messages?code=${encodeURIComponent(code)}`
        );
        const payload = await response.json();
        if (!response.ok) return;
        setMessages((prev) => {
          const seen = new Set(prev.map((entry) => entry.id));
          const incoming = (payload.messages ?? []) as Message[];
          const merged = [...prev];
          incoming.forEach((entry) => {
            if (!seen.has(entry.id)) {
              seen.add(entry.id);
              merged.push(entry);
            }
          });
          return merged;
        });
      } catch {
        return;
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [code, isReady]);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, message: newMessage.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send message.");
      }
      setMessages((prev) => [...prev, payload.message]);
      setNewMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 sm:px-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="rounded-3xl border border-white/60 bg-white/70 p-8 shadow-[var(--shadow)]">
          <p className="text-sm uppercase tracking-[0.35em] text-[var(--muted)]">
            Best CA Shop
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Chat with our team</h1>
          <p className="mt-3 text-[var(--muted)]">
            Use the same redemption code to access your booking chat.
          </p>
        </header>

        <div className="rounded-3xl border border-white/70 bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
          <label className="text-sm font-semibold">Redemption code</label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="ANTISTOCK-AB12"
            className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {order && (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[var(--shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{order.fullName}</p>
                <p className="text-xs text-[var(--muted)]">{order.email}</p>
                <p className="text-xs text-[var(--muted)]">{order.city}</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {order.stage}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Room link: {order.roomLink ?? "Not provided"}
            </p>
          </div>
        )}

        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[var(--shadow)]">
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                {status === "loading"
                  ? "Loading chat..."
                  : "No messages yet."}
              </p>
            )}
            {messages.map((entry) => (
              <div
                key={entry.id}
                className={`flex ${
                  entry.sender === "CUSTOMER"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    entry.sender === "CUSTOMER"
                      ? "bg-[var(--accent-deep)] text-white"
                      : "bg-amber-50 text-[var(--foreground)]"
                  }`}
                >
                  <p>{entry.body}</p>
                  <p className="mt-1 text-[10px] opacity-70">
                    {entry.sender} · {formatDate(entry.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="mt-4 flex gap-3">
            <input
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              placeholder="Write a message..."
              className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
              disabled={!isReady}
            />
            <button
              type="submit"
              disabled={!isReady || !newMessage.trim()}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading chat...</div>}>
      <ChatClient />
    </Suspense>
  );
}
