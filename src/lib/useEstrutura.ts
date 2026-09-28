"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { clienteFromRow, projetoFromRow, type ClienteRow, type ProjetoRow } from "./supabase/mappers";
import type { Cliente, Projeto } from "./types";
import { uid } from "./utils";

const PROJETO_PADRAO = "Geral";

export function useEstrutura() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [pronto, setPronto] = useState(false);

  const buscar = useCallback(async () => {
    const supabase = createClient();
    const [clientesRes, projetosRes] = await Promise.all([
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("projetos").select("*").order("nome"),
    ]);
    if (clientesRes.error) {
      console.error("Erro ao buscar clientes:", clientesRes.error.message);
    } else {
      setClientes((clientesRes.data as ClienteRow[]).map(clienteFromRow));
    }
    if (projetosRes.error) {
      console.error("Erro ao buscar projetos:", projetosRes.error.message);
    } else {
      setProjetos((projetosRes.data as ProjetoRow[]).map(projetoFromRow));
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;

    (async () => {
      await buscar();
      if (ativo) setPronto(true);
    })();

    const canal = supabase
      .channel("estrutura-mudancas")
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, buscar)
      .on("postgres_changes", { event: "*", schema: "public", table: "projetos" }, buscar)
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [buscar]);

  const adicionarCliente = useCallback(
    async (nome: string, valorMensal?: number) => {
      const limpo = nome.trim();
      if (!limpo) return "";
      const supabase = createClient();

      const { data: existente } = await supabase
        .from("clientes")
        .select("id")
        .ilike("nome", limpo)
        .maybeSingle();
      if (existente) return existente.id as string;

      const { data: criado, error } = await supabase
        .from("clientes")
        .insert({ nome: limpo, valor_mensal: valorMensal ?? null })
        .select("id")
        .single();
      if (error || !criado) {
        console.error("Erro ao criar cliente:", error?.message);
        return "";
      }
      buscar();
      return criado.id as string;
    },
    [buscar]
  );

  const atualizarCliente = useCallback(
    async (id: string, dados: Partial<Omit<Cliente, "id">>) => {
      const supabase = createClient();
      const patch: Record<string, unknown> = {};
      if (dados.nome !== undefined) patch.nome = dados.nome;
      if (dados.valorMensal !== undefined) patch.valor_mensal = dados.valorMensal ?? null;
      const { error } = await supabase.from("clientes").update(patch).eq("id", id);
      if (error) {
        console.error("Erro ao atualizar cliente:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  const removerCliente = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) {
        console.error("Erro ao remover cliente:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  // Invalida o link público de aprovação atual e gera um novo — quem tiver
  // o link antigo salvo (ex.: numa conversa de WhatsApp antiga) perde acesso.
  const regenerarLinkAprovacao = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("clientes")
        .update({ token_aprovacao: uid() })
        .eq("id", id);
      if (error) {
        console.error("Erro ao gerar novo link de aprovação:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  const adicionarProjeto = useCallback(
    async (clienteId: string, nome: string) => {
      const limpo = nome.trim();
      if (!limpo || !clienteId) return "";
      const supabase = createClient();

      const { data: existente } = await supabase
        .from("projetos")
        .select("id")
        .eq("cliente_id", clienteId)
        .ilike("nome", limpo)
        .maybeSingle();
      if (existente) return existente.id as string;

      const { data: criado, error } = await supabase
        .from("projetos")
        .insert({ nome: limpo, cliente_id: clienteId })
        .select("id")
        .single();
      if (error || !criado) {
        console.error("Erro ao criar projeto:", error?.message);
        return "";
      }
      buscar();
      return criado.id as string;
    },
    [buscar]
  );

  const atualizarProjeto = useCallback(
    async (id: string, dados: Partial<Omit<Projeto, "id">>) => {
      const supabase = createClient();
      const patch: Record<string, unknown> = {};
      if (dados.nome !== undefined) patch.nome = dados.nome;
      if (dados.clienteId !== undefined) patch.cliente_id = dados.clienteId;
      const { error } = await supabase.from("projetos").update(patch).eq("id", id);
      if (error) {
        console.error("Erro ao atualizar projeto:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  const removerProjeto = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("projetos").delete().eq("id", id);
      if (error) {
        console.error("Erro ao remover projeto:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  // Garante que cliente + projeto existam a partir dos nomes (cria se faltar) e
  // devolve o projetoId — usado no fluxo rápido do formulário de missão.
  const encontrarOuCriarProjeto = useCallback(
    async (nomeCliente: string, nomeProjeto: string = PROJETO_PADRAO) => {
      const clienteLimpo = nomeCliente.trim() || "Sem cliente";
      const projetoLimpo = nomeProjeto.trim() || PROJETO_PADRAO;
      const supabase = createClient();

      let cliente = (
        await supabase.from("clientes").select("id").ilike("nome", clienteLimpo).maybeSingle()
      ).data;

      if (!cliente) {
        const { data: novoCliente, error } = await supabase
          .from("clientes")
          .insert({ nome: clienteLimpo })
          .select("id")
          .single();
        if (error || !novoCliente) {
          console.error("Erro ao criar cliente:", error?.message);
          return "";
        }
        cliente = novoCliente;
      }

      const { data: projetoExistente } = await supabase
        .from("projetos")
        .select("id")
        .eq("cliente_id", cliente.id)
        .ilike("nome", projetoLimpo)
        .maybeSingle();
      if (projetoExistente) {
        buscar();
        return projetoExistente.id as string;
      }

      const { data: novoProjeto, error: erroProjeto } = await supabase
        .from("projetos")
        .insert({ nome: projetoLimpo, cliente_id: cliente.id })
        .select("id")
        .single();
      if (erroProjeto || !novoProjeto) {
        console.error("Erro ao criar projeto:", erroProjeto?.message);
        return "";
      }
      buscar();
      return novoProjeto.id as string;
    },
    [buscar]
  );

  return {
    clientes,
    projetos,
    pronto,
    adicionarCliente,
    atualizarCliente,
    removerCliente,
    regenerarLinkAprovacao,
    adicionarProjeto,
    atualizarProjeto,
    removerProjeto,
    encontrarOuCriarProjeto,
  };
}
