"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Status } from "@/lib/types";
import { corStatus, formatDateBR, formatTamanhoArquivo } from "@/lib/utils";

// Página pública (sem login — ver src/proxy.ts) que um cliente da Ousadia
// abre pelo link único dele (/aprovar/<token>, gerado em AreaProjetos.tsx).
// Só fala com o Supabase via 3 funções RPC (aprovacao_cliente/aprovacao_missoes/
// aprovacao_responder, ver supabase/schema.sql) que validam o token no banco —
// nunca lê/escreve tabela direto, então nunca depende de RLS de sessão.

interface MissaoAprovacao {
  id: string;
  titulo: string;
  descricao: string;
  prazo_entrega: string;
  status: string;
  tags: string[];
  projeto_nome: string;
}

interface AnexoAprovacao {
  id: string;
  nome: string;
  caminho: string;
  tamanho: number | null;
  tipo: string | null;
}

type EstadoCliente = "carregando" | "invalido" | "ok";

export default function AprovarPage(props: PageProps<"/aprovar/[token]">) {
  const { token } = use(props.params);

  const [estadoCliente, setEstadoCliente] = useState<EstadoCliente>("carregando");
  const [nomeCliente, setNomeCliente] = useState("");
  const [missoes, setMissoes] = useState<MissaoAprovacao[]>([]);

  const [ajusteAbertoId, setAjusteAbertoId] = useState<string | null>(null);
  const [motivoAjuste, setMotivoAjuste] = useState("");
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState("");
  const [ultimaConfirmacao, setUltimaConfirmacao] = useState("");

  const [anexosPorMissao, setAnexosPorMissao] = useState<Record<string, AnexoAprovacao[]>>({});
  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const anexosBuscadosRef = useRef<Set<string>>(new Set());

  const buscarMissoes = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("aprovacao_missoes", { p_token: token });
    if (!error && data) setMissoes(data as MissaoAprovacao[]);
  }, [token]);

  // Anexos só das missões aguardando aprovação — é onde o cliente precisa
  // ver o arquivo pra decidir. `anexosBuscadosRef` evita rebuscar a mesma
  // missão a cada re-render (aprovar/pedir ajuste refaz `missoes`).
  useEffect(() => {
    const aguardandoIds = missoes
      .filter((m) => m.status === "Aguardando Cliente")
      .map((m) => m.id);
    const faltando = aguardandoIds.filter((id) => !anexosBuscadosRef.current.has(id));
    if (faltando.length === 0) return;
    faltando.forEach((id) => anexosBuscadosRef.current.add(id));

    let ativo = true;
    (async () => {
      const supabase = createClient();
      const resultados = await Promise.all(
        faltando.map(async (id) => {
          const { data } = await supabase.rpc("aprovacao_anexos", {
            p_token: token,
            p_tarefa_id: id,
          });
          return [id, (data as AnexoAprovacao[] | null) ?? []] as const;
        })
      );
      if (!ativo) return;
      setAnexosPorMissao((atual) => {
        const novo = { ...atual };
        for (const [id, lista] of resultados) novo[id] = lista;
        return novo;
      });
    })();
    return () => {
      ativo = false;
    };
  }, [missoes, token]);

  async function baixarAnexo(missaoId: string, anexo: AnexoAprovacao) {
    setBaixandoId(anexo.id);
    setErroAcao("");
    try {
      const resposta = await fetch("/api/aprovacao/anexo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, tarefaId: missaoId, anexoId: anexo.id }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErroAcao(dados?.erro ?? "Não foi possível baixar o arquivo.");
        return;
      }
      window.open(dados.url, "_blank", "noopener,noreferrer");
    } catch {
      setErroAcao("Não foi possível baixar o arquivo.");
    } finally {
      setBaixandoId(null);
    }
  }

  useEffect(() => {
    let ativo = true;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("aprovacao_cliente", { p_token: token });
      if (!ativo) return;
      if (error || !data || data.length === 0) {
        setEstadoCliente("invalido");
        return;
      }
      setNomeCliente(data[0].nome as string);
      setEstadoCliente("ok");
      await buscarMissoes();
    })();
    return () => {
      ativo = false;
    };
  }, [token, buscarMissoes]);

  async function aprovar(missao: MissaoAprovacao) {
    setProcessandoId(missao.id);
    setErroAcao("");
    const supabase = createClient();
    const { error } = await supabase.rpc("aprovacao_responder", {
      p_token: token,
      p_tarefa_id: missao.id,
      p_acao: "aprovar",
      p_motivo: null,
    });
    setProcessandoId(null);
    if (error) {
      setErroAcao(error.message || "Não foi possível registrar a aprovação.");
      return;
    }
    setUltimaConfirmacao(`"${missao.titulo}" aprovada. Obrigado!`);
    await buscarMissoes();
  }

  async function enviarAjuste(missao: MissaoAprovacao) {
    if (!motivoAjuste.trim()) return;
    setProcessandoId(missao.id);
    setErroAcao("");
    const supabase = createClient();
    const { error } = await supabase.rpc("aprovacao_responder", {
      p_token: token,
      p_tarefa_id: missao.id,
      p_acao: "ajustes",
      p_motivo: motivoAjuste.trim(),
    });
    setProcessandoId(null);
    if (error) {
      setErroAcao(error.message || "Não foi possível enviar o pedido de ajuste.");
      return;
    }
    setUltimaConfirmacao(`Pedido de ajuste enviado para "${missao.titulo}".`);
    setAjusteAbertoId(null);
    setMotivoAjuste("");
    await buscarMissoes();
  }

  if (estadoCliente === "carregando") {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <p className="text-sm text-muted">Carregando...</p>
      </div>
    );
  }

  if (estadoCliente === "invalido") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <h1 className="font-display text-xl font-bold text-brand-dark">Link inválido</h1>
        <p className="max-w-sm text-sm text-muted">
          Esse link não existe mais ou foi substituído por um novo. Peça um link atualizado para
          o seu contato na Ousadia.
        </p>
      </div>
    );
  }

  const aguardando = missoes.filter((m) => m.status === "Aguardando Cliente");
  const outras = missoes.filter((m) => m.status !== "Aguardando Cliente");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          Ousadia Marketing
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-brand-dark sm:text-3xl">
          Olá, {nomeCliente}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Acompanhe e aprove suas entregas em andamento.
        </p>
      </header>

      {ultimaConfirmacao && (
        <p className="rounded-sm border border-accent-green/30 bg-accent-green-soft px-4 py-3 text-sm text-accent-green">
          ✓ {ultimaConfirmacao}
        </p>
      )}
      {erroAcao && <p className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{erroAcao}</p>}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-dark">
          Aguardando sua aprovação {aguardando.length > 0 && `(${aguardando.length})`}
        </h2>

        {aguardando.length === 0 ? (
          <p className="rounded-sm border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
            Nenhuma entrega aguardando sua aprovação no momento.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {aguardando.map((m) => (
              <div key={m.id} className="rounded-sm border border-border bg-surface p-4 shadow-sm">
                <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-sans text-base font-semibold text-foreground">{m.titulo}</h3>
                  <span className="shrink-0 rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-xs font-medium text-brand-dark">
                    {m.projeto_nome}
                  </span>
                </div>
                {m.descricao && (
                  <p className="mb-2 whitespace-pre-wrap text-sm text-muted">{m.descricao}</p>
                )}
                {m.tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {m.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mb-3 text-xs text-muted">Prazo: {formatDateBR(m.prazo_entrega)}</p>

                {(anexosPorMissao[m.id]?.length ?? 0) > 0 && (
                  <div className="mb-3 space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Arquivos
                    </p>
                    {anexosPorMissao[m.id]!.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => baixarAnexo(m.id, a)}
                        disabled={baixandoId === a.id}
                        className="flex w-full items-center justify-between gap-2 rounded-sm border border-border bg-background px-2.5 py-1.5 text-left text-xs text-foreground transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="min-w-0 truncate">📎 {a.nome}</span>
                        <span className="shrink-0 text-brand">
                          {baixandoId === a.id ? "Abrindo..." : `Baixar · ${formatTamanhoArquivo(a.tamanho)}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {ajusteAbertoId === m.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={motivoAjuste}
                      onChange={(e) => setMotivoAjuste(e.target.value)}
                      placeholder="O que precisa ajustar?"
                      rows={3}
                      autoFocus
                      className="w-full resize-none rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAjusteAbertoId(null);
                          setMotivoAjuste("");
                        }}
                        className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => enviarAjuste(m)}
                        disabled={!motivoAjuste.trim() || processandoId === m.id}
                        className="rounded-sm bg-danger px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {processandoId === m.id ? "Enviando..." : "Enviar pedido de ajuste"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => aprovar(m)}
                      disabled={processandoId === m.id}
                      className="rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processandoId === m.id ? "Enviando..." : "✓ Aprovar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAjusteAbertoId(m.id)}
                      disabled={processandoId === m.id}
                      className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-background"
                    >
                      Pedir ajuste
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {outras.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-brand-dark">
            Outras entregas em andamento
          </h2>
          <ul className="space-y-1.5">
            {outras.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-medium text-foreground">{m.titulo}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  <span className={`rounded-full border px-2 py-0.5 ${corStatus(m.status as Status)}`}>
                    {m.status}
                  </span>
                  {formatDateBR(m.prazo_entrega)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
