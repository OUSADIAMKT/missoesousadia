"use client";

import { useEffect, useRef, useState } from "react";
import {
  COMPLEXIDADES,
  PRIORIDADES,
  STATUSES,
  type Cliente,
  type Complexidade,
  type NovaTarefa,
  type Prioridade,
  type Projeto,
  type Status,
  type TarefaComContexto,
  type Usuario,
} from "@/lib/types";
import { corResponsavel, formatDateBR, formatDateTimeBR, iniciais } from "@/lib/utils";

interface TarefaFormProps {
  aberto: boolean;
  tarefaEmEdicao: TarefaComContexto | null;
  usuarios: Usuario[];
  clientes: Cliente[];
  projetos: Projeto[];
  onFechar: () => void;
  onSalvar: (dados: NovaTarefa) => Promise<boolean>;
  onExcluir: (id: string) => Promise<boolean>;
  onEncontrarOuCriarProjeto: (nomeCliente: string, nomeProjeto?: string) => Promise<string>;
  onAdicionarBloqueio: (tarefaId: string, motivo: string) => void;
  onResolverBloqueio: (tarefaId: string, bloqueioId: string) => void;
}

interface FormState {
  titulo: string;
  clienteNome: string;
  projetoNome: string;
  descricao: string;
  dataInicio: string;
  prazoEntrega: string;
  prioridade: Prioridade;
  complexidade: Complexidade;
  horasEstimadas: string;
  custoExecucao: string;
  status: Status;
  quem: string;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function valorInicial(usuarios: Usuario[]): FormState {
  return {
    titulo: "",
    clienteNome: "",
    projetoNome: "Geral",
    descricao: "",
    dataInicio: hoje(),
    prazoEntrega: "",
    prioridade: "Normal",
    complexidade: "Simples",
    horasEstimadas: "",
    custoExecucao: "",
    status: "A Fazer",
    quem: usuarios[0]?.nome ?? "",
  };
}

function valorDeEdicao(tarefa: TarefaComContexto): FormState {
  return {
    titulo: tarefa.titulo,
    clienteNome: tarefa.cliente?.nome ?? "",
    projetoNome: tarefa.projeto?.nome ?? "Geral",
    descricao: tarefa.descricao,
    dataInicio: tarefa.dataInicio,
    prazoEntrega: tarefa.prazoEntrega,
    prioridade: tarefa.prioridade,
    complexidade: tarefa.complexidade,
    horasEstimadas: tarefa.horasEstimadas ? String(tarefa.horasEstimadas) : "",
    custoExecucao: tarefa.custoExecucao !== undefined ? String(tarefa.custoExecucao) : "",
    status: tarefa.status,
    quem: tarefa.quem,
  };
}

export function TarefaForm({
  aberto,
  tarefaEmEdicao,
  usuarios,
  clientes,
  projetos,
  onFechar,
  onSalvar,
  onExcluir,
  onEncontrarOuCriarProjeto,
  onAdicionarBloqueio,
  onResolverBloqueio,
}: TarefaFormProps) {
  const [dados, setDados] = useState<FormState>(() => valorInicial(usuarios));
  const [novoBloqueio, setNovoBloqueio] = useState("");
  const [erroSalvar, setErroSalvar] = useState("");
  const tituloRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Ressincroniza o formulário sempre que o modal abre ou troca de tarefa em edição —
    // não é reação a mudança de estado interno, é o próprio gatilho de abertura.
    // Depende só do id (não do objeto tarefaEmEdicao inteiro) para não resincronizar —
    // e apagar o que a pessoa está digitando — toda vez que outra tarefa muda via Realtime.
    if (tarefaEmEdicao) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDados(valorDeEdicao(tarefaEmEdicao));
    } else {
      setDados(valorInicial(usuarios));
    }
    setNovoBloqueio("");
    setErroSalvar("");
    if (aberto) tituloRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefaEmEdicao?.id, aberto]);

  useEffect(() => {
    if (!aberto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const projetosDoCliente = projetos.filter(
    (p) => clientes.find((c) => c.id === p.clienteId)?.nome === dados.clienteNome
  );

  // Custo por missão só aparece para quem é pago por entrega. Para quem tem
  // custo fixo mensal, o valor já é rateado pelas entregas do mês — lançar de
  // novo aqui contaria a mesma despesa duas vezes.
  const responsavel = usuarios.find((u) => u.nome === dados.quem);
  const pagoPorProjeto = responsavel?.vinculo === "por_projeto";

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!dados.titulo.trim() || !dados.clienteNome.trim() || !dados.prazoEntrega) return;
    const projetoId = await onEncontrarOuCriarProjeto(dados.clienteNome, dados.projetoNome || "Geral");
    const sucesso = await onSalvar({
      titulo: dados.titulo,
      projetoId,
      descricao: dados.descricao,
      dataInicio: dados.dataInicio,
      prazoEntrega: dados.prazoEntrega,
      prioridade: dados.prioridade,
      complexidade: dados.complexidade,
      horasEstimadas: dados.horasEstimadas ? Number(dados.horasEstimadas) : undefined,
      // Trocar o responsável para alguém de custo fixo limpa o valor: senão ele
      // continuaria contando no relatório sem aparecer mais no formulário.
      custoExecucao:
        pagoPorProjeto && dados.custoExecucao ? Number(dados.custoExecucao) : undefined,
      status: dados.status,
      quem: dados.quem,
      bloqueios: tarefaEmEdicao?.bloqueios ?? [],
    });
    if (sucesso) {
      onFechar();
    } else {
      setErroSalvar("Não foi possível salvar. Tente novamente.");
    }
  }

  function adicionarBloqueio(e: React.FormEvent) {
    e.preventDefault();
    if (!tarefaEmEdicao || !novoBloqueio.trim()) return;
    onAdicionarBloqueio(tarefaEmEdicao.id, novoBloqueio);
    setNovoBloqueio("");
  }

  async function excluir() {
    if (!tarefaEmEdicao) return;
    if (
      !window.confirm(
        "Tem certeza que deseja excluir esta missão? Essa ação não pode ser desfeita."
      )
    )
      return;
    const sucesso = await onExcluir(tarefaEmEdicao.id);
    if (sucesso) {
      onFechar();
    } else {
      setErroSalvar("Não foi possível excluir. Tente novamente.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tarefa-form-titulo"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-dark/40 px-4 py-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-sm border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="tarefa-form-titulo" className="font-display text-xl font-semibold text-brand-dark">
            {tarefaEmEdicao ? "Editar missão" : "Nova missão"}
          </h2>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-full p-1 text-muted hover:bg-background hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submeter} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Título</label>
            <input
              ref={tituloRef}
              required
              value={dados.titulo}
              onChange={(e) => setDados((d) => ({ ...d, titulo: e.target.value }))}
              placeholder="Ex: Roteiro reels linha Protetor Solar"
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Cliente</label>
              <input
                required
                list="clientes-sugeridos"
                value={dados.clienteNome}
                onChange={(e) =>
                  setDados((d) => ({ ...d, clienteNome: e.target.value, projetoNome: "Geral" }))
                }
                placeholder="Ekilibre, FLIX..."
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <datalist id="clientes-sugeridos">
                {clientes.map((c) => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Projeto</label>
              <input
                list="projetos-sugeridos"
                value={dados.projetoNome}
                onChange={(e) => setDados((d) => ({ ...d, projetoNome: e.target.value }))}
                placeholder="Geral"
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <datalist id="projetos-sugeridos">
                {projetosDoCliente.map((p) => (
                  <option key={p.id} value={p.nome} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Data início
              </label>
              <input
                type="date"
                value={dados.dataInicio}
                onChange={(e) => setDados((d) => ({ ...d, dataInicio: e.target.value }))}
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Prazo de entrega
              </label>
              <input
                required
                type="date"
                value={dados.prazoEntrega}
                onChange={(e) => setDados((d) => ({ ...d, prazoEntrega: e.target.value }))}
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Descrição</label>
            <textarea
              value={dados.descricao}
              onChange={(e) => setDados((d) => ({ ...d, descricao: e.target.value }))}
              rows={3}
              placeholder="Detalhes da missão..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Prioridade
              </label>
              <select
                value={dados.prioridade}
                onChange={(e) =>
                  setDados((d) => ({ ...d, prioridade: e.target.value as Prioridade }))
                }
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Complexidade
              </label>
              <select
                value={dados.complexidade}
                onChange={(e) =>
                  setDados((d) => ({ ...d, complexidade: e.target.value as Complexidade }))
                }
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {COMPLEXIDADES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Status</label>
              <select
                value={dados.status}
                onChange={(e) =>
                  setDados((d) => ({ ...d, status: e.target.value as Status }))
                }
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Quem</label>
              <select
                value={dados.quem}
                onChange={(e) => setDados((d) => ({ ...d, quem: e.target.value }))}
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {usuarios.map((u) => (
                  <option key={u.id} value={u.nome}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Horas estimadas <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={dados.horasEstimadas}
              onChange={(e) => setDados((d) => ({ ...d, horasEstimadas: e.target.value }))}
              placeholder="Ex: 4"
              className="w-32 rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {pagoPorProjeto && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Custo desta missão <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={dados.custoExecucao}
                onChange={(e) => setDados((d) => ({ ...d, custoExecucao: e.target.value }))}
                placeholder="Ex: 800"
                className="w-32 rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <p className="mt-1 text-xs text-muted">
                Quanto será pago a {dados.quem} por esta entrega. Entra no lucro do cliente
                quando a missão for concluída.
              </p>
            </div>
          )}

          {tarefaEmEdicao && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Bloqueios
              </p>
              {tarefaEmEdicao.bloqueios.length > 0 && (
                <ul className="mb-2 space-y-1.5">
                  {tarefaEmEdicao.bloqueios.map((b) => (
                    <li
                      key={b.id}
                      className={`flex items-start justify-between gap-2 rounded-sm border px-2.5 py-1.5 text-xs ${
                        b.resolvidoEm
                          ? "border-border text-muted line-through"
                          : "border-danger/30 bg-danger/5 text-foreground"
                      }`}
                    >
                      <span>
                        {b.motivo}
                        <span className="block text-muted no-underline">
                          {b.criadoPor} · {formatDateTimeBR(b.criadoEm)}
                        </span>
                      </span>
                      {!b.resolvidoEm && (
                        <button
                          type="button"
                          onClick={() => onResolverBloqueio(tarefaEmEdicao.id, b.id)}
                          className="shrink-0 text-xs font-medium text-brand hover:underline"
                        >
                          Resolver
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  value={novoBloqueio}
                  onChange={(e) => setNovoBloqueio(e.target.value)}
                  placeholder="Motivo do bloqueio..."
                  className="flex-1 rounded-sm border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={adicionarBloqueio}
                  className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-background"
                >
                  Bloquear
                </button>
              </div>
            </div>
          )}

          {tarefaEmEdicao && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Histórico de status · registrada em {formatDateBR(tarefaEmEdicao.dataRegistro)}
              </p>
              <ol className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {(tarefaEmEdicao.historico ?? []).map((h) => (
                  <li key={h.id} className="flex items-start gap-2 text-xs">
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[9px] font-semibold ${corResponsavel(
                        h.usuario
                      )}`}
                    >
                      {iniciais(h.usuario)}
                    </span>
                    <span className="text-foreground">
                      <strong>{h.usuario}</strong>{" "}
                      {h.statusAnterior ? (
                        <>
                          mudou de <em>{h.statusAnterior}</em> para{" "}
                          <em>{h.statusNovo}</em>
                        </>
                      ) : (
                        <>
                          criou a missão como <em>{h.statusNovo}</em>
                        </>
                      )}
                      <span className="block text-muted">{formatDateTimeBR(h.data)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {erroSalvar && <p className="text-sm text-danger">{erroSalvar}</p>}

          <div className="flex items-center justify-between border-t border-border pt-4">
            {tarefaEmEdicao ? (
              <button
                type="button"
                onClick={excluir}
                className="text-sm font-medium text-danger hover:underline"
              >
                Excluir missão
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onFechar}
                className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-background"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-sm bg-brand px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90"
              >
                {tarefaEmEdicao ? "Salvar alterações" : "Criar missão"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
