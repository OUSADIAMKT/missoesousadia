import type { Prioridade, Status } from "./types";

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

const STATUSES_SEM_URGENCIA: Status[] = ["Concluído", "Aprovado"];

export function isAtrasada(prazoEntrega: string, status: Status): boolean {
  if (STATUSES_SEM_URGENCIA.includes(status)) return false;
  const hoje = new Date().toISOString().slice(0, 10);
  return prazoEntrega < hoje;
}

export function isProximaDoPrazo(prazoEntrega: string, status: Status): boolean {
  if (STATUSES_SEM_URGENCIA.includes(status)) return false;
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
