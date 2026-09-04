import type {
  Bloqueio,
  Cliente,
  Complexidade,
  HistoricoStatus,
  Papel,
  Prioridade,
  Projeto,
  Status,
  Tarefa,
  Usuario,
} from "@/lib/types";

// Linhas cruas como vêm do Supabase (snake_case) — só os campos que lemos.
export interface ClienteRow {
  id: string;
  nome: string;
  valor_mensal: number | null;
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
  status: string;
  quem: string;
  historico_status?: HistoricoStatusRow[] | null;
  bloqueios?: BloqueioRow[] | null;
}

export interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  papel: string;
}

export function clienteFromRow(row: ClienteRow): Cliente {
  return { id: row.id, nome: row.nome, valorMensal: row.valor_mensal ?? undefined };
}

export function projetoFromRow(row: ProjetoRow): Projeto {
  return { id: row.id, nome: row.nome, clienteId: row.cliente_id };
}

export function usuarioFromRow(row: UsuarioRow): Usuario {
  return { id: row.id, nome: row.nome, email: row.email, papel: row.papel as Papel };
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
    status: row.status as Status,
    quem: row.quem,
    bloqueios: (row.bloqueios ?? []).map(bloqueioFromRow),
    historico: (row.historico_status ?? [])
      .map(historicoFromRow)
      .sort((a, b) => b.data.localeCompare(a.data)),
  };
}
