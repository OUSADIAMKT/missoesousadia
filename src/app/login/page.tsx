"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function entrarComGoogle() {
    setErro("");
    setCarregando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setErro(error.message);
        setCarregando(false);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar o login.");
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="w-full max-w-sm rounded-sm border border-border bg-surface p-8 text-center shadow-sm">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          Central de Operações da Agência
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-brand-dark">
          Missões da Ousadia
        </h1>
        <p className="mt-2 text-sm text-muted">
          Entre com a conta Google cadastrada pelo time.
        </p>

        <button
          onClick={entrarComGoogle}
          disabled={carregando}
          className="mt-6 w-full rounded-sm bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
        >
          {carregando ? "Abrindo o Google..." : "Entrar com Google"}
        </button>

        {erro && <p className="mt-4 text-sm text-danger">{erro}</p>}
      </div>
    </div>
  );
}
