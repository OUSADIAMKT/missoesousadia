import { STATUSES_CONCLUIDOS, type Prioridade, type Status, type TarefaComContexto } from "./types.ts";

export function formatDateBR(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(isoDateTime: string): string {
  if (!isoDateTime) return "—";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isAtrasada(prazoEntrega: string, status: Status): boolean {
  if (STATUSES_CONCLUIDOS.includes(status)) return false;
  const hoje = new Date().toISOString().slice(0, 10);
  return prazoEntrega < hoje;
}

export function isProximaDoPrazo(prazoEntrega: string, status: Status): boolean {
  if (STATUSES_CONCLUIDOS.includes(status)) return false;
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(hoje.getDate() + 2);
  const prazo = new Date(prazoEntrega);
  return prazo >= hoje && prazo <= limite;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

// Paleta terrosa alinhada à identidade Ousadia (laranja/dourado/verde Amazônia),
// evitando tons "candy" (rosa/violeta/ciano) que destoam do editorial preto+creme.
const PALETA_AVATAR = [
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-stone-200 text-stone-800 border-stone-300",
  "bg-yellow-100 text-yellow-800 border-yellow-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-red-100 text-red-800 border-red-200",
  "bg-lime-100 text-lime-800 border-lime-200",
];

function hashString(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31 + texto.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function corResponsavel(nome: string): string {
  return PALETA_AVATAR[hashString(nome) % PALETA_AVATAR.length];
}

// Cada status usa um tom da própria identidade Ousadia: neutro (a fazer),
// laranja de marca (em andamento — ação), dourado (em revisão — atenção),
// preto editorial (aguardando cliente — pausa), vermelho (ajustes — retrabalho),
// verde Amazônia em dois tons (aprovado vs. concluído, para distinguir as duas etapas finais).
const CORES_STATUS: Record<Status, string> = {
  "A Fazer": "bg-surface-alt text-muted border-border",
  "Em Andamento": "bg-brand/10 text-brand border-brand/30",
  "Em Revisão": "bg-accent-soft text-accent border-accent/30",
  "Aguardando Cliente": "bg-brand-dark/5 text-brand-dark border-brand-dark/20",
  "Ajustes Solicitados": "bg-danger/10 text-danger border-danger/30",
  "Aprovado": "bg-accent-green-soft/60 text-accent-green border-accent-green/20",
  "Concluído": "bg-accent-green-soft text-accent-green border-accent-green/30",
};

export function corStatus(status: Status): string {
  return CORES_STATUS[status];
}

// Preenchimento sólido para barra de progresso (ex.: Performance) — CORES_STATUS é
// pensado para badge com fundo suave, e extrair só o bg de lá deixaria a barra de
// "Aguardando Cliente" quase invisível (bg-brand-dark/5). Reaproveita os tokens de
// marca onde dá; usa indigo para "Aguardando Cliente", mesma lógica do chip
// "Com o Cliente" do Kanban — precisa de uma cor própria pra não sumir ao lado do preto.
const CORES_BARRA_STATUS: Record<Status, string> = {
  "A Fazer": "bg-neutral-300",
  "Em Andamento": "bg-brand",
  "Em Revisão": "bg-accent",
  "Aguardando Cliente": "bg-indigo-400",
  "Ajustes Solicitados": "bg-danger",
  "Aprovado": "bg-emerald-400",
  "Concluído": "bg-accent-green",
};

export function corBarraStatus(status: Status): string {
  return CORES_BARRA_STATUS[status];
}

// Mesmas decisões de cor de CORES_BARRA_STATUS, só que como utility `fill-*` do
// Tailwind (em vez de `bg-*`) — para colorir barras de gráficos recharts via
// `className` no `<Cell>`, já que SVG usa a propriedade `fill`, não `background`.
const FILL_BARRA_STATUS: Record<Status, string> = {
  "A Fazer": "fill-neutral-300",
  "Em Andamento": "fill-brand",
  "Em Revisão": "fill-accent",
  "Aguardando Cliente": "fill-indigo-400",
  "Ajustes Solicitados": "fill-danger",
  "Aprovado": "fill-emerald-400",
  "Concluído": "fill-accent-green",
};

export function corBarraStatusFill(status: Status): string {
  return FILL_BARRA_STATUS[status];
}

// Paleta para os gráficos do painel escuro da Performance. Os tokens de marca
// não servem aqui: --accent-green (#1a3c2e) e --danger (#b3261e) somem sobre
// grafite, e --brand-dark (#0d0d0d) fica invisível. São valores hex (não classes)
// porque recharts pinta SVG via prop `fill`. Só o painel escuro usa isto —
// corStatus/corBarraStatus seguem servindo Kanban, Hoje e Projetos, que são claros.
const CORES_GRAFICO_ESCURO: Record<Status, string> = {
  "A Fazer": "#94A3B8",
  "Em Andamento": "#F97316",
  "Em Revisão": "#FBBF24",
  "Aguardando Cliente": "#818CF8",
  "Ajustes Solicitados": "#F43F5E",
  "Aprovado": "#34D399",
  "Concluído": "#10B981",
};

export function corGraficoEscuro(status: Status): string {
  return CORES_GRAFICO_ESCURO[status];
}

// Sequência para gráficos sem semântica de status (ex.: treemap de clientes),
// na mesma família de tons do painel escuro.
const SEQUENCIA_GRAFICO_ESCURO = [
  "#F97316",
  "#38BDF8",
  "#A78BFA",
  "#FBBF24",
  "#34D399",
  "#FB7185",
  "#60A5FA",
  "#F472B6",
];

export function corSequencialEscura(indice: number): string {
  return SEQUENCIA_GRAFICO_ESCURO[indice % SEQUENCIA_GRAFICO_ESCURO.length];
}

// Prioridade sobe em intensidade: neutro → dourado → laranja de marca → vermelho.
const CORES_PRIORIDADE: Record<Prioridade, string> = {
  Baixa: "bg-surface-alt text-muted border-border",
  Normal: "bg-accent-soft text-accent border-accent/30",
  Alta: "bg-brand/10 text-brand border-brand/30",
  Urgente: "bg-danger/10 text-danger border-danger/30",
};

export function corPrioridade(prioridade: Prioridade): string {
  return CORES_PRIORIDADE[prioridade];
}

// Badge de prazo no card: mesmo padrão de corStatus/corPrioridade, reaproveitando
// os tokens de marca (danger/accent) em vez de introduzir cores novas.
export function corPrazo(atrasada: boolean, proxima: boolean): string {
  if (atrasada) return "bg-danger/10 text-danger border-danger/30";
  if (proxima) return "bg-accent-soft text-accent border-accent/30";
  return "border-border text-muted";
}

// Micro-chip de fase dentro da coluna consolidada "Validação & Gargalos" do Kanban —
// distingue as 3 travas por cor própria (âmbar/azul/vermelho), à parte da paleta de
// marca usada em corStatus, porque aqui o objetivo é diferenciar 3 estados lado a lado
// de forma rápida, não representar a identidade visual do app.
const FASES_VALIDACAO: Partial<Record<Status, { rotulo: string; classe: string }>> = {
  "Em Revisão": { rotulo: "Revisão Interna", classe: "bg-amber-50 text-amber-700 border-amber-200" },
  "Aguardando Cliente": { rotulo: "Com o Cliente", classe: "bg-blue-50 text-blue-700 border-blue-200" },
  "Ajustes Solicitados": {
    rotulo: "Ajuste Solicitado",
    classe: "bg-red-50 text-red-700 border-red-200",
  },
};

export function faseValidacao(status: Status): { rotulo: string; classe: string } | null {
  return FASES_VALIDACAO[status] ?? null;
}

// `historico` vem ordenado do mais recente para o mais antigo (ver
// tarefaFromRow em mappers.ts), então o item [0] é a última mudança de status —
// usado pelos relatórios de Performance (por cliente e por colaborador) para
// mostrar quando uma entrega foi concluída/aprovada.
export function dataDeConclusao(tarefa: TarefaComContexto): string | null {
  return tarefa.historico[0]?.data.slice(0, 10) ?? null;
}

export function formatBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Ids determinísticos (não aleatórios) para o seed de clientes/projetos/tarefas
// iniciais, para que `seed.ts` (tarefas) e `useEstrutura.ts` (clientes/projetos)
// concordem sobre o mesmo projeto sem precisar compartilhar um uid gerado em runtime.
export function idClienteSeed(nomeCliente: string): string {
  return `cliente-${slugify(nomeCliente)}`;
}

export function idProjetoPadraoSeed(nomeCliente: string): string {
  return `projeto-${slugify(nomeCliente)}-geral`;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
