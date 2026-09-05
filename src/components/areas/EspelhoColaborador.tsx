"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { STATUSES_CONCLUIDOS, type TarefaComContexto } from "@/lib/types";
import {
  corGraficoEscuro,
  corResponsavel,
  corSequencialEscura,
  dataDeConclusao,
  formatBRL,
  formatDateBR,
  iniciais,
  isAtrasada,
} from "@/lib/utils";
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
import { AnelProgresso, CardPainel, IndicadorComparativo, TooltipEscuro } from "./painel/PainelUI";

interface EspelhoColaboradorProps {
  colaboradorNome: string;
  tarefasDoColaborador: TarefaComContexto[];
  todasTarefas: TarefaComContexto[];
}

// Missões cadastradas retroativamente já como "Concluído" recebem a data do
// cadastro no histórico, não a da entrega real — o que distorce qualquer métrica
// derivada da data de conclusão. Enquanto o cálculo não exclui esses casos, a UI
// avisa em vez de deixar o número passar como confiável.
const RESSALVA_DATA_CONCLUSAO =
  "Missões cadastradas retroativamente já como Concluído entram com a data do cadastro, não a da entrega real — isso distorce esta métrica.";

function valorPessoa(stat: EstatisticaTime, nome: string): number | undefined {
  return stat.porPessoa[nome];
}

function CartaoMetrica({
  titulo,
  valorExibido,
  valorNumerico,
  semAmostra,
  media,
  maiorEhMelhor,
  ressalva,
}: {
  titulo: string;
  valorExibido: string;
  valorNumerico: number;
  semAmostra: boolean;
  media: number;
  maiorEhMelhor: boolean;
  ressalva?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {titulo}
        </span>
        {ressalva && (
          <span title={ressalva} aria-label={ressalva} className="cursor-help text-[11px] text-amber-400">
            ⚠
          </span>
        )}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums text-white">
        {semAmostra ? "—" : valorExibido}
      </div>
      {semAmostra ? (
        <span className="text-[11px] font-medium text-slate-500">sem dados suficientes</span>
      ) : (
        <IndicadorComparativo valor={valorNumerico} media={media} maiorEhMelhor={maiorEhMelhor} />
      )}
    </div>
  );
}

const BADGE_PRAZO = {
  atrasada: { icone: "🔴", rotulo: "Vencida", classe: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  proxima: { icone: "🟡", rotulo: "Próximos 2 dias", classe: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  segura: { icone: "🟢", rotulo: "Prazo seguro", classe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  semPrazo: { icone: "🔘", rotulo: "Sem prazo", classe: "border-slate-700 bg-slate-800 text-slate-400" },
};

export function EspelhoColaborador({
  colaboradorNome,
  tarefasDoColaborador,
  todasTarefas,
}: EspelhoColaboradorProps) {
  const total = tarefasDoColaborador.length;

  if (total === 0) {
    return (
      <CardPainel>
        <p className="text-center text-sm text-slate-400">
          {colaboradorNome} ainda não tem missões atribuídas.
        </p>
      </CardPainel>
    );
  }

  const concluidas = tarefasDoColaborador.filter((t) => STATUSES_CONCLUIDOS.includes(t.status));
  const pendentes = tarefasDoColaborador.filter((t) => !STATUSES_CONCLUIDOS.includes(t.status));
  const emAndamento = tarefasDoColaborador.filter((t) => t.status === "Em Andamento");
  const pctConcluido = Math.round((concluidas.length / total) * 100);
  const pctAndamento = Math.round((emAndamento.length / total) * 100);
  const pctFila = Math.max(0, 100 - pctConcluido - pctAndamento);
  const atrasadas = pendentes.filter((t) => isAtrasada(t.prazoEntrega, t.status));
  const horasTotal = tarefasDoColaborador.reduce((soma, t) => soma + (t.horasEstimadas ?? 0), 0);
  const semEstimativaTotal = tarefasDoColaborador.filter((t) => !t.horasEstimadas).length;

  const statPrazo = percentualNoPrazo(todasTarefas);
  const statCycle = cycleTimeMedioDias(todasTarefas);
  const statThroughput = throughputSemanal(todasTarefas);
  const statRetrabalho = taxaRetrabalho(todasTarefas);
  const statAging = agingMedioDias(todasTarefas);
  const statConcentracao = indiceConcentracaoCliente(todasTarefas);
  const cargaPessoa = calcularCargaPorPessoa(todasTarefas).find((c) => c.nome === colaboradorNome);

  const distribuicaoCliente = calcularDistribuicaoPorCliente(tarefasDoColaborador);
  const mixTipo = mixPorTipoDeMissao();
  const timeline = agingDasAtivas(tarefasDoColaborador);

  const concentracaoPessoa = valorPessoa(statConcentracao, colaboradorNome);
  const emRiscoDeConcentracao = (concentracaoPessoa ?? 0) > LIMITE_CONCENTRACAO_RISCO;
  const prazoPessoa = valorPessoa(statPrazo, colaboradorNome);

  const precisao = precisaoEstimativa(tarefasDoColaborador);
  const produtividade = produtividadeReal(tarefasDoColaborador);
  const financeiro = retornoFinanceiroPorColaborador(
    tarefasDoColaborador,
    todasTarefas,
    colaboradorNome
  );

  return (
    <div className="flex flex-col gap-4">
      <CardPainel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-xs font-bold ${corResponsavel(
                colaboradorNome
              )}`}
            >
              {iniciais(colaboradorNome)}
            </span>
            <div>
              <h3 className="font-sans text-lg font-bold text-white">
                Espelho — {colaboradorNome}
              </h3>
              <p className="text-xs text-slate-400">
                Comparado sempre com a média do time — não é um ranking.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AnelProgresso percentual={pctConcluido} cor="#10B981" tamanho={64} />
            <div>
              <div className="text-xl font-bold tabular-nums text-emerald-400">{pctConcluido}%</div>
              <div className="text-[11px] text-slate-500">
                {concluidas.length} de {total} entregues
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Missões atribuídas
            </span>
            <div className="mt-1 text-xl font-bold tabular-nums text-white">{total}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Horas estimadas
            </span>
            <div className="mt-1 text-xl font-bold tabular-nums text-white">
              {horasTotal}h
              {semEstimativaTotal > 0 && (
                <span className="ml-1 text-xs font-normal text-slate-500">
                  +{semEstimativaTotal} s/ estimativa
                </span>
              )}
            </div>
          </div>
          <div
            className={`rounded-lg border p-3 ${
              atrasadas.length > 0
                ? "border-rose-500/40 bg-rose-500/5"
                : "border-slate-800 bg-slate-950/60"
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Carga ativa
            </span>
            <div
              className={`mt-1 text-xl font-bold tabular-nums ${
                atrasadas.length > 0 ? "text-rose-400" : "text-white"
              }`}
            >
              {pendentes.length}
              {atrasadas.length > 0 && (
                <span className="ml-1.5 text-xs font-semibold">
                  · {atrasadas.length} atrasada{atrasadas.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {cargaPessoa?.sobrecarregada && (
              <span className="mt-1 inline-block rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                acima da média do time
              </span>
            )}
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Concentração
            </span>
            <div
              className={`mt-1 text-xl font-bold tabular-nums ${
                emRiscoDeConcentracao ? "text-amber-400" : "text-white"
              }`}
            >
              {concentracaoPessoa ?? 0}%
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              {emRiscoDeConcentracao
                ? "⚠ risco de dependência"
                : `time: ${Math.round(statConcentracao.media)}%`}
            </span>
          </div>
        </div>

        <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${pctConcluido}%` }}
            title={`Concluído/Aprovado · ${pctConcluido}%`}
          />
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${pctAndamento}%` }}
            title={`Em andamento · ${pctAndamento}%`}
          />
          <div
            className="h-full bg-slate-600 transition-all duration-300"
            style={{ width: `${pctFila}%` }}
            title={`Fila / ajustes · ${pctFila}%`}
          />
        </div>
      </CardPainel>

      <CardPainel titulo="Confiabilidade & ritmo" legenda="Sempre vs. a média do time">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <CartaoMetrica
            titulo="% no prazo"
            valorExibido={`${prazoPessoa ?? 0}%`}
            valorNumerico={prazoPessoa ?? 0}
            semAmostra={prazoPessoa === undefined}
            media={statPrazo.media}
            maiorEhMelhor
            ressalva={RESSALVA_DATA_CONCLUSAO}
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
            ressalva={RESSALVA_DATA_CONCLUSAO}
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
          <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Base de comparação
            </span>
            <div className="mt-1 text-lg font-bold tabular-nums text-white">
              {statPrazo.baseAmostral} pessoa{statPrazo.baseAmostral === 1 ? "" : "s"}
            </div>
            <span className="text-[11px] font-medium text-slate-500">com entregas concluídas</span>
          </div>
        </div>
      </CardPainel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CardPainel
          titulo={`Onde ${colaboradorNome.split(" ")[0]} mais atua`}
          legenda="Horas estimadas por cliente"
        >
          <div className="min-w-0">
            <ResponsiveContainer
              width="100%"
              height={Math.max(120, distribuicaoCliente.length * 42)}
            >
              <BarChart data={distribuicaoCliente} layout="vertical" margin={{ left: 4, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={96}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={TooltipEscuro} cursor={{ fill: "#1e293b80" }} />
                <Bar
                  dataKey="horas"
                  name="Horas"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                  isAnimationActive={false}
                >
                  {distribuicaoCliente.map((c, i) => (
                    <Cell key={c.nome} fill={corSequencialEscura(i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardPainel>

        <CardPainel titulo="Mix por tipo de missão">
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 text-center">
            <p className="text-sm font-medium text-slate-300">Campo ausente no modelo de dados</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Precisa de{" "}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">
                {mixTipo.campoNecessario}
              </code>{" "}
              pra existir. Sem isso, 5 briefings e 5 edições contam igual — preferimos não mostrar
              um número fabricado.
            </p>
          </div>
        </CardPainel>
      </div>

      <CardPainel titulo={`Próximos vencimentos (${timeline.length})`} legenda="Mais próximo primeiro">
        {timeline.length === 0 ? (
          <p className="text-sm text-emerald-400">Nada ativo no momento.</p>
        ) : (
          <ul className="space-y-1.5">
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
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-100">{item.titulo}</span>
                    <span className="ml-1.5 text-xs text-slate-500">{item.clienteNome}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ color: corGraficoEscuro(item.status) }}
                    >
                      {item.status}
                    </span>
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${badge.classe}`}
                    >
                      {badge.icone}{" "}
                      {item.prazoEntrega ? formatDateBR(item.prazoEntrega) : badge.rotulo}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardPainel>

      <CardPainel titulo="Entregas realizadas" legenda={`${concluidas.length} concluídas`}>
        {concluidas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma missão concluída ou aprovada ainda.</p>
        ) : (
          <ul className="space-y-1.5">
            {concluidas.map((t) => {
              const concluidaEm = dataDeConclusao(t);
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 border-l-2 border-l-emerald-500 bg-slate-950/60 p-2.5 text-sm"
                >
                  <span className="min-w-0 font-medium text-slate-100">{t.titulo}</span>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="rounded-full border border-slate-700 px-1.5 py-0.5">
                      {t.cliente?.nome ?? "Sem cliente"}
                    </span>
                    {concluidaEm && (
                      <span className="rounded-full border border-slate-700 px-1.5 py-0.5">
                        {formatDateBR(concluidaEm)}
                      </span>
                    )}
                    {!!t.horasEstimadas && (
                      <span className="rounded-full border border-slate-700 px-1.5 py-0.5">
                        {t.horasEstimadas}h
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardPainel>

      <details className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/20">
        <summary className="cursor-pointer font-sans text-xs font-bold uppercase tracking-wider text-slate-300">
          Produtividade real &amp; retorno financeiro (em construção)
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Tier 2 — produtividade real
            </p>
            <p className="mt-2 text-sm text-slate-300">
              <span className="font-medium text-slate-200">Precisão da estimativa:</span>{" "}
              {precisao.disponivel
                ? `${precisao.desvioPercentualMedio}% de desvio médio`
                : "aguardando dados"}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              <span className="font-medium text-slate-200">Produtividade real:</span>{" "}
              {produtividade.disponivel
                ? `${produtividade.entregasPorHora} entregas/hora`
                : "aguardando dados"}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Precisa de apontamento de horas reais por missão (hoje só existe a estimativa).
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Tier 3 — retorno financeiro
            </p>
            <p className="mt-2 text-sm text-slate-300">
              <span className="font-medium text-slate-200">Margem estimada:</span>{" "}
              {financeiro.disponivel ? formatBRL(financeiro.margem) : "aguardando dados"}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Precisa de receita mensal por cliente e custo/hora por pessoa (nenhum dos dois está
              cadastrado hoje).
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
