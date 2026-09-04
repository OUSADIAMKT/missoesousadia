"use client";

import { useState } from "react";
import { STATUSES, type Status, type TarefaComContexto } from "@/lib/types";
import { corStatus } from "@/lib/utils";
import { TarefaCard } from "./TarefaCard";

interface KanbanBoardProps {
  tarefas: TarefaComContexto[];
  onSelecionar: (tarefa: TarefaComContexto) => void;
  onMoverStatus: (id: string, status: Status) => void;
}

export function KanbanBoard({ tarefas, onSelecionar, onMoverStatus }: KanbanBoardProps) {
  const [colunaAlvo, setColunaAlvo] = useState<Status | null>(null);

  return (
    <div className="grid grid-flow-col auto-cols-[240px] gap-4 overflow-x-auto pb-4">
      {STATUSES.map((status) => {
        const doStatus = tarefas.filter((t) => t.status === status);
        const emFoco = colunaAlvo === status;
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (colunaAlvo !== status) setColunaAlvo(status);
            }}
            onDragLeave={() => setColunaAlvo((atual) => (atual === status ? null : atual))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) onMoverStatus(id, status);
              setColunaAlvo(null);
            }}
            className={`flex min-w-[260px] flex-col rounded-sm p-2 transition ${
              emFoco ? "bg-brand/10 ring-2 ring-brand/40" : "bg-surface-alt"
            }`}
          >
            <div
              className={`mb-3 flex items-center justify-between rounded-sm border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${corStatus(
                status
              )}`}
            >
              <span>{status}</span>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px]">
                {doStatus.length}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              {doStatus.length === 0 && (
                <p className="rounded-sm border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
                  {emFoco ? "Solte aqui" : "Sem missões aqui"}
                </p>
              )}
              {doStatus.map((tarefa) => (
                <TarefaCard
                  key={tarefa.id}
                  tarefa={tarefa}
                  onClick={() => onSelecionar(tarefa)}
                  onMudarStatus={(novoStatus) => onMoverStatus(tarefa.id, novoStatus)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
