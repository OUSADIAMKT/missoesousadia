"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { tarefaFromRow, type TarefaRow } from "./supabase/mappers";
import type { NovaTarefa, Tarefa } from "./types";

const SELECT_TAREFA = "*, historico_status(*), bloqueios(*)";

// "Quem fez o quê" (histórico de status, `criado_por` dos bloqueios) não é
// mais passado pelo componente: o banco resolve isso sozinho a partir de
// quem está logado (ver supabase/schema.sql) — mais simples e não dá pra
// falsificar. Por isso as mutações abaixo não recebem mais um `usuario`.
export function useTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [pronto, setPronto] = useState(false);

  const buscar = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tarefas")
      .select(SELECT_TAREFA)
      .order("criado_em", { ascending: false });
    if (error) {
      console.error("Erro ao buscar tarefas:", error.message);
      return;
    }
    setTarefas((data as TarefaRow[]).map(tarefaFromRow));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;

    (async () => {
      await buscar();
      if (ativo) setPronto(true);
    })();

    const canal = supabase
      .channel("tarefas-mudancas")
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, buscar)
      .on("postgres_changes", { event: "*", schema: "public", table: "historico_status" }, buscar)
      .on("postgres_changes", { event: "*", schema: "public", table: "bloqueios" }, buscar)
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [buscar]);

  const adicionar = useCallback(
    async (nova: NovaTarefa) => {
      const supabase = createClient();
      const { error } = await supabase.from("tarefas").insert({
        titulo: nova.titulo,
        projeto_id: nova.projetoId,
        descricao: nova.descricao,
        data_inicio: nova.dataInicio,
        prazo_entrega: nova.prazoEntrega,
        prioridade: nova.prioridade,
        complexidade: nova.complexidade,
        horas_estimadas: nova.horasEstimadas ?? null,
        status: nova.status,
        quem: nova.quem,
      });
      if (error) {
        console.error("Erro ao criar missão:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  const atualizar = useCallback(
    async (id: string, dados: Partial<Omit<Tarefa, "id" | "historico" | "bloqueios">>) => {
      const supabase = createClient();
      const patch: Record<string, unknown> = {};
      if (dados.titulo !== undefined) patch.titulo = dados.titulo;
      if (dados.projetoId !== undefined) patch.projeto_id = dados.projetoId;
      if (dados.descricao !== undefined) patch.descricao = dados.descricao;
      if (dados.dataInicio !== undefined) patch.data_inicio = dados.dataInicio;
      if (dados.prazoEntrega !== undefined) patch.prazo_entrega = dados.prazoEntrega;
      if (dados.prioridade !== undefined) patch.prioridade = dados.prioridade;
      if (dados.complexidade !== undefined) patch.complexidade = dados.complexidade;
      if (dados.horasEstimadas !== undefined)
        patch.horas_estimadas = dados.horasEstimadas ?? null;
      if (dados.status !== undefined) patch.status = dados.status;
      if (dados.quem !== undefined) patch.quem = dados.quem;

      const { error } = await supabase.from("tarefas").update(patch).eq("id", id);
      if (error) {
        console.error("Erro ao atualizar missão:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  const remover = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) {
        console.error("Erro ao excluir missão:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  const adicionarBloqueio = useCallback(
    async (tarefaId: string, motivo: string) => {
      const limpo = motivo.trim();
      if (!limpo) return false;
      const supabase = createClient();
      const { error } = await supabase
        .from("bloqueios")
        .insert({ tarefa_id: tarefaId, motivo: limpo });
      if (error) {
        console.error("Erro ao adicionar bloqueio:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  const resolverBloqueio = useCallback(
    async (tarefaId: string, bloqueioId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("bloqueios")
        .update({ resolvido_em: new Date().toISOString() })
        .eq("id", bloqueioId)
        .eq("tarefa_id", tarefaId);
      if (error) {
        console.error("Erro ao resolver bloqueio:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  return {
    tarefas,
    pronto,
    adicionar,
    atualizar,
    remover,
    adicionarBloqueio,
    resolverBloqueio,
  };
}
