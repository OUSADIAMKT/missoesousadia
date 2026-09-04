"use client";

import { PRIORIDADES, type Cliente, type Projeto, type Usuario } from "@/lib/types";

interface FiltrosProps {
  clientes: Cliente[];
  projetos: Projeto[];
  usuarios: Usuario[];
  clienteId: string;
  projetoId: string;
  quem: string;
  prioridade: string;
  busca: string;
  onClienteIdChange: (v: string) => void;
  onProjetoIdChange: (v: string) => void;
  onQuemChange: (v: string) => void;
  onPrioridadeChange: (v: string) => void;
  onBuscaChange: (v: string) => void;
}

export function Filtros({
  clientes,
  projetos,
  usuarios,
  clienteId,
  projetoId,
  quem,
  prioridade,
  busca,
  onClienteIdChange,
  onProjetoIdChange,
  onQuemChange,
  onPrioridadeChange,
  onBuscaChange,
}: FiltrosProps) {
  const projetosDoCliente = clienteId ? projetos.filter((p) => p.clienteId === clienteId) : projetos;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={busca}
        onChange={(e) => onBuscaChange(e.target.value)}
        placeholder="Buscar por título..."
        className="w-48 rounded-sm border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />

      <select
        value={clienteId}
        onChange={(e) => {
          onClienteIdChange(e.target.value);
          onProjetoIdChange("");
        }}
        className="rounded-sm border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <option value="">Todos os clientes</option>
        {[...clientes]
          .sort((a, b) => a.nome.localeCompare(b.nome))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
      </select>

      <select
        value={projetoId}
        onChange={(e) => onProjetoIdChange(e.target.value)}
        className="rounded-sm border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <option value="">Todos os projetos</option>
        {[...projetosDoCliente]
          .sort((a, b) => a.nome.localeCompare(b.nome))
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
      </select>

      <select
        value={quem}
        onChange={(e) => onQuemChange(e.target.value)}
        className="rounded-sm border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <option value="">Todo o time</option>
        {usuarios.map((u) => (
          <option key={u.id} value={u.nome}>
            {u.nome}
          </option>
        ))}
      </select>

      <select
        value={prioridade}
        onChange={(e) => onPrioridadeChange(e.target.value)}
        className="rounded-sm border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <option value="">Toda prioridade</option>
        {PRIORIDADES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      {(clienteId || projetoId || quem || prioridade || busca) && (
        <button
          onClick={() => {
            onClienteIdChange("");
            onProjetoIdChange("");
            onQuemChange("");
            onPrioridadeChange("");
            onBuscaChange("");
          }}
          className="text-sm font-medium text-muted hover:text-danger"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
