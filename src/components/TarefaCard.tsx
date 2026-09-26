"use client";

import { useEffect, useRef, useState } from "react";
import { STATUSES, type Status, type TarefaComContexto } from "@/lib/types";
import {
  corPrazo,
  corPrioridade,
  corResponsavel,
  corStatus,
  faseValidacao,
  formatDateBR,
  iniciais,
  isAtrasada,
  isProximaDoPrazo,
} from "@/lib/utils";

interface TarefaCardProps {
  tarefa: TarefaComContexto;
  onClick: () => void;
  onMudarStatus: (status: Status) => void;
  // true só quando renderizado dentro da coluna consolidada "Validação & Gargalos"
  // do Kanban — mostra de qual das 3 travas o card está, sem poluir outras áreas
  // (ex.: Hoje) que reusam este mesmo componente.
  mostrarFaseValidacao?: boolean;
}

export function TarefaCard({
  tarefa,
  onClick,
  onMudarStatus,
  mostrarFaseValidacao = false,
}: TarefaCardProps) {
  const [arrastando, setArrastando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const atrasada = isAtrasada(tarefa.prazoEntrega, tarefa.status);
  const proxima = isProximaDoPrazo(tarefa.prazoEntrega, tarefa.status);
  const bloqueiosAtivos = tarefa.bloqueios.filter((b) => !b.resolvidoEm);
  const fase = mostrarFaseValidacao ? faseValidacao(tarefa.status) : null;

  useEffect(() => {
    if (!menuAberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [menuAberto]);

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
      className={`w-full cursor-grab rounded-xl border bg-white p-3 text-left shadow-sm transition-shadow duration-200 hover:shadow-md active:cursor-grabbing ${
        bloqueiosAtivos.length > 0 ? "border-danger/40" : "border-neutral-200/80"
      } ${arrastando ? "opacity-40" : "opacity-100"}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="inline-block rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-brand-dark">
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

      <h3 className="mb-1 font-sans text-sm font-semibold leading-snug text-foreground">
        {tarefa.titulo}
      </h3>

      {tarefa.descricao && (
        <p className="mb-2 line-clamp-2 text-xs text-muted">{tarefa.descricao}</p>
      )}

      {tarefa.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {tarefa.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] font-medium text-muted"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {fase && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${fase.classe}`}
            >
              {fase.rotulo}
            </span>
          )}
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${corPrioridade(
              tarefa.prioridade
            )}`}
          >
            {tarefa.prioridade}
          </span>
          {bloqueiosAtivos.length > 0 && (
            <span
              className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger"
              title={bloqueiosAtivos.map((b) => b.motivo).join(" · ")}
            >
              🚫 {bloqueiosAtivos.length} bloqueio{bloqueiosAtivos.length === 1 ? "" : "s"}
            </span>
          )}
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${corPrazo(
              atrasada,
              proxima
            )}`}
          >
            📅 {atrasada ? "Atrasada · " : proxima ? "Prazo próximo · " : "Prazo "}
            {formatDateBR(tarefa.prazoEntrega)}
          </span>
        </div>

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuAberto}
            aria-label="Mudar status"
            title="Mudar status"
            onClick={(e) => {
              e.stopPropagation();
              setMenuAberto((v) => !v);
            }}
            className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-neutral-100 hover:text-foreground"
          >
            ⋯
          </button>
          {menuAberto && (
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-7 z-10 w-44 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
            >
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitemradio"
                  aria-checked={s === tarefa.status}
                  onClick={() => {
                    onMudarStatus(s);
                    setMenuAberto(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-neutral-50 ${
                    s === tarefa.status ? "font-semibold text-foreground" : "text-muted"
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full border ${corStatus(s)}`} />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
