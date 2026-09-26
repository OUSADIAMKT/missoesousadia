"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { tarefaFromRow, type TarefaRow } from "./supabase/mappers";
import type { NovaTarefa, Tarefa } from "./types";
import { uid } from "./utils";

const SELECT_TAREFA = "*, historico_status(*), bloqueios(*), anexos(*)";

const BUCKET_ANEXOS = "anexos";
export const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024; // 10MB — folga dentro do free tier do Supabase Storage.

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
      .on("postgres_changes", { event: "*", schema: "public", table: "anexos" }, buscar)
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
        custo_execucao: nova.custoExecucao ?? null,
        status: nova.status,
        quem: nova.quem,
        tags: nova.tags,
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
      // `custoExecucao` é sempre enviado pelo formulário (undefined quando o
      // responsável não é pago por projeto), então este `!== undefined` nunca
      // barra uma limpeza intencional — quem limpa manda `null` explícito.
      if ("custoExecucao" in dados) patch.custo_execucao = dados.custoExecucao ?? null;
      if (dados.status !== undefined) patch.status = dados.status;
      if (dados.quem !== undefined) patch.quem = dados.quem;
      if (dados.tags !== undefined) patch.tags = dados.tags;

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

  const enviarAnexo = useCallback(
    async (tarefaId: string, arquivo: File) => {
      if (arquivo.size > TAMANHO_MAXIMO_ANEXO) {
        console.error("Anexo maior que o limite de 10MB.");
        return false;
      }
      const supabase = createClient();
      const caminho = `${tarefaId}/${uid()}-${arquivo.name}`;
      const { error: erroUpload } = await supabase.storage
        .from(BUCKET_ANEXOS)
        .upload(caminho, arquivo);
      if (erroUpload) {
        console.error("Erro ao enviar anexo:", erroUpload.message);
        return false;
      }
      const { error: erroInsert } = await supabase.from("anexos").insert({
        tarefa_id: tarefaId,
        nome: arquivo.name,
        caminho,
        tamanho: arquivo.size,
        tipo: arquivo.type || null,
      });
      if (erroInsert) {
        console.error("Erro ao registrar anexo:", erroInsert.message);
        // Desfaz o upload — senão fica um arquivo órfão no Storage, sem
        // linha em `anexos` e sem jeito de removê-lo pela UI.
        await supabase.storage.from(BUCKET_ANEXOS).remove([caminho]);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  const removerAnexo = useCallback(
    async (anexoId: string, caminho: string) => {
      const supabase = createClient();
      const { error: erroStorage } = await supabase.storage
        .from(BUCKET_ANEXOS)
        .remove([caminho]);
      if (erroStorage) {
        console.error("Erro ao remover arquivo do anexo:", erroStorage.message);
        return false;
      }
      const { error } = await supabase.from("anexos").delete().eq("id", anexoId);
      if (error) {
        console.error("Erro ao remover anexo:", error.message);
        return false;
      }
      buscar();
      return true;
    },
    [buscar]
  );

  // Bucket privado: o link não é público, então cada download gera uma URL
  // assinada de curta duração em vez de expor um caminho fixo.
  const baixarAnexo = useCallback(async (caminho: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_ANEXOS)
      .createSignedUrl(caminho, 60);
    if (error || !data) {
      console.error("Erro ao gerar link do anexo:", error?.message);
      return null;
    }
    return data.signedUrl;
  }, []);

  return {
    tarefas,
    pronto,
    adicionar,
    atualizar,
    remover,
    adicionarBloqueio,
    resolverBloqueio,
    enviarAnexo,
    removerAnexo,
    baixarAnexo,
  };
}
