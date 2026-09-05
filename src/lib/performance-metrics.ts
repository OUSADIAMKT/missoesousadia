import {
  STATUSES_CONCLUIDOS,
  type Status,
  type TarefaComContexto,
} from "./types.ts";
import { dataDeConclusao, isAtrasada, isProximaDoPrazo } from "./utils.ts";

// Módulo puro (sem JSX) com toda a lógica analítica da Performance — reaproveitado
// pelo card "Carga por pessoa" já existente e pela página "Espelho do Colaborador".
// Cada métrica compara a pessoa contra a média/mediana do time (nunca um ranking
// bruto) — ver regras de design de métrica no prompt que originou este módulo.

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function diasEntre(inicioIso: string, fimIso: string): number {
  const inicio = new Date(inicioIso);
  const fim = new Date(fimIso);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return 0;
  const ms = fim.getTime() - inicio.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenado = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  return ordenado.length % 2 !== 0 ? ordenado[meio] : (ordenado[meio - 1] + ordenado[meio]) / 2;
}

export function formatDias(dias: number): string {
  const arredondado = Math.round(dias * 10) / 10;
  return `${arredondado} dia${arredondado === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------
// Núcleo comparativo: agrupa por `quem` e aplica uma função de valor por pessoa,
// devolvendo a própria pessoa + média/mediana do time. Pessoas sem base amostral
// pra aquela métrica (`valorDaPessoa` retorna null) ficam de fora da média — não
// viram 0%, que distorceria a comparação.
// ---------------------------------------------------------------------------

export interface EstatisticaTime {
  porPessoa: Record<string, number>;
  media: number;
  mediana: number;
  baseAmostral: number;
}

function calcularEstatisticaPorPessoa(
  tarefas: TarefaComContexto[],
  valorDaPessoa: (tarefasDaPessoa: TarefaComContexto[]) => number | null
): EstatisticaTime {
  const porPessoaTarefas = new Map<string, TarefaComContexto[]>();
  for (const t of tarefas) {
    const lista = porPessoaTarefas.get(t.quem) ?? [];
    lista.push(t);
    porPessoaTarefas.set(t.quem, lista);
  }
  const porPessoa: Record<string, number> = {};
  for (const [nome, lista] of porPessoaTarefas) {
    const valor = valorDaPessoa(lista);
    if (valor !== null) porPessoa[nome] = valor;
  }
  const valores = Object.values(porPessoa);
  return { porPessoa, media: media(valores), mediana: mediana(valores), baseAmostral: valores.length };
}

// 1. % de entrega no prazo — só entre concluídas (não puni missão ainda em curso).
export function percentualNoPrazo(tarefas: TarefaComContexto[]): EstatisticaTime {
  return calcularEstatisticaPorPessoa(tarefas, (doColaborador) => {
    const concluidas = doColaborador.filter((t) => STATUSES_CONCLUIDOS.includes(t.status));
    if (concluidas.length === 0) return null;
    const noPrazo = concluidas.filter((t) => {
      if (!t.prazoEntrega) return false; // defensivo — hoje o schema garante prazo sempre presente
      const concluidaEm = dataDeConclusao(t);
      return concluidaEm !== null && concluidaEm <= t.prazoEntrega;
    });
    return Math.round((noPrazo.length / concluidas.length) * 100);
  });
}

// 2. Cycle time — dias entre início e conclusão. Precisa de `dataInicio` (sempre
// presente no schema atual) e de uma data de conclusão derivável do histórico.
export function cycleTimeMedioDias(tarefas: TarefaComContexto[]): EstatisticaTime {
  return calcularEstatisticaPorPessoa(tarefas, (doColaborador) => {
    const dias = doColaborador
      .filter((t) => STATUSES_CONCLUIDOS.includes(t.status))
      .map((t) => {
        const concluidaEm = dataDeConclusao(t);
        return concluidaEm ? diasEntre(t.dataInicio, concluidaEm) : null;
      })
      .filter((d): d is number => d !== null);
    if (dias.length === 0) return null;
    return Math.round(media(dias) * 10) / 10;
  });
}

// 3. Throughput — entregas por semana, em média, desde o registro da missão mais
// antiga da pessoa até hoje.
export function throughputSemanal(tarefas: TarefaComContexto[]): EstatisticaTime {
  return calcularEstatisticaPorPessoa(tarefas, (doColaborador) => {
    const concluidas = doColaborador.filter((t) => STATUSES_CONCLUIDOS.includes(t.status));
    if (concluidas.length === 0) return null;
    const maisAntiga = doColaborador.reduce(
      (min, t) => (t.dataRegistro < min ? t.dataRegistro : min),
      doColaborador[0].dataRegistro
    );
    const semanas = Math.max(1, diasEntre(maisAntiga, hojeISO()) / 7);
    return Math.round((concluidas.length / semanas) * 10) / 10;
  });
}

// 4. Mix por tipo de missão — NÃO computável: não existe campo `tipo`/`categoria`
// em `Tarefa` nem em `supabase/schema.sql`. Contrato documentado para quando existir.
export interface MixPorTipoIndisponivel {
  disponivel: false;
  motivo: string;
  campoNecessario: string;
}

export function mixPorTipoDeMissao(): MixPorTipoIndisponivel {
  return {
    disponivel: false,
    motivo: "Nenhuma missão tem um campo de tipo/categoria hoje.",
    campoNecessario: "Tarefa.tipo (ex.: 'Edição' | 'Captação' | 'Roteiro' | 'Briefing' | ...)",
  };
}

// 5. Aging das tarefas ativas — base da timeline de vencimentos do Espelho.
export interface AgingItem {
  tarefaId: string;
  titulo: string;
  clienteNome: string;
  status: Status;
  prazoEntrega: string;
  diasEmAberto: number;
  diasDeAtraso: number;
  atrasada: boolean;
  proximaDoPrazo: boolean;
}

export function agingDasAtivas(tarefas: TarefaComContexto[]): AgingItem[] {
  const hoje = hojeISO();
  return tarefas
    .filter((t) => !STATUSES_CONCLUIDOS.includes(t.status))
    .map((t) => {
      const atrasada = isAtrasada(t.prazoEntrega, t.status);
      return {
        tarefaId: t.id,
        titulo: t.titulo,
        clienteNome: t.cliente?.nome ?? "Sem cliente",
        status: t.status,
        prazoEntrega: t.prazoEntrega,
        diasEmAberto: diasEntre(t.dataInicio, hoje),
        diasDeAtraso: atrasada ? diasEntre(t.prazoEntrega, hoje) : 0,
        atrasada,
        proximaDoPrazo: isProximaDoPrazo(t.prazoEntrega, t.status),
      };
    })
    .sort((a, b) => {
      if (!a.prazoEntrega) return 1; // sem prazo vai pro fim — defensivo, hoje não ocorre
      if (!b.prazoEntrega) return -1;
      return a.prazoEntrega.localeCompare(b.prazoEntrega);
    });
}

export function agingMedioDias(tarefas: TarefaComContexto[]): EstatisticaTime {
  return calcularEstatisticaPorPessoa(tarefas, (doColaborador) => {
    const ativas = doColaborador.filter((t) => !STATUSES_CONCLUIDOS.includes(t.status));
    if (ativas.length === 0) return null;
    const hoje = hojeISO();
    return Math.round(media(ativas.map((t) => diasEntre(t.dataInicio, hoje))));
  });
}

// 6. Concentração de cliente ("bus factor") — reaproveitado também pela tabela
// "onde a pessoa mais atua" do Espelho.
export interface DistribuicaoCliente {
  nome: string;
  qtdMissoes: number;
  horas: number;
  pctTempo: number;
}

export function calcularDistribuicaoPorCliente(tarefas: TarefaComContexto[]): DistribuicaoCliente[] {
  const porCliente = new Map<string, { nome: string; qtdMissoes: number; horas: number }>();
  for (const t of tarefas) {
    const nome = t.cliente?.nome ?? "Sem cliente";
    const atual = porCliente.get(nome) ?? { nome, qtdMissoes: 0, horas: 0 };
    atual.qtdMissoes += 1;
    atual.horas += t.horasEstimadas ?? 0;
    porCliente.set(nome, atual);
  }
  const entradas = Array.from(porCliente.values());
  const horasTotal = entradas.reduce((soma, c) => soma + c.horas, 0);
  const qtdTotal = tarefas.length;
  return entradas
    .map((c) => ({
      ...c,
      pctTempo:
        horasTotal > 0
          ? Math.round((c.horas / horasTotal) * 100)
          : Math.round((c.qtdMissoes / qtdTotal) * 100),
    }))
    .sort((a, b) => b.horas - a.horas || b.qtdMissoes - a.qtdMissoes);
}

// Índice de concentração = maior % de tempo entre os clientes atendidos.
// >70% sinaliza risco de dependência (bus factor), não demérito.
export function indiceConcentracaoCliente(tarefas: TarefaComContexto[]): EstatisticaTime {
  return calcularEstatisticaPorPessoa(tarefas, (doColaborador) => {
    if (doColaborador.length === 0) return null;
    const distribuicao = calcularDistribuicaoPorCliente(doColaborador);
    return distribuicao[0]?.pctTempo ?? 0;
  });
}

export const LIMITE_CONCENTRACAO_RISCO = 70;

// 7. Índice de sobrecarga — reaproveitado do card "Carga por pessoa" já existente
// na Performance. Só considera quem tem ≥1 missão ativa na média (quem está
// zerado não entra na conta e não distorce o time); com ≤1 pessoa ativa,
// ninguém fica sobrecarregado (qtd >= qtd*1.5 nunca é verdadeiro pra qtd > 0).
export interface CargaPessoa {
  nome: string;
  qtd: number;
  sobrecarregada: boolean;
}

export function calcularCargaPorPessoa(tarefas: TarefaComContexto[]): CargaPessoa[] {
  const contagem = new Map<string, number>();
  for (const t of tarefas) {
    if (STATUSES_CONCLUIDOS.includes(t.status)) continue;
    contagem.set(t.quem, (contagem.get(t.quem) ?? 0) + 1);
  }
  const entradas = Array.from(contagem.entries()).map(([nome, qtd]) => ({ nome, qtd }));
  const mediaCarga = media(entradas.map((e) => e.qtd));
  return entradas
    .map((e) => ({ ...e, sobrecarregada: e.qtd >= 3 && e.qtd >= mediaCarga * 1.5 }))
    .sort((a, b) => b.qtd - a.qtd);
}

// 8. Taxa de retrabalho — promovida para Tier 1 (o histórico completo já vem do
// Supabase hoje, não depende de apontamento de horas). Definição: a missão tem
// pelo menos uma transição para "Ajustes Solicitados" no histórico — esse é,
// por definição de domínio, o único status que sempre representa "voltou"
// (ver comentário de CORES_STATUS em utils.ts: "vermelho — retrabalho").
export function taxaRetrabalho(tarefas: TarefaComContexto[]): EstatisticaTime {
  return calcularEstatisticaPorPessoa(tarefas, (doColaborador) => {
    if (doColaborador.length === 0) return null;
    const comRetrabalho = doColaborador.filter((t) =>
      t.historico.some((h) => h.statusNovo === "Ajustes Solicitados")
    );
    return Math.round((comRetrabalho.length / doColaborador.length) * 100);
  });
}

// ---------------------------------------------------------------------------
// Tier 2 — produtividade real. Precisa de apontamento de horas reais por missão,
// que não existe no schema hoje (só `horasEstimadas`). Contrato pronto: quando
// essa fonte existir, basta passar `horasReais` — nenhuma função aqui muda de
// assinatura, só deixa de cair no branch `disponivel: false`.
// ---------------------------------------------------------------------------

export interface HorasReaisPorMissao {
  tarefaId: string;
  horasReais: number;
}

export interface MetricaIndisponivel {
  disponivel: false;
  motivo: string;
}

export interface PrecisaoEstimativa {
  disponivel: true;
  desvioPercentualMedio: number; // positivo = subestimou, negativo = superestimou
  amostras: number;
}

export function precisaoEstimativa(
  tarefas: TarefaComContexto[],
  horasReais?: HorasReaisPorMissao[]
): PrecisaoEstimativa | MetricaIndisponivel {
  if (!horasReais || horasReais.length === 0) {
    return { disponivel: false, motivo: "Aguardando apontamento de horas reais por missão." };
  }
  const porTarefa = new Map(horasReais.map((h) => [h.tarefaId, h.horasReais]));
  const desvios: number[] = [];
  for (const t of tarefas) {
    const real = porTarefa.get(t.id);
    if (real === undefined || !t.horasEstimadas) continue;
    desvios.push(((real - t.horasEstimadas) / t.horasEstimadas) * 100);
  }
  if (desvios.length === 0) {
    return { disponivel: false, motivo: "Aguardando apontamento de horas reais por missão." };
  }
  return { disponivel: true, desvioPercentualMedio: Math.round(media(desvios)), amostras: desvios.length };
}

export interface ProdutividadeReal {
  disponivel: true;
  entregasPorHora: number;
}

export function produtividadeReal(
  tarefas: TarefaComContexto[],
  horasReais?: HorasReaisPorMissao[]
): ProdutividadeReal | MetricaIndisponivel {
  if (!horasReais || horasReais.length === 0) {
    return { disponivel: false, motivo: "Aguardando apontamento de horas reais por missão." };
  }
  const porTarefa = new Map(horasReais.map((h) => [h.tarefaId, h.horasReais]));
  const concluidas = tarefas.filter((t) => STATUSES_CONCLUIDOS.includes(t.status));
  const horasTotais = concluidas.reduce((soma, t) => soma + (porTarefa.get(t.id) ?? 0), 0);
  if (horasTotais === 0) {
    return { disponivel: false, motivo: "Aguardando apontamento de horas reais por missão." };
  }
  return { disponivel: true, entregasPorHora: Math.round((concluidas.length / horasTotais) * 100) / 100 };
}

export interface Utilizacao {
  disponivel: true;
  percentual: number; // horas em missão ÷ horas disponíveis no período
}

export function utilizacao(
  horasEmMissao: number,
  horasDisponiveis?: number
): Utilizacao | MetricaIndisponivel {
  if (!horasDisponiveis || horasDisponiveis <= 0) {
    return { disponivel: false, motivo: "Aguardando horas disponíveis por pessoa no período." };
  }
  return { disponivel: true, percentual: Math.round((horasEmMissao / horasDisponiveis) * 100) };
}

// ---------------------------------------------------------------------------
// Tier 3 — retorno financeiro. Precisa de receita por cliente e custo/hora por
// pessoa, nenhum dos dois existe hoje (só `Cliente.valorMensal`, opcional e não
// usado ainda). Contrato pronto do mesmo jeito que o Tier 2.
// ---------------------------------------------------------------------------

export interface DadosFinanceiros {
  receitaMensalPorClienteId: Record<string, number>;
  custoHoraPorPessoa: Record<string, number>;
}

export interface RetornoFinanceiro {
  disponivel: true;
  receitaAlocada: number;
  custoAlocado: number;
  margem: number;
}

export function retornoFinanceiroPorColaborador(
  tarefasDaPessoa: TarefaComContexto[],
  todasTarefas: TarefaComContexto[],
  colaboradorNome: string,
  dados?: DadosFinanceiros
): RetornoFinanceiro | MetricaIndisponivel {
  if (!dados) {
    return {
      disponivel: false,
      motivo: "Aguardando receita por cliente e custo/hora por pessoa.",
    };
  }
  const custoHora = dados.custoHoraPorPessoa[colaboradorNome];
  if (custoHora === undefined) {
    return { disponivel: false, motivo: "Aguardando custo/hora cadastrado para esta pessoa." };
  }

  // Rateio proporcional real: a fatia da pessoa na receita mensal de um cliente é
  // (horas dela nesse cliente) / (horas do time inteiro nesse cliente) — não um
  // número fixo. Por isso precisa de `todasTarefas`, não só das dela.
  const horasPorClienteTime = new Map<string, number>();
  for (const t of todasTarefas) {
    if (!t.cliente) continue;
    horasPorClienteTime.set(
      t.cliente.id,
      (horasPorClienteTime.get(t.cliente.id) ?? 0) + (t.horasEstimadas ?? 0)
    );
  }

  let receitaAlocada = 0;
  let horasTotaisPessoa = 0;
  for (const t of tarefasDaPessoa) {
    const horas = t.horasEstimadas ?? 0;
    horasTotaisPessoa += horas;
    if (!t.cliente || horas === 0) continue;
    const receitaMensal = dados.receitaMensalPorClienteId[t.cliente.id];
    const horasClienteTime = horasPorClienteTime.get(t.cliente.id);
    if (receitaMensal === undefined || !horasClienteTime) continue;
    receitaAlocada += receitaMensal * (horas / horasClienteTime);
  }

  const custoAlocado = horasTotaisPessoa * custoHora;
  return {
    disponivel: true,
    receitaAlocada: Math.round(receitaAlocada),
    custoAlocado: Math.round(custoAlocado),
    margem: Math.round(receitaAlocada - custoAlocado),
  };
}
