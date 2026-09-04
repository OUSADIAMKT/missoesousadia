"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Uma instância só por aba do navegador — recriar o client a cada render
// reabre conexões e dispara o aviso "Multiple GoTrueClient instances" do
// Supabase, então guardamos em uma variável de módulo.
let instancia: SupabaseClient | undefined;

export function createClient() {
  if (instancia) return instancia;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local — veja .env.local.example."
    );
  }
  instancia = createBrowserClient(url, anonKey);
  return instancia;
}
