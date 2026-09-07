"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { usuarioFromRow, type UsuarioRow } from "./supabase/mappers";
import type { Usuario, Vinculo } from "./types";

// Não existe mais "escolher quem eu sou": a identidade vem do login Google.
// `usuarios` é a lista de QUEM EXECUTA missões; quem tem e-mail nessa lista
// também tem acesso ao sistema. Gerenciá-la é uma ação de admin (adicionar
// colega, cadastrar fornecedor, definir custo), não "trocar de personagem".
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

  // Os dois lados precisam existir de verdade: um executor sem e-mail (ex.: a
  // produtora terceirizada) não pode casar com ninguém logado, e um `?? ""` dos
  // dois lados faria exatamente isso.
  const usuarioLogado = usuarios.find(
    (u) => !!u.email && !!emailLogado && u.email.toLowerCase() === emailLogado.toLowerCase()
  );
  const usuarioAtual = usuarioLogado?.nome ?? "";
  // Logou com o Google mas o e-mail não está na lista de usuários permitidos.
  const semAcesso = pronto && emailLogado !== null && !usuarioLogado;
  // Só admin gerencia quem tem acesso — o resto do sistema é aberto a todo
  // membro do time (ver RLS em supabase/schema.sql).
  const souAdmin = usuarioLogado?.papel === "admin";

  // `email` vazio é permitido de propósito: cadastra quem executa missões sem
  // ganhar login (a produtora de vídeo terceirizada). A linha entra no dropdown
  // de "quem" e nos relatórios de custo, mas nunca casa com um login Google.
  const adicionarUsuario = useCallback(
    async (nome: string, email: string, vinculo: Vinculo | null) => {
      const nomeLimpo = nome.trim();
      const emailLimpo = email.trim().toLowerCase();
      if (!nomeLimpo) return false;
      const supabase = createClient();
      const { error } = await supabase
        .from("usuarios")
        .insert({ nome: nomeLimpo, email: emailLimpo || null, vinculo });
      if (error) {
        console.error("Erro ao adicionar pessoa:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  // Vínculo e custo só existem para alimentar os relatórios financeiros — a RLS
  // de `usuarios` já restringe qualquer UPDATE a admin (ver schema.sql).
  const atualizarUsuario = useCallback(
    async (
      id: string,
      campos: { vinculo: Vinculo | null; custoMensal?: number; horasMensais?: number }
    ) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("usuarios")
        .update({
          vinculo: campos.vinculo,
          custo_mensal: campos.custoMensal ?? null,
          horas_mensais: campos.horasMensais ?? null,
        })
        .eq("id", id);
      if (error) {
        console.error("Erro ao atualizar vínculo/custo:", error.message);
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
    atualizarUsuario,
    removerUsuario,
    sair,
  };
}
