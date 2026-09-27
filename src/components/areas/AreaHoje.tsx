"use client";

import { useMemo, useState } from "react";
import { TarefaCard } from "@/components/TarefaCard";
import type { Status, TarefaComContexto } from "@/lib/types";
import { corResponsavel, iniciais, isAtrasada, isProximaDoPrazo } from "@/lib/utils";
import { agingDasAtivas } from "@/lib/performance-metrics";
import { gerarBriefingDiario, type ItemBriefingIA } from "@/lib/ia";

interface AreaHojeProps {
  tarefas: TarefaComContexto[];
  usuarioAtual: string;
  onSelecionar: (tarefa: TarefaComContexto) => void;
  onMoverStatus: (id: string, status: Status) => void;
}

function Contador({
  rotulo,
  valor,
  cor,
}: {
  rotulo: string;
  valor: number;
  cor: string;
}) {
  const apagado = valor === 0;
  return (
    <div className="min-w-0">
      <div
        className={`font-display text-2xl font-bold ${apagado ? "text-muted/50" : cor}`}
      >
        {valor}
      </div>
      <div className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">
        {rotulo}
      </div>
    </div>
  );
}

interface SecaoProps {
  titulo: string;
  descricao: string;
  corPonto: string;
  tarefas: TarefaComContexto[];
  onSelecionar: (tarefa: TarefaComContexto) => void;
  onMoverStatus: (id: string, status: Status) => void;
}

function Secao({ titulo, descricao, corPonto, tarefas, onSelecionar, onMoverStatus }: SecaoProps) {
  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${corPonto}`} />
        <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-muted">
          {titulo}
        </h2>
        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold text-foreground">
          {tarefas.length}
        </span>
      </div>
      <p className="mb-3 pl-4 text-xs text-muted">{descricao}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tarefas.map((t) => (
          <TarefaCard
            key={t.id}
            tarefa={t}
            onClick={() => onSelecionar(t)}
            onMudarStatus={(s) => onMoverStatus(t.id, s)}
          />
        ))}
      </div>
    </section>
  );
}

export function AreaHoje({ tarefas, usuarioAtual, onSelecionar, onMoverStatus }: AreaHojeProps) {
  const [soMinhas, setSoMinhas] = useState(false);
  const [gerandoBriefing, setGerandoBriefing] = useState(false);
  const [briefing, setBriefing] = useState("");
  const [erroBriefing, setErroBriefing] = useState("");

  const visiveis = useMemo(
    () => (soMinhas && usuarioAtual ? tarefas.filter((t) => t.quem === usuarioAtual) : tarefas),
    [tarefas, soMinhas, usuarioAtual]
  );

  // Dias de atraso por missão — reaproveita o cálculo já usado na Performance
  // em vez de refazer conta de data aqui.
  const aging = useMemo(
    () => new Map(agingDasAtivas(visiveis).map((a) => [a.tarefaId, a])),
    [visiveis]
  );

  const grupos = useMemo(() => {
    const bloqueadasTodas = visiveis.filter((t) => t.bloqueios.some((b) => !b.resolvidoEm));
    const atrasadasTodas = visiveis.filter((t) => isAtrasada(t.prazoEntrega, t.status));
    const proximasTodas = visiveis.filter((t) => isProximaDoPrazo(t.prazoEntrega, t.status));
    const minhaAcaoTodas = usuarioAtual
      ? visiveis.filter(
          (t) =>
            t.quem === usuarioAtual &&
            (t.status === "Ajustes Solicitados" ||
              isAtrasada(t.prazoEntrega, t.status) ||
              isProximaDoPrazo(t.prazoEntrega, t.status))
        )
      : [];

    // Cada missão entra só na seção mais urgente que casar — sem repetir o mesmo
    // card três vezes na tela. Os contadores acima seguem contando tudo.
    const jaListadas = new Set<string>();
    const semRepetir = (lista: TarefaComContexto[]) => {
      const novas = lista.filter((t) => !jaListadas.has(t.id));
      for (const t of novas) jaListadas.add(t.id);
      return novas;
    };

    const bloqueadas = semRepetir(bloqueadasTodas);
    const atrasadas = semRepetir(atrasadasTodas).sort(
      (a, b) => (aging.get(b.id)?.diasDeAtraso ?? 0) - (aging.get(a.id)?.diasDeAtraso ?? 0)
    );
    const minhaAcao = semRepetir(minhaAcaoTodas);
    const proximas = semRepetir(proximasTodas);

    return {
      bloqueadas,
      atrasadas,
      minhaAcao,
      proximas,
      totais: {
        bloqueadas: bloqueadasTodas.length,
        atrasadas: atrasadasTodas.length,
        proximas: proximasTodas.length,
        minhas: minhaAcaoTodas.length,
      },
      precisamAtencao: jaListadas.size,
    };
  }, [visiveis, usuarioAtual, aging]);

  function paraItemIA(t: TarefaComContexto): ItemBriefingIA {
    return {
      titulo: t.titulo,
      cliente: t.cliente?.nome ?? "Sem cliente",
      status: t.status,
      diasDeAtraso: aging.get(t.id)?.diasDeAtraso,
      bloqueio: t.bloqueios.find((b) => !b.resolvidoEm)?.motivo,
    };
  }

  async function gerarBriefing() {
    setGerandoBriefing(true);
    setErroBriefing("");
    try {
      const texto = await gerarBriefingDiario({
        usuarioAtual,
        bloqueadas: grupos.bloqueadas.map(paraItemIA),
        atrasadas: grupos.atrasadas.map(paraItemIA),
        minhaAcao: grupos.minhaAcao.map(paraItemIA),
        proximas: grupos.proximas.map(paraItemIA),
      });
      setBriefing(texto);
    } catch (erro) {
      setErroBriefing(erro instanceof Error ? erro.message : "Erro ao gerar o briefing.");
    } finally {
      setGerandoBriefing(false);
    }
  }

  const secoes = [
    {
      chave: "bloqueadas",
      titulo: "Bloqueadas",
      descricao: "Têm pelo menos um bloqueio ativo impedindo o andamento.",
      corPonto: "bg-danger",
      tarefas: grupos.bloqueadas,
    },
    {
      chave: "atrasadas",
      titulo: "Atrasadas",
      descricao: "Passaram do prazo e ainda não foram concluídas — as mais antigas primeiro.",
      corPonto: "bg-danger",
      tarefas: grupos.atrasadas,
    },
    {
      chave: "minhas",
      titulo: "Aguardando sua ação",
      descricao: `Missões de ${usuarioAtual} com ajuste pedido pelo cliente ou prazo apertado.`,
      corPonto: "bg-brand",
      tarefas: grupos.minhaAcao,
    },
    {
      chave: "proximas",
      titulo: "Prazo próximo",
      descricao: "Vencem nos próximos 2 dias.",
      corPonto: "bg-accent",
      tarefas: grupos.proximas,
    },
  ].filter((s) => s.tarefas.length > 0);

  const nada = grupos.precisamAtencao === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Resumo do dia */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-brand-dark">
              {nada
                ? "Nada pegando fogo por aqui."
                : `${grupos.precisamAtencao} ${
                    grupos.precisamAtencao === 1 ? "missão precisa" : "missões precisam"
                  } de ${soMinhas ? "você" : "atenção"} agora.`}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {nada
                ? "Sem bloqueio, sem atraso e nada vencendo nos próximos 2 dias."
                : "Cada missão aparece uma vez, na situação mais urgente dela."}
            </p>
            {!nada && (
              <button
                type="button"
                onClick={gerarBriefing}
                disabled={gerandoBriefing}
                className="mt-2 text-xs font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
              >
                {gerandoBriefing
                  ? "Gerando briefing..."
                  : briefing
                  ? "✨ Gerar de novo"
                  : "✨ Gerar briefing do dia com IA"}
              </button>
            )}
            {erroBriefing && <p className="mt-1 text-xs text-danger">{erroBriefing}</p>}
            {briefing && (
              <p className="mt-2 rounded-sm border border-accent/30 bg-accent-soft/60 p-3 text-sm leading-relaxed text-brand-dark">
                {briefing}
              </p>
            )}
          </div>

          {usuarioAtual && (
            <button
              type="button"
              aria-pressed={soMinhas}
              onClick={() => setSoMinhas((v) => !v)}
              className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition ${
                soMinhas
                  ? "border-brand bg-brand/10 text-brand-dark"
                  : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full border text-[9px] font-semibold ${corResponsavel(
                  usuarioAtual
                )}`}
              >
                {iniciais(usuarioAtual)}
              </span>
              Só as minhas
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
          <Contador rotulo="Bloqueadas" valor={grupos.totais.bloqueadas} cor="text-danger" />
          <Contador rotulo="Atrasadas" valor={grupos.totais.atrasadas} cor="text-danger" />
          <Contador rotulo="Vencendo em 2 dias" valor={grupos.totais.proximas} cor="text-accent" />
          <Contador
            rotulo={soMinhas ? "Suas, urgentes" : "Aguardando você"}
            valor={grupos.totais.minhas}
            cor="text-brand"
          />
        </div>
      </div>

      {nada ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-12 text-center">
          <p className="font-display text-lg font-semibold text-accent-green">
            {soMinhas ? "Você está em dia." : "O time está em dia."}
          </p>
          <p className="mt-1 text-sm text-muted">
            Quando algo atrasar, bloquear ou chegar perto do prazo, aparece aqui primeiro.
          </p>
        </div>
      ) : (
        secoes.map((s) => (
          <Secao
            key={s.chave}
            titulo={s.titulo}
            descricao={s.descricao}
            corPonto={s.corPonto}
            tarefas={s.tarefas}
            onSelecionar={onSelecionar}
            onMoverStatus={onMoverStatus}
          />
        ))
      )}
    </div>
  );
}
