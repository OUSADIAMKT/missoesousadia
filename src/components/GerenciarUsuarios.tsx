"use client";

import { useEffect, useState } from "react";
import type { Usuario } from "@/lib/types";
import { corResponsavel, iniciais } from "@/lib/utils";

interface GerenciarUsuariosProps {
  aberto: boolean;
  usuarios: Usuario[];
  usuarioAtual: string;
  emailLogado: string | null;
  souAdmin: boolean;
  onFechar: () => void;
  onAdicionar: (nome: string, email: string) => Promise<boolean>;
  onRemover: (id: string) => Promise<boolean>;
  onSair: () => void;
  onNotificarErro: (mensagem: string) => void;
}

export function GerenciarUsuarios({
  aberto,
  usuarios,
  usuarioAtual,
  emailLogado,
  souAdmin,
  onFechar,
  onAdicionar,
  onRemover,
  onSair,
  onNotificarErro,
}: GerenciarUsuariosProps) {
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");

  useEffect(() => {
    if (!aberto) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim() || !novoEmail.trim()) return;
    const ok = await onAdicionar(novoNome, novoEmail);
    if (!ok) {
      onNotificarErro("Não foi possível adicionar — confira se o e-mail já não está cadastrado.");
      return;
    }
    setNovoNome("");
    setNovoEmail("");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gerenciar-usuarios-titulo"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-dark/40 px-4 py-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-sm border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="gerenciar-usuarios-titulo" className="font-display text-xl font-semibold text-brand-dark">Acesso do time</h2>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-full p-1 text-muted hover:bg-background hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex items-center justify-between rounded-sm border border-border bg-background px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold ${corResponsavel(
                  usuarioAtual
                )}`}
              >
                {iniciais(usuarioAtual)}
              </span>
              <span>
                Você é <strong>{usuarioAtual}</strong>
                {emailLogado && <span className="block text-xs text-muted">{emailLogado}</span>}
              </span>
            </span>
            <button
              onClick={onSair}
              className="text-sm font-medium text-danger hover:underline"
            >
              Sair
            </button>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-foreground">Quem tem acesso</p>
            <p className="mb-3 text-xs text-muted">
              Só quem está nesta lista consegue entrar com o Google — o login usa este e-mail
              para saber quem é quem.
            </p>
            <ul className="space-y-1.5">
              {usuarios.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded-sm border border-border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold ${corResponsavel(
                        u.nome
                      )}`}
                    >
                      {iniciais(u.nome)}
                    </span>
                    <span>
                      {u.nome}
                      <span className="block text-xs text-muted">{u.email}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {u.papel === "admin" && (
                      <span className="rounded-sm border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                        admin
                      </span>
                    )}
                    {u.email.toLowerCase() === (emailLogado ?? "").toLowerCase() ? (
                      <span className="text-xs text-muted">você</span>
                    ) : (
                      souAdmin && (
                        <button
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Remover o acesso de ${u.nome}? A pessoa não vai mais conseguir entrar com essa conta Google.`
                              )
                            )
                              return;
                            const ok = await onRemover(u.id);
                            if (!ok)
                              onNotificarErro("Não foi possível remover o acesso. Tente novamente.");
                          }}
                          className="text-xs font-medium text-muted hover:text-danger"
                        >
                          Remover
                        </button>
                      )
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {souAdmin ? (
              <form onSubmit={adicionar} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Nome"
                  className="flex-1 rounded-sm border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <input
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  placeholder="email@gmail.com"
                  type="email"
                  className="flex-1 rounded-sm border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="submit"
                  className="rounded-sm bg-brand px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90"
                >
                  Adicionar
                </button>
              </form>
            ) : (
              <p className="mt-3 text-xs text-muted">
                Só administradores podem adicionar ou remover acesso do time.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
