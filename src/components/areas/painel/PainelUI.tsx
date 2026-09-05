"use client";

import type { ReactNode } from "react";
import type { TooltipContentProps } from "recharts";

// Blocos compartilhados do painel escuro da Performance. Só esta área do app é
// escura — Hoje, Missões e Projetos seguem claros —, então a casca escura mora
// aqui em vez de ser repetida em cada card.

export function CardPainel({
  titulo,
  legenda,
  children,
  className = "",
}: {
  titulo?: string;
  legenda?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/20 ${className}`}
    >
      {(titulo || legenda) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {titulo && (
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-300">
              {titulo}
            </h3>
          )}
          {legenda && <span className="text-[11px] font-medium text-slate-500">{legenda}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

// Anel de progresso em SVG puro — usado nos KPIs para dar leitura visual do
// percentual sem precisar de um gráfico inteiro do recharts.
export function AnelProgresso({
  percentual,
  cor,
  tamanho = 56,
}: {
  percentual: number;
  cor: string;
  tamanho?: number;
}) {
  const raio = (tamanho - 8) / 2;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = Math.max(0, Math.min(100, percentual));
  return (
    <svg width={tamanho} height={tamanho} className="shrink-0 -rotate-90">
      <circle
        cx={tamanho / 2}
        cy={tamanho / 2}
        r={raio}
        fill="none"
        stroke="#1e293b"
        strokeWidth={6}
      />
      <circle
        cx={tamanho / 2}
        cy={tamanho / 2}
        r={raio}
        fill="none"
        stroke={cor}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circunferencia}
        strokeDashoffset={circunferencia - (preenchido / 100) * circunferencia}
      />
    </svg>
  );
}

export function KpiTile({
  rotulo,
  valor,
  detalhe,
  cor = "#e2e8f0",
  anelPercentual,
  alerta = false,
  ressalva,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  cor?: string;
  anelPercentual?: number;
  alerta?: boolean;
  ressalva?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border p-4 shadow-lg shadow-black/20 ${
        alerta ? "border-rose-500/40 bg-rose-500/5" : "border-slate-800 bg-slate-900"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {rotulo}
            </span>
            {ressalva && (
              <span
                title={ressalva}
                className="cursor-help text-[11px] text-amber-400"
                aria-label={ressalva}
              >
                ⚠
              </span>
            )}
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: cor }}>
            {valor}
          </div>
          {detalhe && <div className="mt-0.5 text-[11px] text-slate-500">{detalhe}</div>}
        </div>
        {anelPercentual !== undefined && <AnelProgresso percentual={anelPercentual} cor={cor} />}
      </div>
    </div>
  );
}

export function TooltipEscuro({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs text-white shadow-xl">
      {label !== undefined && <p className="mb-0.5 font-semibold">{String(label)}</p>}
      {payload.map((p, i) => (
        <p key={`${String(p.dataKey)}-${i}`} className="flex items-center gap-1.5 text-slate-300">
          {p.color && (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
          )}
          {p.name ? `${String(p.name)}: ` : ""}
          <span className="font-semibold text-white">{String(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// Seta + texto (nunca só cor) comparando a pessoa com a média do time.
export function IndicadorComparativo({
  valor,
  media,
  maiorEhMelhor,
}: {
  valor: number;
  media: number;
  maiorEhMelhor: boolean;
}) {
  const diferenca = valor - media;
  const tolerancia = Math.max(0.5, Math.abs(media) * 0.05);
  if (Math.abs(diferenca) <= tolerancia) {
    return <span className="text-[11px] font-medium text-slate-500">≈ na média do time</span>;
  }
  const estaAcima = diferenca > 0;
  const eBom = estaAcima === maiorEhMelhor;
  return (
    <span className={`text-[11px] font-semibold ${eBom ? "text-emerald-400" : "text-rose-400"}`}>
      {estaAcima ? "▲" : "▼"} {estaAcima ? "acima" : "abaixo"} da média
    </span>
  );
}

export function LegendaStatus({
  itens,
}: {
  itens: { rotulo: string; cor: string; valor: number; pct: number }[];
}) {
  return (
    <ul className="min-w-0 space-y-1.5">
      {itens.map((item) => (
        <li key={item.rotulo} className="flex items-center gap-2 text-xs">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: item.cor }}
          />
          <span className="min-w-0 flex-1 truncate text-slate-300">{item.rotulo}</span>
          <span className="shrink-0 font-semibold tabular-nums text-white">{item.valor}</span>
          <span className="w-9 shrink-0 text-right tabular-nums text-slate-500">{item.pct}%</span>
        </li>
      ))}
    </ul>
  );
}
