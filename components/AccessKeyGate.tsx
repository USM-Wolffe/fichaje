"use client";

import { useState, useEffect, type ReactNode } from "react";
import { getAccessKey, setAccessKey } from "@/lib/auth";

export default function AccessKeyGate({ children }: { children: ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAuthorized(getAccessKey() !== null);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: input }),
      });
      if (res.ok) {
        setAccessKey(input);
        setAuthorized(true);
      } else {
        setError("Clave incorrecta");
        setInput("");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (authorized === null) return null;

  if (authorized) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 text-center"
      >
        <h1 className="text-2xl font-bold text-white">Fichaje</h1>
        <p className="text-sm text-slate-400">
          Ingresa la clave de acceso para continuar
        </p>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Clave de acceso"
          autoFocus
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || input.length === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Verificando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
