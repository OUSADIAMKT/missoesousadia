"use client";

import { useEffect, useState } from "react";
import {
  ROTULO_VINCULO,
  VINCULOS,
  VINCULOS_CUSTO_FIXO,
  type Usuario,
  type Vinculo,
} from "@/lib/types";
import { corResponsavel, formatBRL, iniciais } from "@/lib/utils";

export interface CamposDeCusto {
  vinculo: Vinculo | null;
  custoMensal?: number;
  horasMensais?: number;
}

interface GerenciarUsuariosProps {
  aberto: boolean;
  usuarios: Usuario[];
  usuarioAtual: string;
  emailLogado: string | null;
  souAdmin: boolean;
  onFechar: () => void;
  onAdicionar: (nome: string, email: string, vinculo: Vinculo | null) => Promise<boolean>;
  onAtualizar: (id: string, campos: CamposDeCusto) => Promise<boolean>;
  onRemover: (id: string) => Promise<boolean>;
  onSair: () => void;
  onNotificarErro: (mensagem: string) => void;
}

const classeCampo =
  "w-full rounded-sm border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

// Converte o texto de um <input type="number"> para número, tratando vazio como
// "não informado" — `Number("")` é 0, que aqui significaria custo zero de verdade.
function numeroOuIndefinido(texto: string): number | undefined {
  const limpo = texto.trim();
  if (!limpo) return undefined;
  const valor = Number(limpo);
  return Number.isFinite(valor) && valor >= 0 ? valor : undefined;
}

function mesmoEmail(a: string | null, b: string | null): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

export function GerenciarUsuarios({
  aberto,
  usuarios,
  usuarioAtual,
  emailLogado,
  souAdmin,
  onFechar,
  onAdicionar,
  onAtualizar,
  onRemover,
  onSair,
  onNotificarErro,
}: GerenciarUsuariosProps) {
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novoVinculo, setNovoVinculo] = useState<Vinculo | "">("");

  // Edição de vínculo/custo abre uma linha por vez — o modal é estreito e a
  // ação é rara (cadastro, não uso diário).
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<{
    vinculo: Vinculo | "";
    custoMensal: string;
    horasMensais: string;
  }>({ vinculo: "", custoMensal: "", horasMensais: "" });

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
    if (!novoNome.trim()) return;
    const ok = await onAdicionar(novoNome, novoEmail, novoVinculo || null);
    if (!ok) {
      onNotificarErro("Não foi possível adicionar — confira se o e-mail já não está cadastrado.");
      return;
    }
    setNovoNome("");
    setNovoEmail("");
    setNovoVinculo("");
  }

  function abrirEdicao(u: Usuario) {
    setEditandoId(u.id);
    setRascunho({
      vinculo: u.vinculo ?? "",
      custoMensal: u.custoMensal !== undefined ? String(u.custoMensal) : "",
      horasMensais: u.horasMensais !== undefined ? String(u.horasMensais) : "",
    });
  }

  async function salvarEdicao(id: string) {
    const vinculo = rascunho.vinculo || null;
    // Custo mensal só faz sentido em vínculo de custo fixo — se a pessoa mudou
    // para "por projeto", o valor antigo é descartado em vez de ficar contando
    // silenciosamente no relatório.
    const aceitaCustoFixo = vinculo !== null && VINCULOS_CUSTO_FIXO.includes(vinculo);
    const ok = await onAtualizar(id, {
      vinculo,
      custoMensal: aceitaCustoFixo ? numeroOuIndefinido(rascunho.custoMensal) : undefined,
      horasMensais: aceitaCustoFixo ? numeroOuIndefinido(rascunho.horasMensais) : undefined,
    });
    if (!ok) {
      onNotificarErro("Não foi possível salvar o vínculo e o custo. Tente novamente.");
      return;
    }
    setEditandoId(null);
  }

  const rascunhoAceitaCustoFixo =
    !!rascunho.vinculo && VINCULOS_CUSTO_FIXO.includes(rascunho.vinculo);
  const custoRascunho = numeroOuIndefinido(rascunho.custoMensal);
  const horasRascunho = numeroOuIndefinido(rascunho.horasMensais);
  const custoHoraRascunho =
    custoRascunho !== undefined && horasRascunho !== undefined && horasRascunho > 0
      ? custoRascunho / horasRascunho
      : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gerenciar-usuarios-titulo"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-dark/40 px-4 py-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-sm border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2
            id="gerenciar-usuarios-titulo"
            className="font-display text-xl font-semibold text-brand-dark"
          >
            Time e custos
          </h2>
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
            <button onClick={onSair} className="text-sm font-medium text-danger hover:underline">
              Sair
            </button>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-foreground">Quem executa missões</p>
            <p className="mb-3 text-xs text-muted">
              Todo mundo desta lista aparece no campo &quot;quem&quot; das missões. Só quem tem
              e-mail cadastrado consegue entrar com o Google — um fornecedor sem e-mail trabalha e
              entra nos relatórios, mas não acessa o sistema.
            </p>
            <ul className="space-y-1.5">
              {usuarios.map((u) => {
                const ehVoce = mesmoEmail(u.email, emailLogado);
                const editando = editandoId === u.id;
                return (
                  <li key={u.id} className="rounded-sm border border-border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold ${corResponsavel(
                            u.nome
                          )}`}
                        >
                          {iniciais(u.nome)}
                        </span>
                        <span className="min-w-0">
                          {u.nome}
                          <span className="block truncate text-xs text-muted">
                            {u.email ?? "Sem acesso ao sistema"}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {u.papel === "admin" && (
                          <span className="rounded-sm border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                            admin
                          </span>
                        )}
                        {u.vinculo ? (
                          <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted">
                            {ROTULO_VINCULO[u.vinculo]}
                          </span>
                        ) : (
                          <span
                            title="Sem vínculo, esta pessoa fica de fora dos relatórios de custo."
                            className="rounded-sm border border-danger/30 px-1.5 py-0.5 text-[10px] font-medium text-danger"
                          >
                            sem vínculo
                          </span>
                        )}
                        {souAdmin && (
                          <button
                            onClick={() => (editando ? setEditandoId(null) : abrirEdicao(u))}
                            aria-expanded={editando}
                            className="text-xs font-medium text-muted hover:text-brand"
                          >
                            {editando ? "Cancelar" : "Custo"}
                          </button>
                        )}
                        {ehVoce ? (
                          <span className="text-xs text-muted">você</span>
                        ) : (
                          souAdmin && (
                            <button
                              onClick={async () => {
                                const aviso = u.email
                                  ? `Remover ${u.nome} do time? A pessoa some do campo "quem" das novas missões e não vai mais conseguir entrar com essa conta Google.`
                                  : `Remover ${u.nome} do time? A pessoa some do campo "quem" das novas missões.`;
                                if (!window.confirm(aviso)) return;
                                const ok = await onRemover(u.id);
                                if (!ok)
                                  onNotificarErro("Não foi possível remover. Tente novamente.");
                              }}
                              className="text-xs font-medium text-muted hover:text-danger"
                            >
                              Remover
                            </button>
                          )
                        )}
                      </span>
                    </div>

                    {u.custoMensal !== undefined && !editando && (
                      <p className="mt-1.5 pl-8 text-xs text-muted">
                        {formatBRL(u.custoMensal)}/mês
                        {u.horasMensais
                          ? ` · ${formatBRL(u.custoMensal / u.horasMensais)}/hora (${u.horasMensais}h)`
                          : ""}
                      </p>
                    )}

                    {editando && (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        <label className="block text-xs font-medium text-foreground">
                          Vínculo
                          <select
                            value={rascunho.vinculo}
                            onChange={(e) =>
                              setRascunho((r) => ({ ...r, vinculo: e.target.value as Vinculo | "" }))
                            }
                            className={`mt-1 ${classeCampo}`}
                          >
                            <option value="">Sem vínculo definido</option>
                            {VINCULOS.map((v) => (
                              <option key={v} value={v}>
                                {ROTULO_VINCULO[v]}
                              </option>
                            ))}
                          </select>
                        </label>

                        {rascunhoAceitaCustoFixo ? (
                          <>
                            <div className="flex gap-2">
                              <label className="block flex-1 text-xs font-medium text-foreground">
                                Custo mensal (R$)
                                <input
                                  value={rascunho.custoMensal}
                                  onChange={(e) =>
                                    setRascunho((r) => ({ ...r, custoMensal: e.target.value }))
                                  }
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="3000"
                                  className={`mt-1 ${classeCampo}`}
                                />
                              </label>
                              <label className="block flex-1 text-xs font-medium text-foreground">
                                Horas por mês
                                <input
                                  value={rascunho.horasMensais}
                                  onChange={(e) =>
                                    setRascunho((r) => ({ ...r, horasMensais: e.target.value }))
                                  }
                                  type="number"
                                  min="1"
                                  step="1"
                                  placeholder="160"
                                  className={`mt-1 ${classeCampo}`}
                                />
                              </label>
                            </div>
                            <p className="text-xs text-muted">
                              {custoHoraRascunho !== undefined
                                ? `Custo por hora: ${formatBRL(custoHoraRascunho)}`
                                : "Preencha os dois para ver o custo por hora."}
                            </p>
                          </>
                        ) : rascunho.vinculo === "por_projeto" ? (
                          <p className="text-xs text-muted">
                            Quem é pago por projeto não tem custo mensal — o valor combinado de
                            cada entrega ainda não tem onde ser lançado.
                          </p>
                        ) : (
                          <p className="text-xs text-muted">
                            Sem vínculo, esta pessoa fica de fora dos relatórios de custo.
                          </p>
                        )}

                        <button
                          onClick={() => salvarEdicao(u.id)}
                          className="rounded-sm bg-brand px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90"
                        >
                          Salvar
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {souAdmin ? (
              <form onSubmit={adicionar} className="mt-3 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Nome"
                    className={classeCampo}
                  />
                  <input
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    placeholder="email@gmail.com (opcional)"
                    type="email"
                    className={classeCampo}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={novoVinculo}
                    onChange={(e) => setNovoVinculo(e.target.value as Vinculo | "")}
                    className={classeCampo}
                  >
                    <option value="">Vínculo (definir depois)</option>
                    {VINCULOS.map((v) => (
                      <option key={v} value={v}>
                        {ROTULO_VINCULO[v]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="shrink-0 rounded-sm bg-brand px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90"
                  >
                    Adicionar
                  </button>
                </div>
                <p className="text-xs text-muted">
                  Deixe o e-mail em branco para cadastrar quem executa sem dar acesso ao sistema.
                </p>
              </form>
            ) : (
              <p className="mt-3 text-xs text-muted">
                Só administradores podem adicionar pessoas ou mexer em custos.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
