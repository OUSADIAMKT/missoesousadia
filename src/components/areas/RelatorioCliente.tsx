"use client";

import { STATUSES, type Status, type TarefaComContexto } from "@/lib/types";
import { corResponsavel, corStatus, formatDateBR, iniciais } from "@/lib/utils";

interface RelatorioClienteProps {
  clienteNome: string;
  tarefas: TarefaComContexto[];
}

const STATUSES_CONCLUIDOS: Status[] = ["Aprovado", "Concluído"];
const STATUSES_PENDENTES = STATUSES.filter((s) => !STATUSES_CONCLUIDOS.includes(s));

interface EsforcoProjeto {
  nome: string;
  horas: number;
  semEstimativa: number;
}

// Soma horasEstimadas por projeto — é uma estimativa de esforço, não horas
// realmente apontadas (o app ainda não tem apontamento de horas).
function calcularEsforcoPorProjeto(tarefas: TarefaComContexto[]): EsforcoProjeto[] {
  const porProjeto = new Map<string, EsforcoProjeto>();
  for (const t of tarefas) {
    const nome = t.projeto?.nome ?? "Sem projeto";
    const atual = porProjeto.get(nome) ?? { nome, horas: 0, semEstimativa: 0 };
    if (t.horasEstimadas) {
      atual.horas += t.horasEstimadas;
    } else {
      atual.semEstimativa += 1;
    }
    porProjeto.set(nome, atual);
  }
  return Array.from(porProjeto.values()).sort((a, b) => b.horas - a.horas);
}

interface EnvolvidoResumo {
  nome: string;
  qtdMissoes: number;
  horasEstimadas: number;
}

function calcularProfissionaisEnvolvidos(tarefas: TarefaComContexto[]): EnvolvidoResumo[] {
  const porPessoa = new Map<string, EnvolvidoResumo>();
  for (const t of tarefas) {
    const atual = porPessoa.get(t.quem) ?? { nome: t.quem, qtdMissoes: 0, horasEstimadas: 0 };
    atual.qtdMissoes += 1;
    atual.horasEstimadas += t.horasEstimadas ?? 0;
    porPessoa.set(t.quem, atual);
  }
  return Array.from(porPessoa.values()).sort((a, b) => b.qtdMissoes - a.qtdMissoes);
}

// `historico` vem ordenado do mais recente para o mais antigo (ver
// tarefaFromRow em mappers.ts), então o item [0] é a última mudança de status.
function dataDeConclusao(tarefa: TarefaComContexto): string | null {
  return tarefa.historico[0]?.data.slice(0, 10) ?? null;
}

export function RelatorioCliente({ clienteNome, tarefas }: RelatorioClienteProps) {
  const total = tarefas.length;

  if (total === 0) {
    return (
      <p className="rounded-sm border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
        {clienteNome} ainda não tem missões registradas.
      </p>
    );
  }

  const concluidas = tarefas.filter((t) => STATUSES_CONCLUIDOS.includes(t.status));
  const pendentes = tarefas.filter((t) => !STATUSES_CONCLUIDOS.includes(t.status));
  const pctConcluido = Math.round((concluidas.length / total) * 100);
  const esforcoPorProjeto = calcularEsforcoPorProjeto(tarefas);
  const horasTotal = esforcoPorProjeto.reduce((soma, p) => soma + p.horas, 0);
  const semEstimativaTotal = esforcoPorProjeto.reduce((soma, p) => soma + p.semEstimativa, 0);
  const envolvidos = calcularProfissionaisEnvolvidos(tarefas);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-sm border border-border bg-surface p-4">
        <h2 className="font-display text-lg font-semibold text-brand-dark">
          Resumo — {clienteNome}
        </h2>
        <div className="mt-3 flex flex-wrap gap-6">
          <div>
            <p className="text-2xl font-semibold text-foreground">{total}</p>
            <p className="text-xs text-muted">missões no total</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-accent-green">{pctConcluido}%</p>
            <p className="text-xs text-muted">concluído/aprovado</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">
              {horasTotal}h
              {semEstimativaTotal > 0 && (
                <span className="ml-1 text-xs font-normal text-muted">
                  (+{semEstimativaTotal} sem estimativa)
                </span>
              )}
            </p>
            <p className="text-xs text-muted">esforço estimado</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-sm border border-border bg-surface p-4">
          <h3 className="font-display text-base font-semibold text-brand-dark">O que foi feito</h3>
          {concluidas.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nenhuma missão concluída ou aprovada ainda.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {concluidas.map((t) => {
                const concluidaEm = dataDeConclusao(t);
                return (
                  <li key={t.id} className="flex items-start justify-between gap-2 text-sm">
                    <span>
                      {t.titulo}
                      <span className="block text-xs text-muted">
                        {t.projeto?.nome ?? "Sem projeto"}
                        {concluidaEm && ` · concluído em ${formatDateBR(concluidaEm)}`}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${corStatus(
                        t.status
                      )}`}
                    >
                      {t.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-sm border border-border bg-surface p-4">
          <h3 className="font-display text-base font-semibold text-brand-dark">O que falta</h3>
          {pendentes.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nada pendente — tudo concluído ou aprovado.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {STATUSES_PENDENTES.map((status) => {
                const doStatus = pendentes.filter((t) => t.status === status);
                if (doStatus.length === 0) return null;
                return (
                  <div key={status}>
                    <p className="text-xs font-semibold text-muted">
                      {status} ({doStatus.length})
                    </p>
                    <ul className="mt-1 space-y-1">
                      {doStatus.map((t) => (
                        <li key={t.id} className="text-sm text-foreground">
                          {t.titulo}
                          <span className="ml-1 text-xs text-muted">
                            — prazo {formatDateBR(t.prazoEntrega)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-sm border border-border bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-brand-dark">
          Profissionais envolvidos
        </h3>
        <p className="mb-3 mt-1 text-xs text-muted">
          Missões e horas estimadas por pessoa — ainda não é custo real (falta valor de hora por
          pessoa), é uma base para pensar precificação.
        </p>
        <ul className="space-y-1.5">
          {envolvidos.map((e) => (
            <li key={e.nome} className="flex items-center gap-3 text-sm">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold ${corResponsavel(
                  e.nome
                )}`}
              >
                {iniciais(e.nome)}
              </span>
              <span className="flex-1 text-foreground">{e.nome}</span>
              <span className="text-xs text-muted">{e.qtdMissoes} missões</span>
              <span className="w-20 shrink-0 text-right text-xs text-muted">
                {e.horasEstimadas}h est.
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
