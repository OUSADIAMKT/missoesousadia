"use client";

import { useState } from "react";
import type { Status, TarefaComContexto } from "@/lib/types";
import { corStatus } from "@/lib/utils";
import { TarefaCard } from "./TarefaCard";

interface KanbanBoardProps {
  tarefas: TarefaComContexto[];
  onSelecionar: (tarefa: TarefaComContexto) => void;
  onMoverStatus: (id: string, status: Status) => void;
}

interface ColunaKanban {
  chave: string;
  titulo: string;
  subtitulo?: string;
  // Quais dos 7 status do domínio aparecem agrupados nesta coluna visual.
  statuses: Status[];
  // Status aplicado quando um card de outra coluna é solto aqui diretamente.
  statusPadrao: Status;
}

// Consolida os 7 status do fluxo em 4 colunas visuais — elimina o scroll lateral
// e agrupa os 3 status de "trava" (revisão/cliente/ajustes) numa única coluna de
// gargalos, com o card mostrando a fase exata via `mostrarFaseValidacao`.
const COLUNAS_KANBAN: ColunaKanban[] = [
  { chave: "a-fazer", titulo: "A Fazer", statuses: ["A Fazer"], statusPadrao: "A Fazer" },
  {
    chave: "em-andamento",
    titulo: "Em Andamento",
    statuses: ["Em Andamento"],
    statusPadrao: "Em Andamento",
  },
  {
    chave: "validacao",
    titulo: "Validação & Gargalos",
    subtitulo: "Em Revisão · Cliente · Ajustes",
    statuses: ["Em Revisão", "Aguardando Cliente", "Ajustes Solicitados"],
    statusPadrao: "Em Revisão",
  },
  {
    chave: "concluido",
    titulo: "Concluído",
    statuses: ["Aprovado", "Concluído"],
    statusPadrao: "Concluído",
  },
];

export function KanbanBoard({ tarefas, onSelecionar, onMoverStatus }: KanbanBoardProps) {
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);

  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUNAS_KANBAN.map((coluna) => {
        const doColuna = tarefas.filter((t) => coluna.statuses.includes(t.status));
        const emFoco = colunaAlvo === coluna.chave;
        return (
          <div
            key={coluna.chave}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (colunaAlvo !== coluna.chave) setColunaAlvo(coluna.chave);
            }}
            onDragLeave={() => setColunaAlvo((atual) => (atual === coluna.chave ? null : atual))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              const tarefaArrastada = tarefas.find((t) => t.id === id);
              // Se o card já pertence a um dos status desta coluna (ex.: já está em
              // "Aguardando Cliente" dentro de Validação & Gargalos), soltar de novo
              // no mesmo agrupamento não deve rebaixar para o status padrão.
              if (tarefaArrastada && !coluna.statuses.includes(tarefaArrastada.status)) {
                onMoverStatus(tarefaArrastada.id, coluna.statusPadrao);
              }
              setColunaAlvo(null);
            }}
            className={`flex flex-col rounded-2xl p-3 transition ${
              emFoco ? "bg-brand/10 ring-2 ring-brand/40" : "bg-slate-50"
            }`}
          >
            <div className="mb-3 flex flex-col gap-0.5 px-1 pt-1">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full border ${corStatus(
                    coluna.statusPadrao
                  )}`}
                />
                <span className="flex-1 text-[12px] font-bold uppercase tracking-wider text-neutral-500">
                  {coluna.titulo}
                </span>
                <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                  {doColuna.length}
                </span>
              </div>
              {coluna.subtitulo && (
                <span className="pl-4 text-[10px] font-medium text-neutral-400">
                  {coluna.subtitulo}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2">
              {doColuna.length === 0 &&
                (emFoco ? (
                  <p className="min-h-[80px] rounded-xl border border-dashed border-neutral-300 px-3 py-6 text-center text-xs text-muted">
                    Solte aqui
                  </p>
                ) : (
                  <p className="px-3 py-4 text-center text-xs text-neutral-400">
                    Sem missões aqui
                  </p>
                ))}
              {doColuna.map((tarefa) => (
                <TarefaCard
                  key={tarefa.id}
                  tarefa={tarefa}
                  onClick={() => onSelecionar(tarefa)}
                  onMudarStatus={(novoStatus) => onMoverStatus(tarefa.id, novoStatus)}
                  mostrarFaseValidacao={coluna.chave === "validacao"}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
