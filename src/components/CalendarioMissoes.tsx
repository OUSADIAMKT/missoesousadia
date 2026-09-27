"use client";

import { useMemo, useState } from "react";
import type { TarefaComContexto } from "@/lib/types";
import {
  corPrazo,
  corResponsavel,
  corStatus,
  formatDateBR,
  iniciais,
  isAtrasada,
  isProximaDoPrazo,
} from "@/lib/utils";
import { formatMes } from "@/lib/performance-metrics";

interface CalendarioMissoesProps {
  tarefas: TarefaComContexto[];
  onSelecionar: (tarefa: TarefaComContexto) => void;
}

interface CelulaDia {
  iso: string;
  dia: number;
  doMesAtual: boolean;
  ehHoje: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoUTC(ano: number, mesIndex0: number, dia: number): string {
  // mesIndex0: 0-11. Datas do domínio são "YYYY-MM-DD" puras (sem hora), então
  // a grade é montada toda em UTC — mesma convenção de formatMes/mesesComEntrega
  // em performance-metrics.ts — para não deslocar o dia por fuso local.
  const d = new Date(Date.UTC(ano, mesIndex0, dia));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function diasNoMes(ano: number, mesIndex0: number): number {
  return new Date(Date.UTC(ano, mesIndex0 + 1, 0)).getUTCDate();
}

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function CalendarioMissoes({ tarefas, onSelecionar }: CalendarioMissoesProps) {
  const hojeIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mesIndex0, setMesIndex0] = useState(agora.getMonth());
  // Em telas estreitas, 7 colunas não cabem título nenhum — o card vira só
  // um círculo com iniciais. Em vez disso, mobile mostra bolinhas por status
  // e o dia inteiro é clicável, abrindo a lista completa aqui embaixo.
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const mesAnterior = () => {
    setDiaSelecionado(null);
    if (mesIndex0 === 0) {
      setAno((a) => a - 1);
      setMesIndex0(11);
    } else {
      setMesIndex0((m) => m - 1);
    }
  };
  const mesSeguinte = () => {
    setDiaSelecionado(null);
    if (mesIndex0 === 11) {
      setAno((a) => a + 1);
      setMesIndex0(0);
    } else {
      setMesIndex0((m) => m + 1);
    }
  };
  const irParaHoje = () => {
    setDiaSelecionado(null);
    setAno(agora.getFullYear());
    setMesIndex0(agora.getMonth());
  };

  const celulas = useMemo<CelulaDia[]>(() => {
    const totalDias = diasNoMes(ano, mesIndex0);
    const primeiroDiaSemana = new Date(Date.UTC(ano, mesIndex0, 1)).getUTCDay();
    const totalCelulas = Math.ceil((primeiroDiaSemana + totalDias) / 7) * 7;
    const lista: CelulaDia[] = [];
    for (let i = 0; i < totalCelulas; i++) {
      const numeroDia = i - primeiroDiaSemana + 1;
      let iso: string;
      let doMesAtual: boolean;
      if (numeroDia < 1) {
        const diasMesAnterior = diasNoMes(ano, mesIndex0 - 1 < 0 ? 11 : mesIndex0 - 1);
        const anoRef = mesIndex0 === 0 ? ano - 1 : ano;
        const mesRef = mesIndex0 === 0 ? 11 : mesIndex0 - 1;
        iso = isoUTC(anoRef, mesRef, diasMesAnterior + numeroDia);
        doMesAtual = false;
      } else if (numeroDia > totalDias) {
        const anoRef = mesIndex0 === 11 ? ano + 1 : ano;
        const mesRef = mesIndex0 === 11 ? 0 : mesIndex0 + 1;
        iso = isoUTC(anoRef, mesRef, numeroDia - totalDias);
        doMesAtual = false;
      } else {
        iso = isoUTC(ano, mesIndex0, numeroDia);
        doMesAtual = true;
      }
      lista.push({
        iso,
        dia: Number(iso.slice(8, 10)),
        doMesAtual,
        ehHoje: iso === hojeIso,
      });
    }
    return lista;
  }, [ano, mesIndex0, hojeIso]);

  const tarefasPorDia = useMemo(() => {
    const mapa = new Map<string, TarefaComContexto[]>();
    for (const t of tarefas) {
      if (!t.prazoEntrega) continue;
      const lista = mapa.get(t.prazoEntrega) ?? [];
      lista.push(t);
      mapa.set(t.prazoEntrega, lista);
    }
    return mapa;
  }, [tarefas]);

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-brand-dark">
          {formatMes(`${ano}-${pad2(mesIndex0 + 1)}`)}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={mesAnterior}
            aria-label="Mês anterior"
            className="grid h-7 w-7 place-items-center rounded-sm border border-border text-muted hover:bg-background"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={irParaHoje}
            className="rounded-sm border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={mesSeguinte}
            aria-label="Próximo mês"
            className="grid h-7 w-7 place-items-center rounded-sm border border-border text-muted hover:bg-background"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="px-1 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-400"
          >
            {d}
          </div>
        ))}

        {celulas.map((celula) => {
          const doDia = tarefasPorDia.get(celula.iso) ?? [];
          const visiveis = doDia.slice(0, 3);
          const restantes = doDia.length - visiveis.length;
          const temTarefas = doDia.length > 0;
          const selecionada = diaSelecionado === celula.iso;
          return (
            <div
              key={celula.iso}
              role={temTarefas ? "button" : undefined}
              tabIndex={temTarefas ? 0 : undefined}
              onClick={() => {
                if (!temTarefas) return;
                setDiaSelecionado((atual) => (atual === celula.iso ? null : celula.iso));
              }}
              onKeyDown={(e) => {
                if (!temTarefas) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDiaSelecionado((atual) => (atual === celula.iso ? null : celula.iso));
                }
              }}
              className={`min-h-[84px] rounded-lg border p-1 text-left ${
                temTarefas ? "cursor-pointer sm:cursor-default" : ""
              } ${
                celula.doMesAtual ? "border-neutral-200/80 bg-white" : "border-transparent bg-slate-50/60"
              } ${celula.ehHoje ? "ring-2 ring-brand/50" : ""} ${
                selecionada ? "border-brand sm:border-neutral-200/80" : ""
              }`}
            >
              <span
                className={`text-[11px] font-semibold ${
                  celula.doMesAtual ? "text-foreground" : "text-neutral-300"
                } ${celula.ehHoje ? "text-brand" : ""}`}
              >
                {celula.dia}
              </span>

              {/* Mobile: só bolinhas por status — o título não cabe em 7 colunas
                  numa tela de celular. Tocar no dia abre a lista completa abaixo
                  da grade, em vez de tentar caber o texto na célula. */}
              {temTarefas && (
                <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                  {doDia.slice(0, 6).map((t) => (
                    <span
                      key={t.id}
                      className={`h-2 w-2 rounded-full border ${corStatus(t.status)}`}
                    />
                  ))}
                </div>
              )}

              {/* sm+: chip completo com título, como antes — cabe numa coluna
                  de desktop/tablet. */}
              <div className="mt-1 hidden flex-col gap-0.5 sm:flex">
                {visiveis.map((t) => {
                  const atrasada = isAtrasada(t.prazoEntrega, t.status);
                  const proxima = isProximaDoPrazo(t.prazoEntrega, t.status);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelecionar(t);
                      }}
                      title={t.titulo}
                      className={`flex items-center gap-1 truncate rounded border px-1 py-0.5 text-left text-[10px] font-medium ${corPrazo(
                        atrasada,
                        proxima
                      )}`}
                    >
                      <span
                        className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border text-[7px] font-bold ${corResponsavel(
                          t.quem
                        )}`}
                      >
                        {iniciais(t.quem)}
                      </span>
                      <span className="truncate">{t.titulo}</span>
                    </button>
                  );
                })}
                {restantes > 0 && (
                  <span className="px-1 text-[10px] text-muted">+{restantes} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista do dia selecionado — só existe no mobile (sm:hidden), onde o
          chip com título não cabe dentro da célula. */}
      {diaSelecionado && (
        <div className="mt-3 rounded-lg border border-border bg-background p-2 sm:hidden">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {formatDateBR(diaSelecionado)}
            </span>
            <button
              type="button"
              onClick={() => setDiaSelecionado(null)}
              aria-label="Fechar"
              className="text-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {(tarefasPorDia.get(diaSelecionado) ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelecionar(t)}
                className="flex items-center gap-2 rounded-lg border border-border bg-white px-2.5 py-2 text-left text-xs"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full border ${corStatus(t.status)}`} />
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${corResponsavel(
                    t.quem
                  )}`}
                >
                  {iniciais(t.quem)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{t.titulo}</span>
                  <span className="block truncate text-muted">
                    {t.cliente?.nome ?? "Sem cliente"} · {t.status}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
