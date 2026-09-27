"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { gerarResumoExecutivo } from "@/lib/ia";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import {
  ROTULO_VINCULO,
  STATUSES,
  STATUSES_CONCLUIDOS,
  type Cliente,
  type TarefaComContexto,
  type Usuario,
} from "@/lib/types";
import {
  corGraficoEscuro,
  corResponsavel,
  corSequencialEscura,
  formatBRL,
  iniciais,
} from "@/lib/utils";
import {
  calcularCargaPorPessoa,
  custoPorEntregaNoMes,
  formatMes,
  lucroPorClienteNoMes,
  mesesComEntrega,
} from "@/lib/performance-metrics";
import { CardPainel, KpiTile, LegendaStatus, TooltipEscuro } from "./painel/PainelUI";
import { EspelhoColaborador } from "./EspelhoColaborador";
import { RelatorioCliente } from "./RelatorioCliente";

type VisaoRelatorio = "cliente" | "colaborador";

interface AreaPerformanceProps {
  tarefas: TarefaComContexto[];
  // Só para o custo por entrega: é de `usuarios` que vêm vínculo e custo
  // mensal. As demais métricas seguem derivando tudo das próprias missões.
  usuarios: Usuario[];
  // Lista completa de clientes, não só os que têm missão: um cliente que pagou
  // e não recebeu nenhuma entrega no mês é justamente o que precisa aparecer.
  // Nome diferente do `clientes` derivado das missões, logo abaixo, que
  // alimenta o seletor do relatório detalhado.
  clientesCadastrados: Cliente[];
}

export function AreaPerformance({
  tarefas,
  usuarios,
  clientesCadastrados,
}: AreaPerformanceProps) {
  const total = tarefas.length;

  const concluidasGlobal = tarefas.filter((t) => STATUSES_CONCLUIDOS.includes(t.status)).length;
  const emAndamentoGlobal = tarefas.filter((t) => t.status === "Em Andamento").length;
  const emRiscoGlobal = tarefas.filter((t) => t.status === "Ajustes Solicitados").length;
  const taxaConclusaoGlobal = total > 0 ? Math.round((concluidasGlobal / total) * 100) : 0;

  // Distribuição por status — só os que têm volume entram no donut; os zerados
  // viram uma nota compacta, em vez de metade do gráfico ser linha vazia.
  const porStatus = useMemo(
    () =>
      STATUSES.map((status) => {
        const qtd = tarefas.filter((t) => t.status === status).length;
        return {
          status,
          qtd,
          pct: total > 0 ? Math.round((qtd / total) * 100) : 0,
          cor: corGraficoEscuro(status),
        };
      }),
    [tarefas, total]
  );
  const statusComVolume = porStatus.filter((s) => s.qtd > 0);
  const statusZerados = porStatus.filter((s) => s.qtd === 0);

  // Carga por pessoa, segmentada por status: mostra não só quanto cada um tem
  // na mão, mas o quê.
  const statusAtivos = useMemo(
    () => STATUSES.filter((s) => !STATUSES_CONCLUIDOS.includes(s)),
    []
  );
  const carga = calcularCargaPorPessoa(tarefas);
  const statusAtivosComVolume = statusAtivos.filter((s) =>
    tarefas.some((t) => t.status === s)
  );
  const cargaEmpilhada = useMemo(
    () =>
      carga.map(({ nome }) => {
        const linha: Record<string, string | number> = { nome };
        for (const s of statusAtivos) {
          linha[s] = tarefas.filter((t) => t.quem === nome && t.status === s).length;
        }
        return linha;
      }),
    [carga, statusAtivos, tarefas]
  );

  const porCliente = useMemo(() => {
    const mapa = new Map<string, { name: string; size: number; horas: number }>();
    for (const t of tarefas) {
      const nome = t.cliente?.nome ?? "Sem cliente";
      const atual = mapa.get(nome) ?? { name: nome, size: 0, horas: 0 };
      atual.size += 1;
      atual.horas += t.horasEstimadas ?? 0;
      mapa.set(nome, atual);
    }
    return Array.from(mapa.values())
      .sort((a, b) => b.size - a.size)
      .map((c, i) => ({ ...c, fill: corSequencialEscura(i) }));
  }, [tarefas]);
  const clienteLider = porCliente[0];
  const pctClienteLider =
    clienteLider && total > 0 ? Math.round((clienteLider.size / total) * 100) : 0;

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

  // Custo por entrega: divide o custo fixo mensal de cada pessoa/fornecedor
  // pelas missões que ela concluiu no mês escolhido. `mesesComEntrega` sempre
  // inclui o mês corrente, então `meses[0]` nunca é undefined e o seletor não
  // precisa de estado inicial calculado por efeito.
  const meses = useMemo(() => mesesComEntrega(tarefas), [tarefas]);
  const [mesEscolhido, setMesEscolhido] = useState("");
  const mesCusto = meses.includes(mesEscolhido) ? mesEscolhido : meses[0];
  const custosPorEntrega = useMemo(
    () => custoPorEntregaNoMes(tarefas, usuarios, mesCusto),
    [tarefas, usuarios, mesCusto]
  );
  const custoFixoTotal = custosPorEntrega.reduce((soma, c) => soma + c.custoMensal, 0);
  const lucro = useMemo(
    () => lucroPorClienteNoMes(tarefas, clientesCadastrados, usuarios, mesCusto),
    [tarefas, clientesCadastrados, usuarios, mesCusto]
  );

  const [gerandoResumoExecutivo, setGerandoResumoExecutivo] = useState(false);
  const [resumoExecutivo, setResumoExecutivo] = useState("");
  const [erroResumoExecutivo, setErroResumoExecutivo] = useState("");

  async function gerarResumo() {
    setGerandoResumoExecutivo(true);
    setErroResumoExecutivo("");
    try {
      const texto = await gerarResumoExecutivo({
        mesReferencia: formatMes(mesCusto),
        total,
        taxaConclusao: taxaConclusaoGlobal,
        emAndamento: emAndamentoGlobal,
        emRisco: emRiscoGlobal,
        carga: carga.map((c) => ({ nome: c.nome, qtd: c.qtd, sobrecarregada: c.sobrecarregada })),
        custosPorEntrega: custosPorEntrega.map((c) => ({
          nome: c.nome,
          custoPorEntrega: c.custoPorEntrega,
          entregas: c.entregas,
        })),
        lucroPorCliente: lucro.porCliente.map((c) => ({
          nome: c.nome,
          margem: c.margem,
          entregas: c.entregas,
        })),
        resultadoDoMes: lucro.resultado,
        clienteLider: clienteLider
          ? { nome: clienteLider.name, pctMissoes: pctClienteLider }
          : undefined,
      });
      setResumoExecutivo(texto);
    } catch (erro) {
      setErroResumoExecutivo(erro instanceof Error ? erro.message : "Erro ao gerar o resumo.");
    } finally {
      setGerandoResumoExecutivo(false);
    }
  }

  function exportarRelatorio() {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Indicador: "Total de missões", Valor: total },
        { Indicador: "Taxa de conclusão (%)", Valor: taxaConclusaoGlobal },
        { Indicador: "Em andamento", Valor: emAndamentoGlobal },
        { Indicador: "Ajustes / risco", Valor: emRiscoGlobal },
      ]),
      "Resumo"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        porStatus.map((s) => ({ Status: s.status, Quantidade: s.qtd, "%": s.pct }))
      ),
      "Por status"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        carga.map((c) => ({
          Nome: c.nome,
          "Missões ativas": c.qtd,
          Sobrecarregada: c.sobrecarregada ? "Sim" : "Não",
        }))
      ),
      "Carga por pessoa"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        custosPorEntrega.map((c) => ({
          Nome: c.nome,
          Vínculo: ROTULO_VINCULO[c.vinculo],
          "Custo mensal (R$)": c.custoMensal,
          Entregas: c.entregas,
          "Custo por entrega (R$)": c.custoPorEntrega ?? "",
        }))
      ),
      `Custo por entrega ${mesCusto}`.slice(0, 31)
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        lucro.porCliente.map((c) => ({
          Cliente: c.nome,
          "Receita mensal (R$)": c.receita ?? "",
          "Custo direto (R$)": c.custoDireto,
          "Custo rateado (R$)": c.custoRateado,
          "Custo total (R$)": c.custoTotal,
          "Margem (R$)": c.margem ?? "",
          "Margem (%)": c.margemPercentual ?? "",
          Entregas: c.entregas,
        }))
      ),
      `Lucro por cliente ${mesCusto}`.slice(0, 31)
    );

    XLSX.writeFile(wb, `performance-ousadia-${mesCusto}.xlsx`);
  }

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

  const classeSelect =
    "h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-slate-100 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30";

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-slate-950 p-4 text-slate-100 sm:p-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={gerarResumo}
          disabled={gerandoResumoExecutivo}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {gerandoResumoExecutivo ? "Gerando..." : "✨ Resumo executivo com IA"}
        </button>
        <button
          type="button"
          onClick={exportarRelatorio}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-orange-500 hover:text-white"
        >
          ⬇ Exportar relatório (.xlsx)
        </button>
      </div>

      {erroResumoExecutivo && (
        <p className="text-xs text-rose-400">{erroResumoExecutivo}</p>
      )}
      {resumoExecutivo && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-orange-400">
            Resumo executivo · {formatMes(mesCusto)}
          </p>
          <p className="text-sm leading-relaxed text-slate-200">{resumoExecutivo}</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiTile
          rotulo="Total de missões"
          valor={String(total)}
          detalhe="Volume registrado"
        />
        <KpiTile
          rotulo="Taxa de conclusão"
          valor={`${taxaConclusaoGlobal}%`}
          detalhe={`${concluidasGlobal} de ${total} entregues`}
          cor="#10B981"
          anelPercentual={taxaConclusaoGlobal}
        />
        <KpiTile
          rotulo="Em produção"
          valor={String(emAndamentoGlobal)}
          detalhe="Missões em andamento"
          cor="#F97316"
          anelPercentual={total > 0 ? Math.round((emAndamentoGlobal / total) * 100) : 0}
        />
        <KpiTile
          rotulo="Ajustes / risco"
          valor={String(emRiscoGlobal)}
          detalhe={emRiscoGlobal > 0 ? "Atenção imediata" : "Nada em retrabalho"}
          cor={emRiscoGlobal > 0 ? "#F43F5E" : "#64748b"}
          alerta={emRiscoGlobal > 0}
        />
      </div>

      {/* Donut de status + carga empilhada */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CardPainel titulo="Missões por status" legenda="Distribuição atual">
          {total === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma missão registrada.</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative h-[180px] w-[180px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusComVolume}
                      dataKey="qtd"
                      nameKey="status"
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={2}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {statusComVolume.map((s) => (
                        <Cell key={s.status} fill={s.cor} />
                      ))}
                    </Pie>
                    <Tooltip content={TooltipEscuro} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-white">{total}</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    missões
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <LegendaStatus
                  itens={statusComVolume.map((s) => ({
                    rotulo: s.status,
                    cor: s.cor,
                    valor: s.qtd,
                    pct: s.pct,
                  }))}
                />
                {statusZerados.length > 0 && (
                  <p className="mt-3 border-t border-slate-800 pt-2 text-[11px] leading-relaxed text-slate-600">
                    Sem volume: {statusZerados.map((s) => s.status).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardPainel>

        <CardPainel titulo="Carga por pessoa" legenda="Missões ativas por status">
          {carga.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma missão ativa no momento.</p>
          ) : (
            <div className="min-w-0">
              <ResponsiveContainer width="100%" height={Math.max(140, carga.length * 44)}>
                <BarChart data={cargaEmpilhada} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={96}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={TooltipEscuro} cursor={{ fill: "#1e293b80" }} />
                  {statusAtivosComVolume.map((s, i) => (
                    <Bar
                      key={s}
                      dataKey={s}
                      stackId="carga"
                      fill={corGraficoEscuro(s)}
                      barSize={18}
                      isAnimationActive={false}
                      radius={
                        i === statusAtivosComVolume.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-800 pt-2">
                {statusAtivosComVolume.map((s) => (
                  <span key={s} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: corGraficoEscuro(s) }}
                    />
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {carga
                  .filter((c) => c.sobrecarregada)
                  .map((c) => (
                    <p key={c.nome} className="flex items-center gap-2 text-[11px] text-rose-400">
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[9px] font-bold ${corResponsavel(
                          c.nome
                        )}`}
                      >
                        {iniciais(c.nome)}
                      </span>
                      {c.nome} está acima da média do time ({c.qtd} ativas)
                    </p>
                  ))}
              </div>
            </div>
          )}
        </CardPainel>
      </div>

      {/* Concentração por cliente */}
      <CardPainel
        titulo="Concentração por cliente"
        legenda={
          clienteLider ? `${clienteLider.name} = ${pctClienteLider}% das missões` : undefined
        }
      >
        {porCliente.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum cliente com missões.</p>
        ) : (
          <div className="min-w-0">
            <ResponsiveContainer width="100%" height={150}>
              <Treemap
                data={porCliente}
                dataKey="size"
                nameKey="name"
                stroke="#0f172a"
                nodeGap={2}
                isAnimationActive={false}
              >
                <Tooltip content={TooltipEscuro} />
              </Treemap>
            </ResponsiveContainer>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 pt-2">
              {porCliente.map((c) => (
                <li key={c.name} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: c.fill }}
                  />
                  <span className="text-slate-300">{c.name}</span>
                  <span className="tabular-nums text-slate-500">
                    {c.size} · {c.horas}h
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardPainel>

      {/* Custo por entrega — transforma um custo fixo abstrato em preço unitário */}
      <CardPainel>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-300">
              Custo por entrega
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Custo fixo do mês dividido pelas missões concluídas — é o número que diz se um
              pacote fechado está valendo a pena.
            </p>
          </div>
          <select
            value={mesCusto}
            onChange={(e) => setMesEscolhido(e.target.value)}
            aria-label="Mês de referência do custo"
            className={classeSelect}
          >
            {meses.map((m) => (
              <option key={m} value={m}>
                {formatMes(m)}
              </option>
            ))}
          </select>
        </div>

        {custosPorEntrega.length === 0 ? (
          <p className="text-sm leading-relaxed text-slate-500">
            Nenhum custo fixo cadastrado ainda. Clique no seu nome no topo da página para abrir{" "}
            <strong className="font-semibold text-slate-300">Time e custos</strong> e informe o
            vínculo e o valor mensal de cada fornecedor ou contratado.
          </p>
        ) : (
          <div className="space-y-2">
            {custosPorEntrega.map((c) => (
              <div
                key={c.nome}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                  c.custoPorEntrega === null
                    ? "border-rose-500/40 bg-rose-500/5"
                    : "border-slate-800 bg-slate-950/60"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${corResponsavel(
                      c.nome
                    )}`}
                  >
                    {iniciais(c.nome)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">
                      {c.nome}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {ROTULO_VINCULO[c.vinculo]} · {formatBRL(c.custoMensal)}/mês
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {c.custoPorEntrega === null ? (
                    <>
                      <span className="block text-sm font-bold text-rose-400">
                        Nenhuma entrega
                      </span>
                      <span className="block text-[11px] text-rose-400/80">
                        {formatBRL(c.custoMensal)} correram sem contrapartida
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block text-xl font-bold tabular-nums text-white">
                        {formatBRL(c.custoPorEntrega)}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        por entrega · {c.entregas} {c.entregas === 1 ? "missão" : "missões"}
                      </span>
                    </>
                  )}
                </span>
              </div>
            ))}
            <p className="border-t border-slate-800 pt-2 text-[11px] leading-relaxed text-slate-500">
              Custo fixo total no mês:{" "}
              <span className="font-semibold text-slate-300">{formatBRL(custoFixoTotal)}</span>.
              Quem é pago por projeto não entra aqui — o custo dessa pessoa é por entrega, e ainda
              não tem onde ser lançado.
            </p>
          </div>
        )}
      </CardPainel>

      {/* Lucro por cliente — margem de contribuição, mesmo mês do card acima */}
      <CardPainel>
        <div className="mb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-300">
              Lucro por cliente
            </h3>
            <span className="text-[11px] font-medium text-slate-500">
              Margem de contribuição · {formatMes(mesCusto)}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Receita mensal menos os custos diretos do mês: o pacote fixo rateado pelas entregas
            mais o que foi pago por missão. Não desconta o tempo de quem não emite nota, então
            não é o lucro final — é o quanto o cliente paga além do que custa atender.
          </p>
        </div>

        {lucro.porCliente.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum cliente cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {lucro.porCliente.map((c) => {
              const negativa = c.margem !== null && c.margem < 0;
              return (
                <div
                  key={c.clienteId}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                    negativa
                      ? "border-rose-500/40 bg-rose-500/5"
                      : "border-slate-800 bg-slate-950/60"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">
                      {c.nome}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {c.receita !== null ? `${formatBRL(c.receita)}/mês` : "Sem valor mensal"} ·{" "}
                      {c.entregas} {c.entregas === 1 ? "entrega" : "entregas"} ·{" "}
                      {formatBRL(c.custoTotal)} de custo
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {c.margem === null ? (
                      <span className="block text-[11px] text-slate-500">
                        Cadastre o valor mensal em Projetos
                      </span>
                    ) : (
                      <>
                        <span
                          className={`block text-xl font-bold tabular-nums ${
                            negativa ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          {formatBRL(c.margem)}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {negativa ? "prejuízo" : "margem"}
                          {c.margemPercentual !== null ? ` · ${c.margemPercentual}%` : ""}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              );
            })}

            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-800 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Resultado do mês
              </span>
              <span
                className={`text-lg font-bold tabular-nums ${
                  lucro.resultado < 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {formatBRL(lucro.resultado)}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              O que sobra depois dos custos diretos do mês — é deste valor que sai a remuneração
              de quem é pago por divisão de resultado.
              {lucro.clientesSemReceita > 0
                ? ` Está subestimado: ${lucro.clientesSemReceita} cliente${
                    lucro.clientesSemReceita === 1 ? "" : "s"
                  } sem valor mensal cadastrado ficaram de fora.`
                : ""}
            </p>

            {(lucro.custoOcioso > 0 || lucro.custoSemCliente > 0) && (
              <div className="space-y-1 border-t border-slate-800 pt-2">
                {lucro.custoOcioso > 0 && (
                  <p className="text-[11px] leading-relaxed text-amber-400">
                    ⚠ {formatBRL(lucro.custoOcioso)} de custo fixo não entraram em nenhum cliente:
                    quem recebe esse valor não concluiu nenhuma missão no mês.
                  </p>
                )}
                {lucro.custoSemCliente > 0 && (
                  <p className="text-[11px] leading-relaxed text-amber-400">
                    ⚠ {formatBRL(lucro.custoSemCliente)} vieram de entregas sem cliente definido e
                    ficaram fora do rateio.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardPainel>

      {/* Relatório detalhado */}
      <CardPainel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-sans text-sm font-bold text-white">
            Relatório por {visao === "cliente" ? "cliente" : "colaborador"}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-800 p-1">
              {(["cliente", "colaborador"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={visao === v}
                  onClick={() => setVisao(v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    visao === v
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {v === "cliente" ? "🏢 Por cliente" : "👤 Por colaborador"}
                </button>
              ))}
            </div>

            {visao === "cliente" ? (
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className={classeSelect}
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
                className={classeSelect}
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
          <p className="mt-3 text-sm text-slate-400">
            Escolha um cliente para ver o que foi feito, o que falta, esforço estimado e quem
            esteve envolvido.
          </p>
        )}
        {visao === "colaborador" && !colaboradorNome && (
          <p className="mt-3 text-sm text-slate-400">
            Escolha um colaborador para ver entregas, confiabilidade e carga — sempre comparado
            com a média do time.
          </p>
        )}
      </CardPainel>

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

      <p className="rounded-xl border border-dashed border-slate-800 px-4 py-4 text-center text-xs text-slate-500">
        Falta para fechar a conta de lucro: o valor combinado por projeto de quem é pago por
        entrega, as horas reais de cada missão e a receita mensal por cliente.
      </p>
    </div>
  );
}
