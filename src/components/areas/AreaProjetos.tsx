"use client";

import { useState } from "react";
import type { Cliente, Projeto, TarefaComContexto } from "@/lib/types";
import { formatBRL, isAtrasada } from "@/lib/utils";

interface AreaProjetosProps {
  clientes: Cliente[];
  projetos: Projeto[];
  tarefas: TarefaComContexto[];
  onAdicionarCliente: (nome: string, valorMensal?: number) => void;
  onAtualizarCliente: (id: string, dados: Partial<Omit<Cliente, "id">>) => Promise<boolean>;
  onRemoverCliente: (id: string) => Promise<boolean>;
  onAdicionarProjeto: (clienteId: string, nome: string) => void;
  onRemoverProjeto: (id: string) => Promise<boolean>;
  onVerMissoesDoProjeto: (projetoId: string) => void;
  onNotificarErro: (mensagem: string) => void;
}

export function AreaProjetos({
  clientes,
  projetos,
  tarefas,
  onAdicionarCliente,
  onAtualizarCliente,
  onRemoverCliente,
  onAdicionarProjeto,
  onRemoverProjeto,
  onVerMissoesDoProjeto,
  onNotificarErro,
}: AreaProjetosProps) {
  const [novoCliente, setNovoCliente] = useState("");
  const [novoProjetoPorCliente, setNovoProjetoPorCliente] = useState<Record<string, string>>({});

  function contarMissoes(projetoId: string) {
    const doProjeto = tarefas.filter((t) => t.projetoId === projetoId);
    const atrasadas = doProjeto.filter((t) => isAtrasada(t.prazoEntrega, t.status)).length;
    return { total: doProjeto.length, atrasadas };
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!novoCliente.trim()) return;
          onAdicionarCliente(novoCliente);
          setNovoCliente("");
        }}
        className="flex gap-2"
      >
        <input
          value={novoCliente}
          onChange={(e) => setNovoCliente(e.target.value)}
          placeholder="Nome do novo cliente"
          className="w-64 rounded-sm border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          className="rounded-sm bg-brand px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90"
        >
          + Novo cliente
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[...clientes]
          .sort((a, b) => a.nome.localeCompare(b.nome))
          .map((cliente) => {
            const projetosDoCliente = projetos.filter((p) => p.clienteId === cliente.id);
            return (
              <div key={cliente.id} className="rounded-sm border border-border bg-surface p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold text-brand-dark">
                    {cliente.nome}
                  </h3>
                  <button
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Remover o cliente "${cliente.nome}"? Isso também remove os projetos dele. Missões vinculadas impedem a remoção.`
                        )
                      )
                        return;
                      const ok = await onRemoverCliente(cliente.id);
                      if (!ok)
                        onNotificarErro(
                          "Não foi possível remover o cliente — confira se ainda há missões vinculadas a algum projeto dele."
                        );
                    }}
                    className="text-xs font-medium text-muted hover:text-danger"
                  >
                    Remover
                  </button>
                </div>

                <label className="mb-3 block text-xs text-muted">
                  Valor mensal
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={cliente.valorMensal ?? ""}
                    onBlur={async (e) => {
                      const ok = await onAtualizarCliente(cliente.id, {
                        valorMensal: e.target.value ? Number(e.target.value) : undefined,
                      });
                      if (!ok) onNotificarErro("Não foi possível salvar o valor mensal.");
                    }}
                    placeholder="0,00"
                    className="mt-1 block w-full rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  {typeof cliente.valorMensal === "number" && (
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {formatBRL(cliente.valorMensal)}/mês
                    </span>
                  )}
                </label>

                <ul className="space-y-1.5">
                  {projetosDoCliente.map((projeto) => {
                    const { total, atrasadas } = contarMissoes(projeto.id);
                    return (
                      <li
                        key={projeto.id}
                        className="flex items-center justify-between rounded-sm border border-border px-2.5 py-1.5 text-sm"
                      >
                        <button
                          onClick={() => onVerMissoesDoProjeto(projeto.id)}
                          className="text-left font-medium text-foreground hover:text-brand"
                        >
                          {projeto.nome}
                        </button>
                        <span className="flex items-center gap-2 text-xs text-muted">
                          {total} missõe{total === 1 ? "" : "s"}
                          {atrasadas > 0 && (
                            <span className="font-semibold text-danger">
                              · {atrasadas} atrasada{atrasadas === 1 ? "" : "s"}
                            </span>
                          )}
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Remover o projeto "${projeto.nome}"?`)) return;
                              const ok = await onRemoverProjeto(projeto.id);
                              if (!ok)
                                onNotificarErro(
                                  "Não foi possível remover o projeto — confira se ainda há missões vinculadas a ele."
                                );
                            }}
                            className="text-muted hover:text-danger"
                            title="Remover projeto"
                          >
                            ✕
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const nome = novoProjetoPorCliente[cliente.id]?.trim();
                    if (!nome) return;
                    onAdicionarProjeto(cliente.id, nome);
                    setNovoProjetoPorCliente((prev) => ({ ...prev, [cliente.id]: "" }));
                  }}
                  className="mt-2 flex gap-2"
                >
                  <input
                    value={novoProjetoPorCliente[cliente.id] ?? ""}
                    onChange={(e) =>
                      setNovoProjetoPorCliente((prev) => ({ ...prev, [cliente.id]: e.target.value }))
                    }
                    placeholder="Novo projeto"
                    className="flex-1 rounded-sm border border-border bg-background px-2 py-1 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <button
                    type="submit"
                    className="rounded-sm border border-border px-2 py-1 text-xs font-medium text-foreground transition hover:bg-background"
                  >
                    Adicionar
                  </button>
                </form>
              </div>
            );
          })}
      </div>
    </div>
  );
}
