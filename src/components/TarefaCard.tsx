"use client";

import { useState } from "react";
import { STATUSES, type Status, type TarefaComContexto } from "@/lib/types";
import {
  corPrioridade,
  corResponsavel,
  corStatus,
  formatDateBR,
  iniciais,
  isAtrasada,
  isProximaDoPrazo,
} from "@/lib/utils";

interface TarefaCardProps {
  tarefa: TarefaComContexto;
  onClick: () => void;
  onMudarStatus: (status: Status) => void;
}

export function TarefaCard({ tarefa, onClick, onMudarStatus }: TarefaCardProps) {
  const [arrastando, setArrastando] = useState(false);
  const atrasada = isAtrasada(tarefa.prazoEntrega, tarefa.status);
  const proxima = isProximaDoPrazo(tarefa.prazoEntrega, tarefa.status);
  const bloqueiosAtivos = tarefa.bloqueios.filter((b) => !b.resolvidoEm);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", tarefa.id);
        e.dataTransfer.effectAllowed = "move";
        setArrastando(true);
      }}
      onDragEnd={() => setArrastando(false)}
      className={`w-full cursor-grab rounded-sm border bg-surface p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${
        bloqueiosAtivos.length > 0 ? "border-danger/40" : "border-border"
      } ${arrastando ? "opacity-40" : "opacity-100"}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="inline-block rounded-sm bg-accent-soft px-2 py-0.5 text-xs font-medium text-brand-dark">
          {tarefa.cliente?.nome ?? "Sem cliente"}
          {tarefa.projeto && tarefa.projeto.nome !== "Geral" ? ` · ${tarefa.projeto.nome}` : ""}
        </span>
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold ${corResponsavel(
            tarefa.quem
          )}`}
          title={tarefa.quem}
        >
          {iniciais(tarefa.quem)}
        </span>
      </div>

      <h3 className="mb-1 text-sm font-semibold leading-snug text-foreground">
        {tarefa.titulo}
      </h3>

      {tarefa.descricao && (
        <p className="mb-2 line-clamp-2 text-xs text-muted">{tarefa.descricao}</p>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-1">
        <span
          className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${corPrioridade(
            tarefa.prioridade
          )}`}
        >
          {tarefa.prioridade}
        </span>
        {bloqueiosAtivos.length > 0 && (
          <span
            className="rounded-sm border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger"
            title={bloqueiosAtivos.map((b) => b.motivo).join(" · ")}
          >
            🚫 {bloqueiosAtivos.length} bloqueio{bloqueiosAtivos.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted">Registro {formatDateBR(tarefa.dataRegistro)}</span>
        <span
          className={
            atrasada
              ? "font-semibold text-danger"
              : proxima
              ? "font-semibold text-accent"
              : "text-muted"
          }
        >
          {atrasada ? "Atrasada · " : proxima ? "Prazo próximo · " : "Prazo "}
          {formatDateBR(tarefa.prazoEntrega)}
        </span>
      </div>

      <select
        value={tarefa.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onMudarStatus(e.target.value as Status)}
        className={`w-full cursor-pointer rounded-md border px-2 py-1 text-[11px] font-semibold ${corStatus(
          tarefa.status
        )}`}
        title="Mudar status rapidamente"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
