"use client";

import { TarefaCard } from "@/components/TarefaCard";
import type { Status, TarefaComContexto } from "@/lib/types";
import { isAtrasada, isProximaDoPrazo } from "@/lib/utils";

interface AreaHojeProps {
  tarefas: TarefaComContexto[];
  usuarioAtual: string;
  onSelecionar: (tarefa: TarefaComContexto) => void;
  onMoverStatus: (id: string, status: Status) => void;
}

interface SecaoProps {
  titulo: string;
  descricao: string;
  tarefas: TarefaComContexto[];
  onSelecionar: (tarefa: TarefaComContexto) => void;
  onMoverStatus: (id: string, status: Status) => void;
  tom?: "danger" | "accent" | "brand";
}

function Secao({ titulo, descricao, tarefas, onSelecionar, onMoverStatus, tom = "brand" }: SecaoProps) {
  const corTitulo =
    tom === "danger" ? "text-danger" : tom === "accent" ? "text-accent" : "text-brand-dark";

  return (
    <section>
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className={`font-display text-lg font-semibold ${corTitulo}`}>{titulo}</h2>
        <span className="text-sm text-muted">
          {tarefas.length} {tarefas.length === 1 ? "missão" : "missões"}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted">{descricao}</p>
      {tarefas.length === 0 ? (
        <p className="rounded-sm border border-dashed border-border bg-surface px-4 py-6 text-center text-xs text-muted">
          Nada por aqui — tudo em dia.
        </p>
      ) : (
        <div className="grid grid-flow-col auto-cols-[240px] gap-3 overflow-x-auto pb-2">
          {tarefas.map((t) => (
            <TarefaCard
              key={t.id}
              tarefa={t}
              onClick={() => onSelecionar(t)}
              onMudarStatus={(s) => onMoverStatus(t.id, s)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function AreaHoje({ tarefas, usuarioAtual, onSelecionar, onMoverStatus }: AreaHojeProps) {
  const atrasadas = tarefas.filter((t) => isAtrasada(t.prazoEntrega, t.status));
  const bloqueadas = tarefas.filter((t) => t.bloqueios.some((b) => !b.resolvidoEm));
  const prazoProximo = tarefas.filter((t) => isProximaDoPrazo(t.prazoEntrega, t.status));
  const minhaAcao = usuarioAtual
    ? tarefas.filter(
        (t) =>
          t.quem === usuarioAtual &&
          (t.status === "Ajustes Solicitados" ||
            isAtrasada(t.prazoEntrega, t.status) ||
            isProximaDoPrazo(t.prazoEntrega, t.status))
      )
    : [];

  return (
    <div className="flex flex-col gap-8">
      {usuarioAtual && (
        <Secao
          titulo="Aguardando sua ação"
          descricao={`Missões de ${usuarioAtual} com ajuste pedido pelo cliente ou prazo apertado.`}
          tarefas={minhaAcao}
          onSelecionar={onSelecionar}
          onMoverStatus={onMoverStatus}
          tom="brand"
        />
      )}
      <Secao
        titulo="Atrasadas"
        descricao="Passaram do prazo de entrega e ainda não foram concluídas."
        tarefas={atrasadas}
        onSelecionar={onSelecionar}
        onMoverStatus={onMoverStatus}
        tom="danger"
      />
      <Secao
        titulo="Bloqueadas"
        descricao="Têm pelo menos um bloqueio ativo impedindo o andamento."
        tarefas={bloqueadas}
        onSelecionar={onSelecionar}
        onMoverStatus={onMoverStatus}
        tom="danger"
      />
      <Secao
        titulo="Prazo próximo"
        descricao="Vencem nos próximos 2 dias."
        tarefas={prazoProximo}
        onSelecionar={onSelecionar}
        onMoverStatus={onMoverStatus}
        tom="accent"
      />
    </div>
  );
}
