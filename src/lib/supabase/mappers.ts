import type {
  Anexo,
  Apontamento,
  Bloqueio,
  Cliente,
  Comentario,
  Complexidade,
  HistoricoStatus,
  Papel,
  Prioridade,
  Projeto,
  Status,
  Tarefa,
  Usuario,
  Vinculo,
} from "@/lib/types";

// Linhas cruas como vêm do Supabase (snake_case) — só os campos que lemos.
export interface ClienteRow {
  id: string;
  nome: string;
  valor_mensal: number | null;
  token_aprovacao: string;
}

export interface ProjetoRow {
  id: string;
  nome: string;
  cliente_id: string;
}

export interface HistoricoStatusRow {
  id: string;
  tarefa_id: string;
  status_anterior: string | null;
  status_novo: string;
  usuario: string;
  data: string;
}

export interface BloqueioRow {
  id: string;
  tarefa_id: string;
  motivo: string;
  criado_por: string;
  criado_em: string;
  resolvido_em: string | null;
}

export interface AnexoRow {
  id: string;
  tarefa_id: string;
  nome: string;
  caminho: string;
  tamanho: number | null;
  tipo: string | null;
  criado_por: string;
  criado_em: string;
}

export interface ComentarioRow {
  id: string;
  tarefa_id: string;
  autor: string;
  texto: string;
  criado_em: string;
}

export interface ApontamentoRow {
  id: string;
  tarefa_id: string;
  usuario: string;
  horas: number;
  data: string;
}

export interface TarefaRow {
  id: string;
  titulo: string;
  projeto_id: string;
  descricao: string;
  data_registro: string;
  data_inicio: string;
  prazo_entrega: string;
  prioridade: string;
  complexidade: string;
  horas_estimadas: number | null;
  custo_execucao: number | null;
  status: string;
  quem: string;
  tags: string[] | null;
  historico_status?: HistoricoStatusRow[] | null;
  bloqueios?: BloqueioRow[] | null;
  anexos?: AnexoRow[] | null;
  comentarios?: ComentarioRow[] | null;
  apontamentos?: ApontamentoRow[] | null;
}

export interface UsuarioRow {
  id: string;
  nome: string;
  email: string | null;
  papel: string;
  vinculo: string | null;
  custo_mensal: number | null;
  horas_mensais: number | null;
}

export function clienteFromRow(row: ClienteRow): Cliente {
  return {
    id: row.id,
    nome: row.nome,
    valorMensal: row.valor_mensal ?? undefined,
    tokenAprovacao: row.token_aprovacao,
  };
}

export function projetoFromRow(row: ProjetoRow): Projeto {
  return { id: row.id, nome: row.nome, clienteId: row.cliente_id };
}

export function usuarioFromRow(row: UsuarioRow): Usuario {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    papel: row.papel as Papel,
    vinculo: (row.vinculo as Vinculo | null) ?? null,
    custoMensal: row.custo_mensal ?? undefined,
    horasMensais: row.horas_mensais ?? undefined,
  };
}

function historicoFromRow(row: HistoricoStatusRow): HistoricoStatus {
  return {
    id: row.id,
    statusAnterior: (row.status_anterior as Status | null) ?? null,
    statusNovo: row.status_novo as Status,
    usuario: row.usuario,
    data: row.data,
  };
}

function bloqueioFromRow(row: BloqueioRow): Bloqueio {
  return {
    id: row.id,
    motivo: row.motivo,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    resolvidoEm: row.resolvido_em,
  };
}

function apontamentoFromRow(row: ApontamentoRow): Apontamento {
  return {
    id: row.id,
    usuario: row.usuario,
    horas: row.horas,
    data: row.data,
  };
}

function comentarioFromRow(row: ComentarioRow): Comentario {
  return {
    id: row.id,
    autor: row.autor,
    texto: row.texto,
    criadoEm: row.criado_em,
  };
}

function anexoFromRow(row: AnexoRow): Anexo {
  return {
    id: row.id,
    nome: row.nome,
    caminho: row.caminho,
    tamanho: row.tamanho,
    tipo: row.tipo,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
  };
}

export function tarefaFromRow(row: TarefaRow): Tarefa {
  return {
    id: row.id,
    titulo: row.titulo,
    projetoId: row.projeto_id,
    descricao: row.descricao,
    dataRegistro: row.data_registro,
    dataInicio: row.data_inicio,
    prazoEntrega: row.prazo_entrega,
    prioridade: row.prioridade as Prioridade,
    complexidade: row.complexidade as Complexidade,
    horasEstimadas: row.horas_estimadas ?? undefined,
    custoExecucao: row.custo_execucao ?? undefined,
    status: row.status as Status,
    quem: row.quem,
    tags: row.tags ?? [],
    bloqueios: (row.bloqueios ?? []).map(bloqueioFromRow),
    anexos: (row.anexos ?? []).map(anexoFromRow),
    // Ordem cronológica (mais antigo primeiro) — é uma conversa, não um log.
    comentarios: (row.comentarios ?? [])
      .map(comentarioFromRow)
      .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
    apontamentos: (row.apontamentos ?? [])
      .map(apontamentoFromRow)
      .sort((a, b) => b.data.localeCompare(a.data)),
    historico: (row.historico_status ?? [])
      .map(historicoFromRow)
      .sort((a, b) => b.data.localeCompare(a.data)),
  };
}
