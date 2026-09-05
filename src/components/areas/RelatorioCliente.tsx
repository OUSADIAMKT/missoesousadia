"use client";

import { STATUSES_CONCLUIDOS, STATUSES_PENDENTES, type TarefaComContexto } from "@/lib/types";
import { corStatus, dataDeConclusao, formatDateBR } from "@/lib/utils";

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
      <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        {clienteNome} ainda não tem missões registradas.
      </p>
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
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="font-sans text-lg font-bold text-slate-900">Resumo — {clienteNome}</h2>
        <div className="mt-3 flex flex-wrap gap-6">
          <div>
            <p className="text-2xl font-bold text-slate-900">{total}</p>
            <p className="text-xs text-slate-500">missões no total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-accent-green">{pctConcluido}%</p>
            <p className="text-xs text-slate-500">concluído/aprovado</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">
              {horasTotal}h
              {semEstimativaTotal > 0 && (
                <span className="ml-1 text-xs font-normal text-slate-500">
                  (+{semEstimativaTotal} sem estimativa)
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500">esforço estimado</p>
          </div>
        </div>

        {/* Barra segmentada: concluído vs pendente */}
        <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-accent-green transition-all duration-300"
            style={{ width: `${pctConcluido}%` }}
            title={`Concluído/Aprovado · ${pctConcluido}%`}
          />
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${100 - pctConcluido}%` }}
            title={`Pendente · ${100 - pctConcluido}%`}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-slate-500">
            O que foi feito ({concluidas.length})
          </h3>
          {concluidas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nenhuma missão concluída ou aprovada ainda.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {concluidas.map((t) => {
                const concluidaEm = dataDeConclusao(t);
                return (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-slate-200/60 border-l-4 border-l-accent-green bg-slate-50 p-2.5 text-sm"
                  >
                    <span>
                      {t.titulo}
                      <span className="block text-xs text-slate-500">
                        {t.projeto?.nome ?? "Sem projeto"}
                        {concluidaEm && ` · concluído em ${formatDateBR(concluidaEm)}`}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${corStatus(
                        t.status
                      )}`}
                    >
                      {t.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-slate-500">
            O que falta ({pendentes.length})
          </h3>
          {pendentes.length === 0 ? (
            <p className="mt-3 text-sm text-accent-green">Nada pendente — tudo concluído ou aprovado.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {STATUSES_PENDENTES.map((status) => {
                const doStatus = pendentes.filter((t) => t.status === status);
                if (doStatus.length === 0) return null;
                return (
                  <div key={status}>
                    <p className="text-xs font-semibold text-slate-500">
                      {status} ({doStatus.length})
                    </p>
                    <ul className="mt-1 space-y-1.5">
                      {doStatus.map((t) => (
                        <li
                          key={t.id}
                          className="rounded-lg border border-slate-200/60 border-l-4 border-l-brand bg-slate-50 p-2.5 text-sm text-slate-800"
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
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-slate-500">
          Profissionais envolvidos
        </h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          Missões e horas estimadas por pessoa — ainda não é custo real (falta valor de hora por
          pessoa), é uma base para pensar precificação.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-y border-slate-200/60 bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Profissional</th>
                <th className="px-3 py-2.5">Missões</th>
                <th className="px-3 py-2.5">Horas est.</th>
                <th className="px-3 py-2.5 text-right">Participação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {envolvidos.map((e) => (
                <tr key={e.nome} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-semibold text-slate-800">{e.nome}</td>
                  <td className="px-3 py-2">{e.qtdMissoes} missões</td>
                  <td className="px-3 py-2">{e.horasEstimadas}h</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-700">
                    {Math.round((e.qtdMissoes / total) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
