"use client";

import { useMemo, useState } from "react";
import { AreaHoje } from "@/components/areas/AreaHoje";
import { AreaMissoes } from "@/components/areas/AreaMissoes";
import { AreaPerformance } from "@/components/areas/AreaPerformance";
import { AreaProjetos } from "@/components/areas/AreaProjetos";
import { GerenciarUsuarios } from "@/components/GerenciarUsuarios";
import { TarefaForm } from "@/components/TarefaForm";
import { useEstrutura } from "@/lib/useEstrutura";
import { useTarefas } from "@/lib/useTarefas";
import { useUsuarios } from "@/lib/useUsuarios";
import type { NovaTarefa, Status, TarefaComContexto } from "@/lib/types";
import { corResponsavel, iniciais, isAtrasada } from "@/lib/utils";

type Area = "hoje" | "missoes" | "projetos" | "performance";

const AREAS: { id: Area; rotulo: string; icone: string }[] = [
  { id: "hoje", rotulo: "Hoje", icone: "🏠" },
  { id: "missoes", rotulo: "Missões", icone: "🎯" },
  { id: "projetos", rotulo: "Projetos", icone: "📁" },
  { id: "performance", rotulo: "Performance", icone: "📊" },
];

export default function Home() {
  const {
    tarefas,
    pronto: tarefasProntas,
    adicionar,
    atualizar,
    remover,
    adicionarBloqueio,
    resolverBloqueio,
    enviarAnexo,
    removerAnexo,
    baixarAnexo,
    adicionarComentario,
    adicionarApontamento,
    removerApontamento,
  } = useTarefas();
  const {
    usuarios,
    usuarioAtual,
    emailLogado,
    semAcesso,
    souAdmin,
    pronto: usuariosProntos,
    adicionarUsuario,
    atualizarUsuario,
    removerUsuario,
    sair,
  } = useUsuarios();
  const estrutura = useEstrutura();

  const [areaAtiva, setAreaAtiva] = useState<Area>("hoje");
  const [formAberto, setFormAberto] = useState(false);
  // Guarda só o id, não a tarefa em si — assim o formulário sempre reflete o
  // estado mais recente (ex.: bloqueio adicionado sem fechar o modal) em vez
  // de uma cópia congelada no momento em que o modal abriu.
  const [tarefaEmEdicaoId, setTarefaEmEdicaoId] = useState<string | null>(null);
  const [usuariosAberto, setUsuariosAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [quem, setQuem] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [tag, setTag] = useState("");
  const [busca, setBusca] = useState("");

  const tarefasComContexto = useMemo<TarefaComContexto[]>(() => {
    const projetoPorId = new Map(estrutura.projetos.map((p) => [p.id, p]));
    const clientePorId = new Map(estrutura.clientes.map((c) => [c.id, c]));
    return tarefas.map((t) => {
      const projeto = projetoPorId.get(t.projetoId);
      const cliente = projeto ? clientePorId.get(projeto.clienteId) : undefined;
      return { ...t, projeto, cliente };
    });
  }, [tarefas, estrutura.projetos, estrutura.clientes]);

  const tagsDisponiveis = useMemo(() => {
    const conjunto = new Set<string>();
    for (const t of tarefasComContexto) for (const tg of t.tags) conjunto.add(tg);
    return Array.from(conjunto).sort((a, b) => a.localeCompare(b));
  }, [tarefasComContexto]);

  const tarefasFiltradas = useMemo(() => {
    return tarefasComContexto.filter((t) => {
      if (clienteId && t.cliente?.id !== clienteId) return false;
      if (projetoId && t.projetoId !== projetoId) return false;
      if (quem && t.quem !== quem) return false;
      if (prioridade && t.prioridade !== prioridade) return false;
      if (tag && !t.tags.includes(tag)) return false;
      if (busca) {
        const alvo = busca.toLowerCase();
        const casouTitulo = t.titulo.toLowerCase().includes(alvo);
        const casouDescricao = t.descricao.toLowerCase().includes(alvo);
        if (!casouTitulo && !casouDescricao) return false;
      }
      return true;
    });
  }, [tarefasComContexto, clienteId, projetoId, quem, prioridade, tag, busca]);

  const atrasadas = useMemo(
    () => tarefasComContexto.filter((t) => isAtrasada(t.prazoEntrega, t.status)).length,
    [tarefasComContexto]
  );

  const tarefaEmEdicao = useMemo(
    () => (tarefaEmEdicaoId ? tarefasComContexto.find((t) => t.id === tarefaEmEdicaoId) ?? null : null),
    [tarefaEmEdicaoId, tarefasComContexto]
  );

  const pronto = tarefasProntas && estrutura.pronto && usuariosProntos;

  function abrirNova() {
    setTarefaEmEdicaoId(null);
    setFormAberto(true);
  }

  function abrirEdicao(tarefa: TarefaComContexto) {
    setTarefaEmEdicaoId(tarefa.id);
    setFormAberto(true);
  }

  function fechar() {
    setFormAberto(false);
    setTarefaEmEdicaoId(null);
  }

  function notificarErro(mensagem: string) {
    setErro(mensagem);
  }

  async function salvar(dados: NovaTarefa): Promise<boolean> {
    const ok = tarefaEmEdicao ? await atualizar(tarefaEmEdicao.id, dados) : await adicionar(dados);
    if (!ok) notificarErro("Não foi possível salvar a missão. Tente novamente.");
    return ok;
  }

  async function excluir(id: string): Promise<boolean> {
    const ok = await remover(id);
    if (!ok) notificarErro("Não foi possível excluir a missão. Tente novamente.");
    return ok;
  }

  async function moverStatus(id: string, status: Status) {
    const ok = await atualizar(id, { status });
    if (!ok) notificarErro("Não foi possível mover a missão. Tente novamente.");
  }

  function irParaMissoesDoProjeto(idProjeto: string) {
    const projeto = estrutura.projetos.find((p) => p.id === idProjeto);
    setClienteId(projeto?.clienteId ?? "");
    setProjetoId(idProjeto);
    setAreaAtiva("missoes");
  }

  if (pronto && semAcesso) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-brand-dark">Sem acesso</h1>
        <p className="text-sm text-muted">
          O e-mail <strong>{emailLogado}</strong> ainda não está cadastrado nesta Central de
          Operações. Peça para alguém do time te adicionar em &quot;Time e custos&quot;.
        </p>
        <button
          onClick={sair}
          className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-background"
        >
          Sair e tentar com outra conta
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Central de Operações da Agência
          </p>
          <h1 className="font-display text-3xl font-bold text-brand-dark sm:text-4xl">
            Missões da Ousadia
          </h1>
          <p className="mt-1 text-sm text-muted">
            {tarefas.length} missão{tarefas.length === 1 ? "" : "s"} no total
            {atrasadas > 0 && (
              <span className="ml-2 font-medium text-danger">
                · {atrasadas} atrasada{atrasadas === 1 ? "" : "s"}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setUsuariosAberto(true)}
            className="flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-brand"
          >
            <span
              className={`grid h-5 w-5 place-items-center rounded-full border text-[9px] font-semibold ${corResponsavel(
                usuarioAtual
              )}`}
            >
              {iniciais(usuarioAtual)}
            </span>
            Você é {usuarioAtual}
          </button>

          <button
            onClick={abrirNova}
            className="rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90"
          >
            + Nova missão
          </button>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-border">
        {AREAS.map((area) => (
          <button
            key={area.id}
            onClick={() => setAreaAtiva(area.id)}
            className={`flex items-center gap-1.5 rounded-t-sm border-b-2 px-3 py-2 text-sm font-medium transition ${
              areaAtiva === area.id
                ? "border-brand text-brand-dark"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <span>{area.icone}</span>
            {area.rotulo}
          </button>
        ))}
      </nav>

      {!pronto && (
        <p className="rounded-sm border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted">
          Carregando...
        </p>
      )}

      {pronto && areaAtiva === "hoje" && (
        <AreaHoje
          tarefas={tarefasComContexto}
          usuarioAtual={usuarioAtual}
          onSelecionar={abrirEdicao}
          onMoverStatus={moverStatus}
        />
      )}

      {pronto && areaAtiva === "missoes" && (
        <AreaMissoes
          tarefas={tarefasFiltradas}
          clientes={estrutura.clientes}
          projetos={estrutura.projetos}
          usuarios={usuarios}
          usuarioAtual={usuarioAtual}
          tagsDisponiveis={tagsDisponiveis}
          clienteId={clienteId}
          projetoId={projetoId}
          quem={quem}
          prioridade={prioridade}
          tag={tag}
          busca={busca}
          onClienteIdChange={setClienteId}
          onProjetoIdChange={setProjetoId}
          onQuemChange={setQuem}
          onPrioridadeChange={setPrioridade}
          onTagChange={setTag}
          onBuscaChange={setBusca}
          onSelecionar={abrirEdicao}
          onMoverStatus={moverStatus}
        />
      )}

      {pronto && areaAtiva === "projetos" && (
        <AreaProjetos
          clientes={estrutura.clientes}
          projetos={estrutura.projetos}
          tarefas={tarefasComContexto}
          onAdicionarCliente={estrutura.adicionarCliente}
          onAtualizarCliente={estrutura.atualizarCliente}
          onRemoverCliente={estrutura.removerCliente}
          onAdicionarProjeto={estrutura.adicionarProjeto}
          onRemoverProjeto={estrutura.removerProjeto}
          onVerMissoesDoProjeto={irParaMissoesDoProjeto}
          onNotificarErro={notificarErro}
        />
      )}

      {pronto && areaAtiva === "performance" && (
        <AreaPerformance
          tarefas={tarefasComContexto}
          usuarios={usuarios}
          clientesCadastrados={estrutura.clientes}
        />
      )}

      <TarefaForm
        aberto={formAberto}
        tarefaEmEdicao={tarefaEmEdicao}
        usuarios={usuarios}
        clientes={estrutura.clientes}
        projetos={estrutura.projetos}
        onFechar={fechar}
        onSalvar={salvar}
        onExcluir={excluir}
        onEncontrarOuCriarProjeto={estrutura.encontrarOuCriarProjeto}
        onAdicionarBloqueio={adicionarBloqueio}
        onResolverBloqueio={resolverBloqueio}
        onEnviarAnexo={enviarAnexo}
        onRemoverAnexo={removerAnexo}
        onBaixarAnexo={baixarAnexo}
        onAdicionarComentario={adicionarComentario}
        onAdicionarApontamento={adicionarApontamento}
        onRemoverApontamento={removerApontamento}
      />

      <GerenciarUsuarios
        aberto={usuariosAberto}
        usuarios={usuarios}
        usuarioAtual={usuarioAtual}
        emailLogado={emailLogado}
        souAdmin={souAdmin}
        onFechar={() => setUsuariosAberto(false)}
        onAdicionar={adicionarUsuario}
        onAtualizar={atualizarUsuario}
        onRemover={removerUsuario}
        onSair={sair}
        onNotificarErro={notificarErro}
      />

      {erro && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-sm border border-danger/30 bg-danger px-4 py-3 text-sm text-white shadow-lg">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="text-white/80 hover:text-white" aria-label="Fechar aviso">✕</button>
        </div>
      )}
    </div>
  );
}
