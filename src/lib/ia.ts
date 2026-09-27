"use client";

// Client-side: chama os endpoints em src/app/api/ia/*, nunca a Anthropic
// direto (a chave é server-only, ver claude-server.ts). Cada função devolve
// o texto (ou os campos) em caso de sucesso, ou lança um Error com a
// mensagem já pronta pra mostrar ao usuário — quem chama decide onde exibir.

async function postIA<T>(caminho: string, corpo: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`/api/ia/${caminho}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error("Sem conexão com o servidor. Tente de novo.");
  }
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(dados?.erro ?? "Não foi possível completar a solicitação.");
  }
  return dados as T;
}

export interface ItemBriefingIA {
  titulo: string;
  cliente: string;
  status: string;
  diasDeAtraso?: number;
  bloqueio?: string;
}

export async function gerarBriefingDiario(dados: {
  usuarioAtual: string;
  bloqueadas: ItemBriefingIA[];
  atrasadas: ItemBriefingIA[];
  minhaAcao: ItemBriefingIA[];
  proximas: ItemBriefingIA[];
}): Promise<string> {
  const r = await postIA<{ texto: string }>("briefing-diario", dados);
  return r.texto;
}

export async function gerarRascunhoEntrega(dados: {
  titulo: string;
  descricao: string;
  tags: string[];
  cliente: string;
}): Promise<string> {
  const r = await postIA<{ texto: string }>("rascunho-entrega", dados);
  return r.texto;
}

export async function sugerirCobranca(dados: {
  titulo: string;
  cliente: string;
  dias: number;
}): Promise<string> {
  const r = await postIA<{ texto: string }>("sugestao-cobranca", dados);
  return r.texto;
}

export interface HistoricoParaEstimativa {
  titulo: string;
  complexidade: string;
  prioridade: string;
  horasEstimadas?: number;
}

export interface EstimativaMissao {
  prioridade: string;
  complexidade: string;
  horasEstimadas: number;
  justificativa: string;
}

export async function estimarMissao(dados: {
  titulo: string;
  descricao: string;
  tags: string[];
  cliente: string;
  historico: HistoricoParaEstimativa[];
}): Promise<EstimativaMissao> {
  return postIA<EstimativaMissao>("estimativa-missao", dados);
}

export async function resumirMissao(dados: {
  titulo: string;
  comentarios: { autor: string; texto: string }[];
  bloqueios: { motivo: string; resolvido: boolean }[];
}): Promise<string> {
  const r = await postIA<{ texto: string }>("resumo-missao", dados);
  return r.texto;
}

export async function gerarResumoExecutivo(dados: unknown): Promise<string> {
  const r = await postIA<{ texto: string }>("resumo-semanal", dados);
  return r.texto;
}
