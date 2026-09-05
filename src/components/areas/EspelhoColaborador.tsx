"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { type TarefaComContexto } from "@/lib/types";
import { corResponsavel, corStatus, formatBRL, formatDateBR, iniciais, isAtrasada } from "@/lib/utils";
import {
  agingDasAtivas,
  agingMedioDias,
  calcularCargaPorPessoa,
  calcularDistribuicaoPorCliente,
  cycleTimeMedioDias,
  formatDias,
  indiceConcentracaoCliente,
  LIMITE_CONCENTRACAO_RISCO,
  mixPorTipoDeMissao,
  percentualNoPrazo,
  precisaoEstimativa,
  produtividadeReal,
  retornoFinanceiroPorColaborador,
  taxaRetrabalho,
  throughputSemanal,
  type EstatisticaTime,
} from "@/lib/performance-metrics";

interface EspelhoColaboradorProps {
  colaboradorNome: string;
  tarefasDoColaborador: TarefaComContexto[];
  todasTarefas: TarefaComContexto[];
}

// Seta + texto (nunca só cor) comparando a pessoa com a média do time. Pensado
// pra métricas de desempenho/confiabilidade — não usar em métricas que são só
// um sinal de risco (ex.: concentração de cliente tem tratamento próprio abaixo).
function IndicadorComparativo({
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
    return <span className="text-[11px] font-medium text-slate-400">≈ na média do time</span>;
  }
  const estaAcima = diferenca > 0;
  const eBom = estaAcima === maiorEhMelhor;
  return (
    <span className={`text-[11px] font-semibold ${eBom ? "text-accent-green" : "text-danger"}`}>
      {estaAcima ? "▲" : "▼"} {estaAcima ? "acima" : "abaixo"} da média
    </span>
  );
}

function CartaoMetrica({
  titulo,
  valorExibido,
  valorNumerico,
  semAmostra,
  media,
  maiorEhMelhor,
}: {
  titulo: string;
  valorExibido: string;
  valorNumerico: number;
  semAmostra: boolean;
  media: number;
  maiorEhMelhor: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{titulo}</span>
      <div className="mt-1 text-lg font-bold text-slate-900">{semAmostra ? "—" : valorExibido}</div>
      {semAmostra ? (
        <span className="text-[11px] font-medium text-slate-400">sem dados suficientes</span>
      ) : (
        <IndicadorComparativo valor={valorNumerico} media={media} maiorEhMelhor={maiorEhMelhor} />
      )}
    </div>
  );
}

function valorPessoa(stat: EstatisticaTime, nome: string): number | undefined {
  return stat.porPessoa[nome];
}

function TooltipDistribuicao({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)}>
          {p.dataKey === "horas" ? "Horas estimadas" : String(p.name)}: {p.value}
          {p.dataKey === "horas" ? "h" : ""}
        </p>
      ))}
    </div>
  );
}

const BADGE_PRAZO = {
  atrasada: { icone: "🔴", rotulo: "Vencida", classe: "border-danger/30 bg-danger/10 text-danger" },
  proxima: { icone: "🟡", rotulo: "Próximos 2 dias", classe: "border-accent/30 bg-accent-soft text-accent" },
  segura: { icone: "🟢", rotulo: "Prazo seguro", classe: "border-accent-green/20 bg-accent-green-soft/60 text-accent-green" },
  semPrazo: { icone: "🔘", rotulo: "Sem prazo", classe: "border-border text-muted" },
};

export function EspelhoColaborador({
  colaboradorNome,
  tarefasDoColaborador,
  todasTarefas,
}: EspelhoColaboradorProps) {
  const total = tarefasDoColaborador.length;

  if (total === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        {colaboradorNome} ainda não tem missões atribuídas.
      </p>
    );
  }

  const concluidas = tarefasDoColaborador.filter(
    (t) => t.status === "Concluído" || t.status === "Aprovado"
  );
  const pendentes = tarefasDoColaborador.filter(
    (t) => t.status !== "Concluído" && t.status !== "Aprovado"
  );
  const emAndamento = tarefasDoColaborador.filter((t) => t.status === "Em Andamento");
  const pctConcluido = Math.round((concluidas.length / total) * 100);
  const pctAndamento = Math.round((emAndamento.length / total) * 100);
  const pctFila = Math.max(0, 100 - pctConcluido - pctAndamento);
  const atrasadas = pendentes.filter((t) => isAtrasada(t.prazoEntrega, t.status));
  const horasTotal = tarefasDoColaborador.reduce((soma, t) => soma + (t.horasEstimadas ?? 0), 0);
  const semEstimativaTotal = tarefasDoColaborador.filter((t) => !t.horasEstimadas).length;

  // Comparativos — sempre calculados sobre o time inteiro, pra pegar a média real.
  const statPrazo = percentualNoPrazo(todasTarefas);
  const statCycle = cycleTimeMedioDias(todasTarefas);
  const statThroughput = throughputSemanal(todasTarefas);
  const statRetrabalho = taxaRetrabalho(todasTarefas);
  const statAging = agingMedioDias(todasTarefas);
  const statConcentracao = indiceConcentracaoCliente(todasTarefas);
  const cargaTime = calcularCargaPorPessoa(todasTarefas);
  const cargaPessoa = cargaTime.find((c) => c.nome === colaboradorNome);

  const distribuicaoCliente = calcularDistribuicaoPorCliente(tarefasDoColaborador);
  const mixTipo = mixPorTipoDeMissao();
  const timeline = agingDasAtivas(tarefasDoColaborador);

  const concentracaoPessoa = valorPessoa(statConcentracao, colaboradorNome);
  const emRiscoDeConcentracao = (concentracaoPessoa ?? 0) > LIMITE_CONCENTRACAO_RISCO;

  // Tier 2/3 — hoje sempre "indisponível" (nenhum caller tem horas reais/dados
  // financeiros ainda); o contrato já está pronto pra quando existirem.
  const precisao = precisaoEstimativa(tarefasDoColaborador);
  const produtividade = produtividadeReal(tarefasDoColaborador);
  const financeiro = retornoFinanceiroPorColaborador(tarefasDoColaborador, todasTarefas, colaboradorNome);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xs font-bold ${corResponsavel(
              colaboradorNome
            )}`}
          >
            {iniciais(colaboradorNome)}
          </span>
          <div>
            <h2 className="font-sans text-lg font-bold text-slate-900">
              Espelho — {colaboradorNome}
            </h2>
            <p className="text-xs text-slate-500">
              Comparado sempre com a média do time — não é um ranking.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Missões atribuídas
            </span>
            <div className="mt-1 text-xl font-bold text-slate-900">{total}</div>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Entregas concluídas
            </span>
            <div className="mt-1 text-xl font-bold text-accent-green">
              {concluidas.length}{" "}
              <span className="text-sm font-semibold text-slate-400">({pctConcluido}%)</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Horas estimadas
            </span>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {horasTotal}h
              {semEstimativaTotal > 0 && (
                <span className="ml-1 text-xs font-normal text-slate-500">
                  (+{semEstimativaTotal} sem estimativa)
                </span>
              )}
            </div>
          </div>
          <div
            className={`rounded-lg border p-3 ${
              atrasadas.length > 0 ? "border-danger/30 bg-danger/5" : "border-slate-200/80 bg-slate-50/70"
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Carga ativa
            </span>
            <div
              className={`mt-1 text-xl font-bold ${atrasadas.length > 0 ? "text-danger" : "text-slate-900"}`}
            >
              {pendentes.length}
              {atrasadas.length > 0 && (
                <span className="ml-1.5 text-xs font-semibold">
                  · {atrasadas.length} atrasada{atrasadas.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {cargaPessoa?.sobrecarregada && (
              <span className="mt-1 inline-block rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                acima da média do time
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-accent-green transition-all duration-300"
            style={{ width: `${pctConcluido}%` }}
            title={`Concluído/Aprovado · ${pctConcluido}%`}
          />
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${pctAndamento}%` }}
            title={`Em andamento · ${pctAndamento}%`}
          />
          <div
            className="h-full bg-slate-400 transition-all duration-300"
            style={{ width: `${pctFila}%` }}
            title={`Fila / ajustes · ${pctFila}%`}
          />
        </div>
      </div>

      {/* Confiabilidade — velocidade sempre ao lado de qualidade, nunca sozinha */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-slate-500">
          Confiabilidade &amp; ritmo
        </h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          Estimativas de prazo/horas são aproximação até termos apontamento real — ver nota no
          rodapé.
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <CartaoMetrica
            titulo="% no prazo"
            valorExibido={`${valorPessoa(statPrazo, colaboradorNome) ?? 0}%`}
            valorNumerico={valorPessoa(statPrazo, colaboradorNome) ?? 0}
            semAmostra={valorPessoa(statPrazo, colaboradorNome) === undefined}
            media={statPrazo.media}
            maiorEhMelhor
          />
          <CartaoMetrica
            titulo="Taxa de retrabalho"
            valorExibido={`${valorPessoa(statRetrabalho, colaboradorNome) ?? 0}%`}
            valorNumerico={valorPessoa(statRetrabalho, colaboradorNome) ?? 0}
            semAmostra={valorPessoa(statRetrabalho, colaboradorNome) === undefined}
            media={statRetrabalho.media}
            maiorEhMelhor={false}
          />
          <CartaoMetrica
            titulo="Cycle time médio"
            valorExibido={formatDias(valorPessoa(statCycle, colaboradorNome) ?? 0)}
            valorNumerico={valorPessoa(statCycle, colaboradorNome) ?? 0}
            semAmostra={valorPessoa(statCycle, colaboradorNome) === undefined}
            media={statCycle.media}
            maiorEhMelhor={false}
          />
          <CartaoMetrica
            titulo="Throughput"
            valorExibido={`${valorPessoa(statThroughput, colaboradorNome) ?? 0}/sem`}
            valorNumerico={valorPessoa(statThroughput, colaboradorNome) ?? 0}
            semAmostra={valorPessoa(statThroughput, colaboradorNome) === undefined}
            media={statThroughput.media}
            maiorEhMelhor
          />
          <CartaoMetrica
            titulo="Aging médio (ativas)"
            valorExibido={formatDias(valorPessoa(statAging, colaboradorNome) ?? 0)}
            valorNumerico={valorPessoa(statAging, colaboradorNome) ?? 0}
            semAmostra={valorPessoa(statAging, colaboradorNome) === undefined}
            media={statAging.media}
            maiorEhMelhor={false}
          />
          {/* Concentração de cliente tem tratamento próprio — é risco, não desempenho */}
          <div
            className={`rounded-lg border p-3 ${
              emRiscoDeConcentracao ? "border-accent/40 bg-accent-soft/60" : "border-slate-200/80 bg-slate-50/70"
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Concentração de cliente
            </span>
            <div className="mt-1 text-lg font-bold text-slate-900">{concentracaoPessoa ?? 0}%</div>
            <span className="text-[11px] font-medium text-slate-500">
              {emRiscoDeConcentracao
                ? "⚠ risco de dependência — não é demérito"
                : `média do time: ${Math.round(statConcentracao.media)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Distribuição por cliente e por tipo */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-slate-500">
            Onde {colaboradorNome.split(" ")[0]} mais atua
          </h3>
          <div className="mt-3 min-w-0">
            <ResponsiveContainer width="100%" height={Math.max(120, distribuicaoCliente.length * 40)}>
              <BarChart data={distribuicaoCliente} layout="vertical" margin={{ left: 8, right: 12 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={90}
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={TooltipDistribuicao} cursor={{ fill: "var(--surface-alt)" }} />
                <Bar dataKey="horas" className="fill-brand" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-slate-500">
            Mix por tipo de missão
          </h3>
          <div className="mt-3 flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
            <p className="text-sm font-medium text-slate-500">Campo ausente no modelo de dados</p>
            <p className="mt-1 text-xs text-slate-400">
              Precisa de <code className="rounded bg-slate-100 px-1 py-0.5">{mixTipo.campoNecessario}</code>{" "}
              pra existir. Sem isso, 5 briefings e 5 edições contam igual — o que distorceria a
              comparação, então preferimos não mostrar um número fabricado.
            </p>
          </div>
        </div>
      </div>

      {/* Timeline de próximos vencimentos */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-slate-500">
          Próximos vencimentos ({timeline.length})
        </h3>
        {timeline.length === 0 ? (
          <p className="mt-3 text-sm text-accent-green">Nada ativo no momento.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {timeline.map((item) => {
              const badge = !item.prazoEntrega
                ? BADGE_PRAZO.semPrazo
                : item.atrasada
                ? BADGE_PRAZO.atrasada
                : item.proximaDoPrazo
                ? BADGE_PRAZO.proxima
                : BADGE_PRAZO.segura;
              return (
                <li
                  key={item.tarefaId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/60 bg-slate-50 p-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800">{item.titulo}</span>
                    <span className="ml-1.5 text-xs text-slate-500">{item.clienteNome}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${corStatus(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${badge.classe}`}
                    >
                      {badge.icone} {item.prazoEntrega ? formatDateBR(item.prazoEntrega) : badge.rotulo}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Tier 2 e Tier 3 — scaffold honesto, sem dado fabricado */}
      <details className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer font-sans text-sm font-bold uppercase tracking-wide text-slate-500">
          Produtividade real &amp; retorno financeiro (em construção)
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tier 2 — produtividade real
            </p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Precisão da estimativa:</span>{" "}
              {precisao.disponivel
                ? `${precisao.desvioPercentualMedio}% de desvio médio`
                : "aguardando dados"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Produtividade real:</span>{" "}
              {produtividade.disponivel
                ? `${produtividade.entregasPorHora} entregas/hora`
                : "aguardando dados"}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              Precisa de apontamento de horas reais por missão (hoje só existe a estimativa).
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tier 3 — retorno financeiro
            </p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Margem estimada:</span>{" "}
              {financeiro.disponivel ? formatBRL(financeiro.margem) : "aguardando dados"}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              Precisa de receita mensal por cliente e custo/hora por pessoa (nenhum dos dois está
              cadastrado hoje).
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
