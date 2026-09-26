"use client";

import { useState } from "react";
import { CalendarioMissoes } from "@/components/CalendarioMissoes";
import { Filtros } from "@/components/Filtros";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { Cliente, Projeto, Status, TarefaComContexto, Usuario } from "@/lib/types";

type VisaoMissoes = "kanban" | "calendario";

interface AreaMissoesProps {
  tarefas: TarefaComContexto[];
  clientes: Cliente[];
  projetos: Projeto[];
  usuarios: Usuario[];
  usuarioAtual: string;
  tagsDisponiveis: string[];
  clienteId: string;
  projetoId: string;
  quem: string;
  prioridade: string;
  tag: string;
  busca: string;
  onClienteIdChange: (v: string) => void;
  onProjetoIdChange: (v: string) => void;
  onQuemChange: (v: string) => void;
  onPrioridadeChange: (v: string) => void;
  onTagChange: (v: string) => void;
  onBuscaChange: (v: string) => void;
  onSelecionar: (tarefa: TarefaComContexto) => void;
  onMoverStatus: (id: string, status: Status) => void;
}

export function AreaMissoes({
  tarefas,
  clientes,
  projetos,
  usuarios,
  usuarioAtual,
  tagsDisponiveis,
  clienteId,
  projetoId,
  quem,
  prioridade,
  tag,
  busca,
  onClienteIdChange,
  onProjetoIdChange,
  onQuemChange,
  onPrioridadeChange,
  onTagChange,
  onBuscaChange,
  onSelecionar,
  onMoverStatus,
}: AreaMissoesProps) {
  const [visao, setVisao] = useState<VisaoMissoes>("kanban");

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1">
          {(["kanban", "calendario"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={visao === v}
              onClick={() => setVisao(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                visao === v ? "bg-brand/10 text-brand-dark" : "text-muted hover:text-foreground"
              }`}
            >
              {v === "kanban" ? "📋 Kanban" : "🗓️ Calendário"}
            </button>
          ))}
        </div>
      </div>

      <Filtros
        clientes={clientes}
        projetos={projetos}
        usuarios={usuarios}
        usuarioAtual={usuarioAtual}
        tagsDisponiveis={tagsDisponiveis}
        clienteId={clienteId}
        projetoId={projetoId}
        quem={quem}
        prioridade={prioridade}
        tag={tag}
        busca={busca}
        onClienteIdChange={onClienteIdChange}
        onProjetoIdChange={onProjetoIdChange}
        onQuemChange={onQuemChange}
        onPrioridadeChange={onPrioridadeChange}
        onTagChange={onTagChange}
        onBuscaChange={onBuscaChange}
      />

      {tarefas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-muted">
          Nenhuma missão encontrada com esses filtros.
        </p>
      ) : visao === "kanban" ? (
        <KanbanBoard tarefas={tarefas} onSelecionar={onSelecionar} onMoverStatus={onMoverStatus} />
      ) : (
        <CalendarioMissoes tarefas={tarefas} onSelecionar={onSelecionar} />
      )}
    </div>
  );
}
