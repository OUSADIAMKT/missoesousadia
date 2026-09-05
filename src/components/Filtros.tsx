"use client";

import { PRIORIDADES, type Cliente, type Projeto, type Usuario } from "@/lib/types";

interface FiltrosProps {
  clientes: Cliente[];
  projetos: Projeto[];
  usuarios: Usuario[];
  usuarioAtual: string;
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
  usuarioAtual,
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
  const minhasTarefasAtivo = !!usuarioAtual && quem === usuarioAtual;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        >
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Buscar por título..."
          className="h-9 w-48 rounded-sm border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <select
        value={clienteId}
        onChange={(e) => {
          onClienteIdChange(e.target.value);
          onProjetoIdChange("");
        }}
        className="h-9 rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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
        className="h-9 rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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
        className="h-9 rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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
        className="h-9 rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <option value="">Toda prioridade</option>
        {PRIORIDADES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      {usuarioAtual && (
        <button
          type="button"
          aria-pressed={minhasTarefasAtivo}
          onClick={() => onQuemChange(minhasTarefasAtivo ? "" : usuarioAtual)}
          className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${
            minhasTarefasAtivo
              ? "border-brand bg-brand/10 text-brand-dark"
              : "border-border bg-surface text-muted hover:text-foreground"
          }`}
        >
          👤 Minhas tarefas
        </button>
      )}

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
