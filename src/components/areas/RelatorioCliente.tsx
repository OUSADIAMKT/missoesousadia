"use client";

import { STATUSES_CONCLUIDOS, STATUSES_PENDENTES, type TarefaComContexto } from "@/lib/types";
import { corGraficoEscuro, dataDeConclusao, formatDateBR } from "@/lib/utils";
import { AnelProgresso, CardPainel } from "./painel/PainelUI";

interface RelatorioClienteProps {
  clienteNome: string;
  tarefas: TarefaComContexto[];
}

interface EsforcoProjeto {
  nome: string;
  horas: number;
  semEstimativa: number;
}

// Soma horasEstimadas por projeto — é uma estimativa de esforço, não horas
// realmente apontadas (o app ainda não tem apontamento de horas).
function calcularEsforcoPorProjeto(tarefas: TarefaComContexto[]): EsforcoProjeto[] {
  const porProjeto = new Map<string, EsforcoProjeto>();
  for (const t of tarefas) {
    const nome = t.projeto?.nome ?? "Sem projeto";
    const atual = porProjeto.get(nome) ?? { nome, horas: 0, semEstimativa: 0 };
    if (t.horasEstimadas) {
      atual.horas += t.horasEstimadas;
    } else {
      atual.semEstimativa += 1;
    }
    porProjeto.set(nome, atual);
  }
  return Array.from(porProjeto.values()).sort((a, b) => b.horas - a.horas);
}

interface EnvolvidoResumo {
  nome: string;
  qtdMissoes: number;
  horasEstimadas: number;
}

function calcularProfissionaisEnvolvidos(tarefas: TarefaComContexto[]): EnvolvidoResumo[] {
  const porPessoa = new Map<string, EnvolvidoResumo>();
  for (const t of tarefas) {
    const atual = porPessoa.get(t.quem) ?? { nome: t.quem, qtdMissoes: 0, horasEstimadas: 0 };
    atual.qtdMissoes += 1;
    atual.horasEstimadas += t.horasEstimadas ?? 0;
    porPessoa.set(t.quem, atual);
  }
  return Array.from(porPessoa.values()).sort((a, b) => b.qtdMissoes - a.qtdMissoes);
}

export function RelatorioCliente({ clienteNome, tarefas }: RelatorioClienteProps) {
  const total = tarefas.length;

  if (total === 0) {
    return (
      <CardPainel>
        <p className="text-center text-sm text-slate-400">
          {clienteNome} ainda não tem missões registradas.
        </p>
      </CardPainel>
    );
  }

  const concluidas = tarefas.filter((t) => STATUSES_CONCLUIDOS.includes(t.status));
  const pendentes = tarefas.filter((t) => !STATUSES_CONCLUIDOS.includes(t.status));
  const pctConcluido = Math.round((concluidas.length / total) * 100);
  const esforcoPorProjeto = calcularEsforcoPorProjeto(tarefas);
  const horasTotal = esforcoPorProjeto.reduce((soma, p) => soma + p.horas, 0);
  const semEstimativaTotal = esforcoPorProjeto.reduce((soma, p) => soma + p.semEstimativa, 0);
  const envolvidos = calcularProfissionaisEnvolvidos(tarefas);

  return (
    <div className="flex flex-col gap-4">
      <CardPainel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-sans text-lg font-bold text-white">Resumo — {clienteNome}</h3>
            <div className="mt-3 flex flex-wrap gap-6">
              <div>
                <p className="text-2xl font-bold tabular-nums text-white">{total}</p>
                <p className="text-xs text-slate-500">missões no total</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-emerald-400">{pctConcluido}%</p>
                <p className="text-xs text-slate-500">concluído/aprovado</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-white">
                  {horasTotal}h
                  {semEstimativaTotal > 0 && (
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      +{semEstimativaTotal} s/ estimativa
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">esforço estimado</p>
              </div>
            </div>
          </div>
          <AnelProgresso percentual={pctConcluido} cor="#10B981" tamanho={72} />
        </div>

        <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${pctConcluido}%` }}
            title={`Concluído/Aprovado · ${pctConcluido}%`}
          />
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${100 - pctConcluido}%` }}
            title={`Pendente · ${100 - pctConcluido}%`}
          />
        </div>
      </CardPainel>

      <div className="grid gap-4 xl:grid-cols-2">
        <CardPainel titulo={`O que foi feito (${concluidas.length})`}>
          {concluidas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma missão concluída ou aprovada ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {concluidas.map((t) => {
                const concluidaEm = dataDeConclusao(t);
                return (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 border-l-2 border-l-emerald-500 bg-slate-950/60 p-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-slate-100">{t.titulo}</span>
                      <span className="block text-xs text-slate-500">
                        {t.projeto?.nome ?? "Sem projeto"}
                        {concluidaEm && ` · concluído em ${formatDateBR(concluidaEm)}`}
                      </span>
                    </span>
                    <span
                      className="shrink-0 rounded-full border border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ color: corGraficoEscuro(t.status) }}
                    >
                      {t.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardPainel>

        <CardPainel titulo={`O que falta (${pendentes.length})`}>
          {pendentes.length === 0 ? (
            <p className="text-sm text-emerald-400">Nada pendente — tudo concluído ou aprovado.</p>
          ) : (
            <div className="space-y-3">
              {STATUSES_PENDENTES.map((status) => {
                const doStatus = pendentes.filter((t) => t.status === status);
                if (doStatus.length === 0) return null;
                return (
                  <div key={status}>
                    <p
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: corGraficoEscuro(status) }}
                    >
                      {status} ({doStatus.length})
                    </p>
                    <ul className="mt-1 space-y-1.5">
                      {doStatus.map((t) => (
                        <li
                          key={t.id}
                          className="rounded-lg border border-slate-800 border-l-2 bg-slate-950/60 p-2.5 text-sm text-slate-100"
                          style={{ borderLeftColor: corGraficoEscuro(status) }}
                        >
                          {t.titulo}
                          <span className="ml-1 text-xs text-slate-500">
                            — prazo {formatDateBR(t.prazoEntrega)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardPainel>
      </div>

      <CardPainel
        titulo="Profissionais envolvidos"
        legenda="Missões e horas estimadas por pessoa"
      >
        <p className="mb-3 text-xs text-slate-500">
          Ainda não é custo real (falta valor de hora por pessoa) — é uma base para pensar
          precificação.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-y border-slate-800 bg-slate-950/60 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Profissional</th>
                <th className="px-3 py-2.5">Missões</th>
                <th className="px-3 py-2.5">Horas est.</th>
                <th className="px-3 py-2.5 text-right">Participação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {envolvidos.map((e) => (
                <tr key={e.nome} className="transition-colors hover:bg-slate-800/40">
                  <td className="px-3 py-2 font-semibold text-slate-100">{e.nome}</td>
                  <td className="px-3 py-2 tabular-nums">{e.qtdMissoes} missões</td>
                  <td className="px-3 py-2 tabular-nums">{e.horasEstimadas}h</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-white">
                    {Math.round((e.qtdMissoes / total) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardPainel>
    </div>
  );
}
