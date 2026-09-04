"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { usuarioFromRow, type UsuarioRow } from "./supabase/mappers";
import type { Usuario } from "./types";

// Não existe mais "escolher quem eu sou": a identidade vem do login Google.
// `usuarios` agora é a lista de e-mails com acesso — gerenciar essa lista é
// uma ação de admin (adicionar/remover colega), não "trocar de personagem".
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [emailLogado, setEmailLogado] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  const buscar = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("usuarios").select("*").order("nome");
    if (error) {
      console.error("Erro ao buscar usuários:", error.message);
      return;
    }
    setUsuarios((data as UsuarioRow[]).map(usuarioFromRow));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (ativo) setEmailLogado(data.user?.email ?? null);
      await buscar();
      if (ativo) setPronto(true);
    })();

    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, session) => {
      setEmailLogado(session?.user?.email ?? null);
    });

    const canal = supabase
      .channel("usuarios-mudancas")
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios" }, buscar)
      .subscribe();

    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
      supabase.removeChannel(canal);
    };
  }, [buscar]);

  const usuarioLogado = usuarios.find(
    (u) => u.email.toLowerCase() === (emailLogado ?? "").toLowerCase()
  );
  const usuarioAtual = usuarioLogado?.nome ?? "";
  // Logou com o Google mas o e-mail não está na lista de usuários permitidos.
  const semAcesso = pronto && emailLogado !== null && !usuarioLogado;
  // Só admin gerencia quem tem acesso — o resto do sistema é aberto a todo
  // membro do time (ver RLS em supabase/schema.sql).
  const souAdmin = usuarioLogado?.papel === "admin";

  const adicionarUsuario = useCallback(
    async (nome: string, email: string) => {
      const nomeLimpo = nome.trim();
      const emailLimpo = email.trim().toLowerCase();
      if (!nomeLimpo || !emailLimpo) return false;
      const supabase = createClient();
      const { error } = await supabase
        .from("usuarios")
        .insert({ nome: nomeLimpo, email: emailLimpo });
      if (error) {
        console.error("Erro ao adicionar acesso:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  const removerUsuario = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("usuarios").delete().eq("id", id);
      if (error) {
        console.error("Erro ao remover acesso:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  const sair = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Recarga completa (não router.push) de propósito: zera todo o estado em
    // memória (hooks, canais Realtime abertos) antes do próximo login.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }, []);

  return {
    usuarios,
    usuarioAtual,
    emailLogado,
    semAcesso,
    souAdmin,
    pronto,
    adicionarUsuario,
    removerUsuario,
    sair,
  };
}
