"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type OrderStage = "NEW" | "CONTACTING" | "BOOKED" | "CANCELLED" | "COMPLETED";

type Order = {
  id: string;
  fullName: string;
  email: string;
  roomLink: string | null;
  city: string;
  stage: OrderStage;
  createdAt: string;
  code: { code: string };
};

type Code = {
  id: string;
  code: string;
  status: "UNUSED" | "REDEEMED";
  createdAt: string;
  redeemedAt: string | null;
};

type Message = {
  id: string;
  orderId: string;
  sender: "CUSTOMER" | "ADMIN";
  body: string;
  createdAt: string;
};

const stages: OrderStage[] = [
  "NEW",
  "CONTACTING",
  "BOOKED",
  "CANCELLED",
  "COMPLETED",
];

const extractRange = (code: string) => {
  const match = code.match(/\((\d{3}-\d{3})\)$/);
  return match ? match[1] : "UNKNOWN";
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export default function AdminPage() {
  const [authStatus, setAuthStatus] = useState<
    "checking" | "authed" | "unauth"
  >("checking");
  const [orders, setOrders] = useState<Order[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [codesInput, setCodesInput] = useState("");
  const [showCodes, setShowCodes] = useState(true);
  const [generateCounts, setGenerateCounts] = useState({
    "150-250": "",
    "250-500": "",
    "500-750": "",
  });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const isReady = useMemo(() => authStatus === "authed", [authStatus]);
  const unusedByRange = useMemo(() => {
    const groups = new Map<string, string[]>();
    codes
      .filter((code) => code.status === "UNUSED")
      .forEach((code) => {
        const range = extractRange(code.code);
        const current = groups.get(range) ?? [];
        current.push(code.code);
        groups.set(range, current);
      });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [codes]);
  const uniqueMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  }, [messages]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/admin/me");
        if (!response.ok) {
          setAuthStatus("unauth");
          window.location.href = "/admin/login";
          return;
        }
        setAuthStatus("authed");
      } catch {
        setAuthStatus("unauth");
        window.location.href = "/admin/login";
      }
    };

    void checkAuth();
  }, []);

  useEffect(() => {
    if (isReady) {
      void loadAll();
    }
  }, [isReady]);

  useEffect(() => {
    if (selectedOrderId && isReady) {
      void loadMessages(selectedOrderId);
      connectStream(selectedOrderId);
    }

    return () => {
      streamAbortRef.current?.abort();
    };
  }, [selectedOrderId, isReady]);

  useEffect(() => {
    if (!selectedOrderId || !isReady) return;

    const interval = setInterval(() => {
      void loadMessages(selectedOrderId);
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedOrderId, isReady]);

  const fetchAdmin = async (path: string, options?: RequestInit) => {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    });

    const payload = await response.json().catch(async () => {
      const fallback = await response.text().catch(() => "Request failed.");
      return { error: fallback || "Request failed." };
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/admin/login";
      }
      throw new Error(payload.error ?? "Request failed.");
    }

    return payload;
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const [ordersPayload, codesPayload] = await Promise.all([
        fetchAdmin("/api/admin/orders"),
        fetchAdmin("/api/admin/codes"),
      ]);
      setOrders(ordersPayload.orders ?? []);
      setCodes(codesPayload.codes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data.");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (orderId: string) => {
    try {
      const payload = await fetchAdmin(
        `/api/admin/messages?orderId=${orderId}`
      );
      const incoming = Array.isArray(payload.messages) ? payload.messages : [];
      const seen = new Set<string>();
      const deduped = incoming.filter((entry: Message) => {
        if (seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      });
      setMessages(deduped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load messages.");
    }
  };

  const connectStream = async (orderId: string) => {
    streamAbortRef.current?.abort();
    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    try {
      const response = await fetch(
        `/api/admin/chat/stream?orderId=${orderId}`,
        {
          signal: abortController.signal,
        }
      );

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        parts.forEach((chunk) => {
          const line = chunk
            .split("\n")
            .find((entry) => entry.startsWith("data: "));
          if (!line) return;
          const json = line.replace("data: ", "");
          if (!json) return;
          try {
            const payload = JSON.parse(json) as Message;
            setMessages((prev) => {
              if (prev.some((msg) => msg.id === payload.id)) return prev;
              return [...prev, payload];
            });
          } catch {
            return;
          }
        });
      }
    } catch {
      return;
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  const handleCodesSubmit = async () => {
    const prepared = codesInput
      .split(/\r?\n/)
      .map((code) => code.trim())
      .filter(Boolean);

    if (prepared.length === 0) {
      setError("Paste at least one redemption code.");
      return;
    }

    try {
      setLoading(true);
      const result = await fetchAdmin("/api/admin/codes", {
        method: "POST",
        body: JSON.stringify({ codes: prepared }),
      });
      setMessage(`Added ${result.created ?? 0} code(s).`);
      setCodesInput("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add codes.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCodes = async (range: string) => {
    const entries = unusedByRange.find(([key]) => key === range)?.[1] ?? [];
    if (entries.length === 0) {
      setError("No unused codes to copy for this range.");
      return;
    }
    try {
      await navigator.clipboard.writeText(entries.join("\n"));
      setMessage(`Copied ${entries.length} code(s) for ${range}.`);
    } catch {
      setError("Unable to copy codes.");
    }
  };

  const handleGenerateCodes = async (
    range: "150-250" | "250-500" | "500-750"
  ) => {
    const rawCount = generateCounts[range];
    const count = Number(rawCount);

    if (!Number.isInteger(count) || count <= 0) {
      setError("Enter a valid quantity to generate.");
      return;
    }

    try {
      setLoading(true);
      const result = await fetchAdmin("/api/admin/codes", {
        method: "POST",
        body: JSON.stringify({
          mode: "generate",
          range,
          count,
        }),
      });
      setMessage(`Generated ${result.created ?? 0} code(s).`);
      setGenerateCounts((prev) => ({ ...prev, [range]: "" }));
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate codes.");
    } finally {
      setLoading(false);
    }
  };

  const handleStageUpdate = async (orderId: string, stage: OrderStage) => {
    try {
      setLoading(true);
      await fetchAdmin(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      });
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, stage } : order
        )
      );
      setMessage("Order stage updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedOrderId || !newMessage.trim()) return;

    try {
      const result = await fetchAdmin("/api/admin/messages", {
        method: "POST",
        body: JSON.stringify({
          orderId: selectedOrderId,
          message: newMessage.trim(),
        }),
      });
      setMessages((prev) => {
        if (prev.some((entry) => entry.id === result.message.id)) {
          return prev;
        }
        return [...prev, result.message];
      });
      setNewMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    }
  };

  const activeOrder = orders.find((order) => order.id === selectedOrderId);

  if (authStatus === "checking") {
    return <div className="p-6 text-sm">Checking admin access...</div>;
  }

  return (
    <div className="min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.35em] text-[var(--muted)]">
            Admin Console
          </p>
          <h1 className="text-4xl font-semibold">Orders + live chat</h1>
          <p className="max-w-2xl text-[var(--muted)]">
            Load antistock codes, track redemption status, set order stages, and
            chat with customers in real time.
          </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent)]"
          >
            Log out
          </button>
        </header>

        {(message || error) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error ?? message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/70 bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
              <h2 className="text-lg font-semibold">Load redemption codes</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Paste one code per line from antistock.io.
              </p>
              <textarea
                value={codesInput}
                onChange={(event) => setCodesInput(event.target.value)}
                rows={6}
                placeholder="ANTISTOCK-AB12\nANTISTOCK-XY34"
                className="mt-4 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
              />
              <button
                type="button"
                onClick={handleCodesSubmit}
                disabled={!isReady || loading}
                className="mt-4 w-full rounded-full bg-[var(--accent-deep)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Add codes
              </button>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[var(--shadow)]">
              <h2 className="text-lg font-semibold">Generate codes</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Enter a quantity for each price range, then generate.
              </p>
              <div className="mt-4 space-y-3">
                {(["150-250", "250-500", "500-750"] as const).map((range) => (
                  <div
                    key={range}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{range}</p>
                      <p className="text-xs text-[var(--muted)]">
                        Quantity to generate
                      </p>
                    </div>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={generateCounts[range]}
                      onChange={(event) =>
                        setGenerateCounts((prev) => ({
                          ...prev,
                          [range]: event.target.value.replace(/\D/g, ""),
                        }))
                      }
                      className="w-24 rounded-full border border-black/10 bg-white px-3 py-1 text-sm"
                      placeholder="0"
                    />
                    <button
                      type="button"
                      onClick={() => handleGenerateCodes(range)}
                      disabled={!isReady || loading}
                      className="rounded-full border border-[var(--accent)] px-4 py-1 text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
                    >
                      Generate
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[var(--shadow)]">
              <h2 className="text-lg font-semibold">Orders</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Select an order to view chat and update stage.
              </p>
              <div className="mt-4 space-y-3">
                {orders.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-black/10 p-4 text-sm text-[var(--muted)]">
                    No orders yet.
                  </div>
                )}
                {orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      selectedOrderId === order.id
                        ? "border-[var(--accent)] bg-white"
                        : "border-black/10 bg-white/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                          {order.code.code}
                        </p>
                        <p className="text-sm font-semibold">{order.fullName}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {order.city}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        {order.stage}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[var(--shadow)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Redemption codes</h2>
                <button
                  type="button"
                  onClick={() => setShowCodes((prev) => !prev)}
                  className="rounded-full border border-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent)]"
                >
                  {showCodes ? "Hide" : "Show"}
                </button>
              </div>
              {showCodes && (
                <div className="mt-4 space-y-3">
                  {codes.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-black/10 p-4 text-sm text-[var(--muted)]">
                      No codes loaded.
                    </div>
                  )}
                  {codes.map((code) => (
                    <div
                      key={code.id}
                      className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">{code.code}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {formatDate(code.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          code.status === "REDEEMED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {code.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[var(--shadow)]">
              <h2 className="text-lg font-semibold">Copy unused codes</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Copy unused codes grouped by price range.
              </p>
              <div className="mt-4 space-y-3">
                {unusedByRange.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-black/10 p-4 text-sm text-[var(--muted)]">
                    No unused codes available.
                  </div>
                )}
                {unusedByRange.map(([range, entries]) => (
                  <div
                    key={range}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{range}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {entries.length} unused code(s)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyCodes(range)}
                      disabled={entries.length === 0}
                      className="rounded-full border border-[var(--accent)] px-4 py-1 text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
            <h2 className="text-lg font-semibold">Live chat</h2>
            {activeOrder ? (
              <div className="mt-4 flex flex-col gap-4">
                <div className="rounded-2xl border border-black/10 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                        {activeOrder.code.code}
                      </p>
                      <p className="text-sm font-semibold">
                        {activeOrder.fullName}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {activeOrder.email}
                      </p>
                    </div>
                    <div className="text-right text-xs text-[var(--muted)]">
                      <p>{activeOrder.city}</p>
                      <p>{activeOrder.roomLink ?? "No room link"}</p>
                      <p>{formatDate(activeOrder.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-[var(--muted)]">Stage</label>
                    <select
                      value={activeOrder.stage}
                      onChange={(event) =>
                        handleStageUpdate(
                          activeOrder.id,
                          event.target.value as OrderStage
                        )
                      }
                      className="mt-2 w-full rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
                    >
                      {stages.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex-1 space-y-3 rounded-2xl border border-black/10 bg-white p-4">
                  {messages.length === 0 && (
                    <p className="text-sm text-[var(--muted)]">
                      No messages yet.
                    </p>
                  )}
                  {uniqueMessages.map((entry, index) => (
                    <div
                      key={`${entry.id ?? "message"}-${entry.createdAt ?? ""}-${index}`}
                      className={`flex ${
                        entry.sender === "ADMIN"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                          entry.sender === "ADMIN"
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

                <div className="flex gap-3">
                  <input
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    placeholder="Write a message..."
                    className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">
                Select an order to open the chat.
              </p>
            )}
          </div>
        </section>

        {loading && (
          <div className="text-sm text-[var(--muted)]">Refreshing data...</div>
        )}
      </div>
    </div>
  );
}
