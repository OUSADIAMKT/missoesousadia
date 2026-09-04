export const STATUSES = [
  "A Fazer",
  "Em Andamento",
  "Em Revisão",
  "Aguardando Cliente",
  "Ajustes Solicitados",
  "Aprovado",
  "Concluído",
] as const;

export type Status = (typeof STATUSES)[number];

export const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"] as const;

export type Prioridade = (typeof PRIORIDADES)[number];

export const COMPLEXIDADES = ["Simples", "Média", "Complexa"] as const;

export type Complexidade = (typeof COMPLEXIDADES)[number];

// Time e clientes iniciais agora vivem no seed de `supabase/schema.sql`
// (rodado uma vez no banco), não mais como constantes no código do app.

export type Papel = "admin" | "membro";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
}

export interface HistoricoStatus {
  id: string;
  statusAnterior: Status | null;
  statusNovo: Status;
  usuario: string;
  data: string; // ISO datetime completo
}

export interface Bloqueio {
  id: string;
  motivo: string;
  criadoPor: string;
  criadoEm: string; // ISO datetime
  resolvidoEm: string | null; // ISO datetime, null enquanto ativo
}

export interface Cliente {
  id: string;
  nome: string;
  valorMensal?: number; // R$ — base para rentabilidade (fase futura)
}

export interface Projeto {
  id: string;
  nome: string;
  clienteId: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  projetoId: string;
  descricao: string;
  dataRegistro: string; // ISO date, definida na criação
  dataInicio: string; // ISO date
  prazoEntrega: string; // ISO date
  prioridade: Prioridade;
  complexidade: Complexidade;
  horasEstimadas?: number;
  status: Status;
  quem: string;
  bloqueios: Bloqueio[];
  historico: HistoricoStatus[];
}

export type NovaTarefa = Omit<Tarefa, "id" | "dataRegistro" | "historico">;

// Tarefa com Cliente/Projeto já resolvidos — evita repetir `find()` a cada
// card renderizado. `projeto`/`cliente` ficam `undefined` só se os dados
// estiverem inconsistentes (ex.: projeto removido enquanto a tarefa existia).
export interface TarefaComContexto extends Tarefa {
  projeto: Projeto | undefined;
  cliente: Cliente | undefined;
}
