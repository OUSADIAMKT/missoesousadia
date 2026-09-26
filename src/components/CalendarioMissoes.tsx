"use client";

import { useMemo, useState } from "react";
import type { TarefaComContexto } from "@/lib/types";
import { corPrazo, corResponsavel, iniciais, isAtrasada, isProximaDoPrazo } from "@/lib/utils";
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

  const mesAnterior = () => {
    if (mesIndex0 === 0) {
      setAno((a) => a - 1);
      setMesIndex0(11);
    } else {
      setMesIndex0((m) => m - 1);
    }
  };
  const mesSeguinte = () => {
    if (mesIndex0 === 11) {
      setAno((a) => a + 1);
      setMesIndex0(0);
    } else {
      setMesIndex0((m) => m + 1);
    }
  };
  const irParaHoje = () => {
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
          return (
            <div
              key={celula.iso}
              className={`min-h-[84px] rounded-lg border p-1 ${
                celula.doMesAtual ? "border-neutral-200/80 bg-white" : "border-transparent bg-slate-50/60"
              } ${celula.ehHoje ? "ring-2 ring-brand/50" : ""}`}
            >
              <span
                className={`text-[11px] font-semibold ${
                  celula.doMesAtual ? "text-foreground" : "text-neutral-300"
                } ${celula.ehHoje ? "text-brand" : ""}`}
              >
                {celula.dia}
              </span>
              <div className="mt-1 flex flex-col gap-0.5">
                {visiveis.map((t) => {
                  const atrasada = isAtrasada(t.prazoEntrega, t.status);
                  const proxima = isProximaDoPrazo(t.prazoEntrega, t.status);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelecionar(t)}
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
    </div>
  );
}
