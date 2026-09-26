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

// Status que marcam o trabalho ativo como encerrado — usado por isAtrasada/
// isProximaDoPrazo (utils.ts) e pelos relatórios de Performance (por cliente e
// por colaborador) para separar "o que já saiu da mesa" do resto do fluxo.
export const STATUSES_CONCLUIDOS: Status[] = ["Aprovado", "Concluído"];
export const STATUSES_PENDENTES = STATUSES.filter((s) => !STATUSES_CONCLUIDOS.includes(s));

export const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"] as const;

export type Prioridade = (typeof PRIORIDADES)[number];

export const COMPLEXIDADES = ["Simples", "Média", "Complexa"] as const;

export type Complexidade = (typeof COMPLEXIDADES)[number];

// Time e clientes iniciais agora vivem no seed de `supabase/schema.sql`
// (rodado uma vez no banco), não mais como constantes no código do app.

export type Papel = "admin" | "membro";

// COMO o custo de uma pessoa se calcula — cada vínculo é uma conta diferente,
// não um rótulo de RH. É o que permite somar gente paga de formas incompatíveis
// no mesmo relatório de rentabilidade:
//   dono/socio  → o custo é o pró-labore (pode ser zero); o que pesa de verdade
//                 é o tempo, que não tem nota fiscal
//   por_projeto → custo variável, valor combinado por entrega
//   fornecedor  → pacote fechado no período, independente do volume entregue
//   clt         → salário mensal
export const VINCULOS = ["dono", "socio", "por_projeto", "fornecedor", "clt"] as const;

export type Vinculo = (typeof VINCULOS)[number];

export const ROTULO_VINCULO: Record<Vinculo, string> = {
  dono: "Dono",
  socio: "Sócio",
  por_projeto: "Por projeto",
  fornecedor: "Fornecedor (pacote)",
  clt: "CLT",
};

// Vínculos em que `custoMensal` faz sentido — um valor fixo que corre todo mês
// independente do volume. `por_projeto` fica de fora de propósito: o custo dele
// é por entrega, não mensal.
export const VINCULOS_CUSTO_FIXO: Vinculo[] = ["dono", "socio", "fornecedor", "clt"];

export interface Usuario {
  id: string;
  nome: string;
  // `null` = executa missões mas não entra no sistema (ex.: a produtora de
  // vídeo terceirizada). Ver a explicação da RLS em supabase/schema.sql.
  email: string | null;
  papel: Papel;
  // `null` enquanto ninguém classificou — o custo dessa pessoa fica fora dos
  // relatórios em vez de virar um número inventado.
  vinculo: Vinculo | null;
  custoMensal?: number;
  horasMensais?: number;
}

export interface HistoricoStatus {
  id: string;
  statusAnterior: Status | null;
  statusNovo: Status;
  usuario: string;
  data: string; // ISO datetime completo
}

export interface Anexo {
  id: string;
  nome: string;
  // Caminho dentro do bucket "anexos" no Supabase Storage — usado para gerar
  // o link de download (signed URL) e para remover o arquivo.
  caminho: string;
  tamanho: number | null; // bytes
  tipo: string | null; // MIME type
  criadoPor: string;
  criadoEm: string; // ISO datetime
}

export interface Comentario {
  id: string;
  autor: string;
  texto: string;
  criadoEm: string; // ISO datetime
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
  // R$ combinados com quem executa — só para responsável `por_projeto`. Quem
  // tem custo fixo mensal é rateado pelas entregas do mês (ver
  // `lucroPorClienteNoMes` em performance-metrics.ts), não lançado aqui.
  custoExecucao?: number;
  status: Status;
  quem: string;
  // Etiquetas livres definidas pelo time (ex.: "post", "vídeo", "anúncio") —
  // sem lista fixa, digitadas na hora. Sempre um array, nunca undefined —
  // simplifica UI e filtro (ver `tags` em supabase/schema.sql).
  tags: string[];
  bloqueios: Bloqueio[];
  anexos: Anexo[];
  comentarios: Comentario[];
  historico: HistoricoStatus[];
}

// `anexos`, assim como `historico`, é gerenciado à parte (upload separado
// depois de a missão existir) — uma missão nova nunca nasce com anexos.
// `comentarios`, assim como `anexos`/`historico`, é gerenciado à parte — uma
// missão nova nunca nasce com comentários.
export type NovaTarefa = Omit<
  Tarefa,
  "id" | "dataRegistro" | "historico" | "anexos" | "comentarios"
>;

// Tarefa com Cliente/Projeto já resolvidos — evita repetir `find()` a cada
// card renderizado. `projeto`/`cliente` ficam `undefined` só se os dados
// estiverem inconsistentes (ex.: projeto removido enquanto a tarefa existia).
export interface TarefaComContexto extends Tarefa {
  projeto: Projeto | undefined;
  cliente: Cliente | undefined;
}
