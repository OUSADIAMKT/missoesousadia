"use client";

import { useMemo, useState } from "react";
import { STATUSES, type TarefaComContexto } from "@/lib/types";
import { corBarraStatus, corResponsavel, iniciais } from "@/lib/utils";
import { calcularCargaPorPessoa } from "@/lib/performance-metrics";
import { EspelhoColaborador } from "./EspelhoColaborador";
import { RelatorioCliente } from "./RelatorioCliente";

type VisaoRelatorio = "cliente" | "colaborador";

interface AreaPerformanceProps {
  tarefas: TarefaComContexto[];
}

export function AreaPerformance({ tarefas }: AreaPerformanceProps) {
  const total = tarefas.length;
  const cargaPorPessoa = calcularCargaPorPessoa(tarefas);
  const maiorCarga = cargaPorPessoa[0]?.qtd ?? 0;

  const concluidasGlobal = tarefas.filter(
    (t) => t.status === "Concluído" || t.status === "Aprovado"
  ).length;
  const emAndamentoGlobal = tarefas.filter((t) => t.status === "Em Andamento").length;
  const emRiscoGlobal = tarefas.filter((t) => t.status === "Ajustes Solicitados").length;
  const taxaConclusaoGlobal = total > 0 ? Math.round((concluidasGlobal / total) * 100) : 0;

  const clientes = useMemo(() => {
    const porId = new Map<string, string>();
    for (const t of tarefas) {
      if (t.cliente) porId.set(t.cliente.id, t.cliente.nome);
    }
    return Array.from(porId, ([id, nome]) => ({ id, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );
  }, [tarefas]);

  const colaboradores = useMemo(() => {
    const nomes = new Set(tarefas.map((t) => t.quem).filter(Boolean));
    return Array.from(nomes).sort((a, b) => a.localeCompare(b));
  }, [tarefas]);

  const [visao, setVisao] = useState<VisaoRelatorio>("cliente");

  const [clienteId, setClienteId] = useState("");
  const clienteSelecionado = clientes.find((c) => c.id === clienteId);
  const tarefasDoCliente = useMemo(
    () => tarefas.filter((t) => t.cliente?.id === clienteId),
    [tarefas, clienteId]
  );

  const [colaboradorNome, setColaboradorNome] = useState("");
  const tarefasDoColaborador = useMemo(
    () => tarefas.filter((t) => t.quem === colaboradorNome),
    [tarefas, colaboradorNome]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs globais */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total de missões
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900">{total}</div>
          <span className="mt-1 inline-block text-[11px] font-medium text-slate-500">
            Volume total registrado
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Taxa de conclusão
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900">{taxaConclusaoGlobal}%</div>
          <span className="mt-1 inline-block rounded-full bg-accent-green-soft px-2 py-0.5 text-[11px] font-semibold text-accent-green">
            Vazão da agência
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Em produção
          </span>
          <div className="mt-1 text-2xl font-bold text-brand">{emAndamentoGlobal}</div>
          <span className="mt-1 inline-block text-[11px] font-medium text-slate-500">
            Missões em andamento
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ajustes / risco
          </span>
          <div className="mt-1 text-2xl font-bold text-danger">{emRiscoGlobal}</div>
          <span className="mt-1 inline-block rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
            Atenção imediata
          </span>
        </div>
      </div>

      {/* Carga por pessoa + Missões por status, lado a lado */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-sans text-sm font-bold tracking-wide text-slate-800">
              Carga por pessoa
            </h2>
            <span className="text-xs font-medium text-slate-400">Missões ativas</span>
          </div>
          {cargaPorPessoa.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma missão ativa no momento.</p>
          ) : (
            <div className="space-y-4">
              {cargaPorPessoa.map(({ nome, qtd, sobrecarregada }) => (
                <div key={nome} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${corResponsavel(
                          nome
                        )}`}
                      >
                        {iniciais(nome)}
                      </span>
                      <span className="truncate">{nome}</span>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {sobrecarregada && (
                        <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                          sobrecarregada
                        </span>
                      )}
                      <span className="font-bold text-slate-900">{qtd}</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        sobrecarregada ? "bg-danger" : "bg-brand"
                      }`}
                      style={{ width: `${maiorCarga > 0 ? Math.round((qtd / maiorCarga) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-sans text-sm font-bold tracking-wide text-slate-800">
              Missões por status
            </h2>
            <span className="text-xs font-medium text-slate-400">Volume &amp; funil</span>
          </div>
          <div className="space-y-3">
            {STATUSES.map((status) => {
              const qtd = tarefas.filter((t) => t.status === status).length;
              const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>{status}</span>
                    <span className="text-slate-900">
                      {qtd} <span className="font-normal text-slate-400">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${corBarraStatus(
                        status
                      )}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Relatório detalhado — por cliente ou por colaborador */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-sans text-base font-bold text-slate-900">
            Relatório por {visao === "cliente" ? "cliente" : "colaborador"}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                aria-pressed={visao === "cliente"}
                onClick={() => setVisao("cliente")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  visao === "cliente"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                🏢 Por cliente
              </button>
              <button
                type="button"
                aria-pressed={visao === "colaborador"}
                onClick={() => setVisao("colaborador")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  visao === "colaborador"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                👤 Por colaborador
              </button>
            </div>

            {visao === "cliente" ? (
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Selecione um cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={colaboradorNome}
                onChange={(e) => setColaboradorNome(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Selecione um colaborador...</option>
                {colaboradores.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {visao === "cliente" && !clienteSelecionado && (
          <p className="mt-3 text-sm text-slate-500">
            Escolha um cliente para ver o que foi feito, o que falta, esforço estimado e quem
            esteve envolvido.
          </p>
        )}
        {visao === "colaborador" && !colaboradorNome && (
          <p className="mt-3 text-sm text-slate-500">
            Escolha um colaborador para auditar capacidade produtiva, horas dedicadas, entregas e
            possíveis gargalos individuais.
          </p>
        )}
      </div>

      {visao === "cliente" && clienteSelecionado && (
        <RelatorioCliente clienteNome={clienteSelecionado.nome} tarefas={tarefasDoCliente} />
      )}
      {visao === "colaborador" && colaboradorNome && (
        <EspelhoColaborador
          colaboradorNome={colaboradorNome}
          tarefasDoColaborador={tarefasDoColaborador}
          todasTarefas={tarefas}
        />
      )}

      <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        Custo por atividade e rentabilidade em R$ chegam quando tivermos valor de hora por pessoa e
        apontamento de horas reais.
      </p>
    </div>
  );
}
