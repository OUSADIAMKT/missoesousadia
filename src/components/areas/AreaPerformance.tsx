"use client";

import { useMemo, useState } from "react";
import { STATUSES, type TarefaComContexto } from "@/lib/types";
import { corResponsavel, corStatus, iniciais } from "@/lib/utils";
import { RelatorioCliente } from "./RelatorioCliente";

interface AreaPerformanceProps {
  tarefas: TarefaComContexto[];
}

interface CargaPessoa {
  nome: string;
  qtd: number;
  sobrecarregada: boolean;
}

// Missões "Aprovado"/"Concluído" não pesam na carga — o trabalho ativo nelas já
// acabou, mesma régua usada por isAtrasada/isProximaDoPrazo em utils.ts.
function calcularCargaPorPessoa(tarefas: TarefaComContexto[]): CargaPessoa[] {
  const contagem = new Map<string, number>();
  for (const t of tarefas) {
    if (t.status === "Concluído" || t.status === "Aprovado") continue;
    contagem.set(t.quem, (contagem.get(t.quem) ?? 0) + 1);
  }
  const entradas = Array.from(contagem.entries()).map(([nome, qtd]) => ({ nome, qtd }));
  const media =
    entradas.length > 0 ? entradas.reduce((soma, e) => soma + e.qtd, 0) / entradas.length : 0;
  return entradas
    .map((e) => ({ ...e, sobrecarregada: e.qtd >= 3 && e.qtd >= media * 1.5 }))
    .sort((a, b) => b.qtd - a.qtd);
}

export function AreaPerformance({ tarefas }: AreaPerformanceProps) {
  const total = tarefas.length;
  const cargaPorPessoa = calcularCargaPorPessoa(tarefas);
  const maiorCarga = cargaPorPessoa[0]?.qtd ?? 0;

  const clientes = useMemo(() => {
    const porId = new Map<string, string>();
    for (const t of tarefas) {
      if (t.cliente) porId.set(t.cliente.id, t.cliente.nome);
    }
    return Array.from(porId, ([id, nome]) => ({ id, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );
  }, [tarefas]);

  const [clienteId, setClienteId] = useState("");
  const clienteSelecionado = clientes.find((c) => c.id === clienteId);
  const tarefasDoCliente = useMemo(
    () => tarefas.filter((t) => t.cliente?.id === clienteId),
    [tarefas, clienteId]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-sm border border-border bg-surface p-4">
        <h2 className="font-display text-lg font-semibold text-brand-dark">Carga por pessoa</h2>
        <p className="mb-4 mt-1 text-xs text-muted">
          Missões ativas (fora &quot;Aprovado&quot;/&quot;Concluído&quot;) por responsável — quem
          está bem acima da média do time é sinalizado.
        </p>
        {cargaPorPessoa.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma missão ativa no momento.</p>
        ) : (
          <div className="space-y-2">
            {cargaPorPessoa.map(({ nome, qtd, sobrecarregada }) => (
              <div key={nome} className="flex items-center gap-3 text-sm">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold ${corResponsavel(
                    nome
                  )}`}
                >
                  {iniciais(nome)}
                </span>
                <span className="w-28 shrink-0 truncate text-foreground">{nome}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className={`h-full rounded-full ${sobrecarregada ? "bg-danger" : "bg-brand"}`}
                    style={{ width: `${maiorCarga > 0 ? Math.round((qtd / maiorCarga) * 100) : 0}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs text-muted">{qtd}</span>
                {sobrecarregada && (
                  <span className="shrink-0 rounded-sm border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                    sobrecarregada
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-sm border border-border bg-surface p-4">
        <h2 className="font-display text-lg font-semibold text-brand-dark">
          Missões por status
        </h2>
        <div className="mt-4 space-y-2">
          {STATUSES.map((status) => {
            const qtd = tarefas.filter((t) => t.status === status).length;
            const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
            return (
              <div key={status} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 text-muted">{status}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className={`h-full rounded-full ${corStatus(status).split(" ")[0]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs text-muted">{qtd}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-sm border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Relatório por cliente
          </h2>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="rounded-sm border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Selecione um cliente...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        {!clienteSelecionado && (
          <p className="mt-3 text-sm text-muted">
            Escolha um cliente para ver o que foi feito, o que falta, esforço estimado e quem
            esteve envolvido.
          </p>
        )}
      </div>

      {clienteSelecionado && (
        <RelatorioCliente clienteNome={clienteSelecionado.nome} tarefas={tarefasDoCliente} />
      )}

      <p className="rounded-sm border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
        Custo por atividade e rentabilidade em R$ chegam quando tivermos valor de hora por pessoa e
        apontamento de horas reais.
      </p>
    </div>
  );
}
