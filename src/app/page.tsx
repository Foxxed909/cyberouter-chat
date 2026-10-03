"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BASE_URL = "https://router.enclave.ai/v1";
const STORAGE_KEY = "cyberouter_api_key";
const MODEL_KEY = "cyberouter_model";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

type Model = {
  id: string;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("auto");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const k = localStorage.getItem(STORAGE_KEY) || "";
    const m = localStorage.getItem(MODEL_KEY) || "auto";
    setApiKey(k);
    setModel(m);
    if (!k) setSettingsOpen(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchModels = useCallback(async (key: string) => {
    if (!key.trim()) return;
    setLoadingModels(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${key.trim()}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const list: Model[] = Array.isArray(data?.data) ? data.data : [];
      setModels(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load models");
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (apiKey.trim()) fetchModels(apiKey);
  }, [apiKey, fetchModels]);

  const saveKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem(STORAGE_KEY, key);
  };

  const saveModel = (m: string) => {
    setModel(m);
    localStorage.setItem(MODEL_KEY, m);
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!apiKey.trim()) {
      setError("Add your API key in settings first.");
      setSettingsOpen(true);
      return;
    }

    const userMsg: Message = { id: uid(), role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    const assistantId = uid();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const payload = {
        model: model || "auto",
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        stream: true,
      };

      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta =
              json.choices?.[0]?.delta?.content ??
              json.choices?.[0]?.message?.content ??
              "";
            if (delta) {
              full += delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: full } : m
                )
              );
            }
          } catch {
            // ignore
          }
        }
      }

      if (!full) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "(empty response)" } : m
          )
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setError(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `Error: ${msg}` } : m
        )
      );
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-xl">✦</span>
          <h1 className="text-lg font-semibold tracking-tight">Cyberouter Chat</h1>
          <span className="hidden text-xs text-zinc-500 sm:inline">
            router.enclave.ai
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="Clear chat"
          >
            Clear
          </button>
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="Settings"
          >
            Settings
          </button>
        </div>
      </header>

      {settingsOpen && (
        <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 px-4 py-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-300">API Key</span>
              <div className="flex gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => saveKey(e.target.value)}
                  placeholder="Paste key from router.enclave.ai"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="rounded-lg border border-zinc-700 px-3 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Get a key at{" "}
                <a
                  href="https://router.enclave.ai"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  router.enclave.ai
                </a>
                . Stored only in your browser.
              </p>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-300">Model</span>
              <div className="flex gap-2">
                <select
                  value={model}
                  onChange={(e) => saveModel(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="auto">auto (router picks)</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => fetchModels(apiKey)}
                  disabled={loadingModels || !apiKey.trim()}
                  className="rounded-lg border border-zinc-700 px-3 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {loadingModels ? "…" : "Refresh"}
                </button>
              </div>
            </label>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <p className="text-4xl text-zinc-600">◎</p>
              <p className="text-zinc-400">
                Chat with cyber-capable open-weight models
              </p>
              <p className="max-w-md text-sm text-zinc-500">
                Vulnerability discovery, exploitation, triage, remediation —
                or general reasoning. Set your key, pick a model (or leave on
                auto), and send a message.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-100"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {m.content ||
                    (loading && m.role === "assistant" ? "…" : "")}
                </div>
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="shrink-0 border-t border-zinc-800 px-4 py-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="max-h-40 min-h-[44px] flex-1 resize-y rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {loading ? "…" : "Send"}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-zinc-600">
          Powered by{" "}
          <a
            href="https://router.enclave.ai"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-zinc-400"
          >
            Enclave Cyberouter
          </a>
          {" · "}Keys stay in your browser · OpenAI-compatible
        </p>
      </footer>
    </div>
  );
}
