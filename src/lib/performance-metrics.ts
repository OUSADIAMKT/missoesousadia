import {
  STATUSES_CONCLUIDOS,
  VINCULOS_CUSTO_FIXO,
  type Complexidade,
  type Status,
  type TarefaComContexto,
  type Vinculo,
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

// Soma os apontamentos manuais de cada missão (ver TarefaForm.tsx e a tabela
// `apontamentos` em supabase/schema.sql) no formato que precisaoEstimativa/
// produtividadeReal esperam. Missão sem nenhum apontamento fica de fora —
// mesma regra do resto do módulo, "sem amostra" não é "zero".
export function horasReaisDeTarefas(tarefas: TarefaComContexto[]): HorasReaisPorMissao[] {
  return tarefas
    .map((t) => ({
      tarefaId: t.id,
      horasReais: t.apontamentos.reduce((soma, a) => soma + a.horas, 0),
    }))
    .filter((h) => h.horasReais > 0);
}

// ---------------------------------------------------------------------------
// SUGESTÃO DE HORAS AO CONCLUIR (lembrete de apontamento) — heurística pura,
// de propósito SEM chamada de IA: é uma estimativa numérica, não geração de
// texto, e uma conta local é mais confiável e instantânea que ida e volta
// numa API paga pra "adivinhar um número". Ordem de preferência:
//   1. horasEstimadas da própria missão (o que já foi combinado)
//   2. mediana de horas reais já apontadas em missões de complexidade igual
//   3. um padrão fixo por complexidade, só pra nunca devolver vazio
// ---------------------------------------------------------------------------

export type OrigemSugestaoHoras = "estimativa" | "historico" | "padrao";

export interface SugestaoHoras {
  horas: number;
  origem: OrigemSugestaoHoras;
}

const HORAS_PADRAO_POR_COMPLEXIDADE: Record<Complexidade, number> = {
  Simples: 1,
  Média: 3,
  Complexa: 6,
};

export function sugerirHorasApontamento(
  tarefa: TarefaComContexto,
  todasTarefas: TarefaComContexto[]
): SugestaoHoras {
  if (tarefa.horasEstimadas && tarefa.horasEstimadas > 0) {
    return { horas: tarefa.horasEstimadas, origem: "estimativa" };
  }

  const horasDeSemelhantes = todasTarefas
    .filter((t) => t.id !== tarefa.id && t.complexidade === tarefa.complexidade)
    .map((t) => t.apontamentos.reduce((soma, a) => soma + a.horas, 0))
    .filter((h) => h > 0);

  if (horasDeSemelhantes.length > 0) {
    return { horas: Math.round(mediana(horasDeSemelhantes) * 2) / 2, origem: "historico" };
  }

  return { horas: HORAS_PADRAO_POR_COMPLEXIDADE[tarefa.complexidade], origem: "padrao" };
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

// ---------------------------------------------------------------------------
// CUSTO POR ENTREGA (Fase 1) — disponível, diferente do Tier 2/3 acima.
//
// Responde "o pacote fechado vale a pena?". Um custo fixo (o pacote da produtora
// terceirizada, um salário, um pró-labore) corre igual todo mês independente do
// volume entregue; dividir esse custo pelas entregas do mês transforma um valor
// abstrato em preço unitário — e é o único jeito de comparar um fornecedor de
// pacote com alguém pago por projeto.
//
// Só precisa de dois dados que a Fase 0 acabou de cadastrar (`vinculo` e
// `custoMensal` em `usuarios`) mais o que o sistema já registra: quem concluiu
// o quê e quando. Nada de apontamento de horas.
// ---------------------------------------------------------------------------

export interface PessoaComCusto {
  nome: string;
  vinculo: Vinculo | null;
  custoMensal?: number;
}

export interface CustoDeEntregaNoMes {
  nome: string;
  vinculo: Vinculo;
  custoMensal: number;
  entregas: number;
  // `null` quando o mês não teve nenhuma entrega: o custo correu e não comprou
  // nada. Não é zero nem infinito — é uma condição diferente, e a UI destaca.
  custoPorEntrega: number | null;
}

// Mês de uma missão concluída, no formato "YYYY-MM". Usa a mesma
// `dataDeConclusao` do resto do módulo (última mudança de status registrada).
function mesDeConclusao(tarefa: TarefaComContexto): string | null {
  if (!STATUSES_CONCLUIDOS.includes(tarefa.status)) return null;
  return dataDeConclusao(tarefa)?.slice(0, 7) ?? null;
}

export function custoPorEntregaNoMes(
  tarefas: TarefaComContexto[],
  pessoas: PessoaComCusto[],
  mesISO: string
): CustoDeEntregaNoMes[] {
  const entregasPorPessoa = new Map<string, number>();
  for (const t of tarefas) {
    if (mesDeConclusao(t) !== mesISO) continue;
    entregasPorPessoa.set(t.quem, (entregasPorPessoa.get(t.quem) ?? 0) + 1);
  }

  return pessoas
    .filter(
      (p): p is PessoaComCusto & { vinculo: Vinculo; custoMensal: number } =>
        // Sem vínculo classificado ou sem custo lançado, a pessoa fica de fora
        // em vez de entrar zerada — mesma regra do resto do módulo. Custo zero
        // (sócia sem pró-labore) também sai: ela não tem custo em dinheiro, e
        // um "R$ 0,00 por entrega" só polui o relatório.
        p.vinculo !== null &&
        VINCULOS_CUSTO_FIXO.includes(p.vinculo) &&
        p.custoMensal !== undefined &&
        p.custoMensal > 0
    )
    .map((p) => {
      const entregas = entregasPorPessoa.get(p.nome) ?? 0;
      return {
        nome: p.nome,
        vinculo: p.vinculo,
        custoMensal: p.custoMensal,
        entregas,
        custoPorEntrega:
          entregas > 0 ? Math.round((p.custoMensal / entregas) * 100) / 100 : null,
      };
    })
    .sort((a, b) => b.custoMensal - a.custoMensal);
}

// Meses que têm alguma entrega, mais recente primeiro, sempre incluindo o mês
// corrente — senão um mês ainda sem nenhuma conclusão sumiria do seletor,
// escondendo justamente o caso que mais importa (custo correndo, nada saindo).
export function mesesComEntrega(tarefas: TarefaComContexto[]): string[] {
  const meses = new Set<string>([hojeISO().slice(0, 7)]);
  for (const t of tarefas) {
    const mes = mesDeConclusao(t);
    if (mes) meses.add(mes);
  }
  return Array.from(meses).sort((a, b) => b.localeCompare(a));
}

export function formatMes(mesISO: string): string {
  const [ano, mes] = mesISO.split("-").map(Number);
  if (!ano || !mes) return mesISO;
  const rotulo = new Date(Date.UTC(ano, mes - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

// ---------------------------------------------------------------------------
// LUCRO POR CLIENTE (Fase 2) — margem de contribuição, não lucro final.
//
// Junta as três fontes de dinheiro que o sistema já conhece:
//   receita        `clientes.valorMensal`
//   custo direto   `tarefas.custoExecucao` (quem é pago por entrega)
//   custo rateado  o custo fixo mensal de cada pessoa/fornecedor, dividido
//                  igualmente entre as missões que ela concluiu no mês e
//                  atribuído ao cliente de cada uma
//
// É margem de CONTRIBUIÇÃO porque não desconta o tempo de quem não emite nota
// (dono e sócio sem pró-labore lançado): diz se o cliente paga os custos
// diretos dele, não se paga a operação inteira. O nome importa — lido como
// "lucro", o número parece maior do que é.
//
// Dois custos ficam de fora do rateio de propósito, e são devolvidos à parte em
// vez de sumirem dentro da margem de alguém:
//   `custoOcioso`     custo fixo de quem não entregou nada no mês
//   `custoSemCliente` custo de entregas sem cliente resolvido
// ---------------------------------------------------------------------------

export interface ClienteComReceita {
  id: string;
  nome: string;
  valorMensal?: number;
}

export interface LucroCliente {
  clienteId: string;
  nome: string;
  receita: number | null; // null = sem valor mensal cadastrado
  custoDireto: number;
  custoRateado: number;
  custoTotal: number;
  margem: number | null; // null sempre que a receita for null
  margemPercentual: number | null;
  entregas: number;
}

export interface LucroNoMes {
  porCliente: LucroCliente[];
  custoOcioso: number;
  custoSemCliente: number;
  // Soma das margens conhecidas menos os dois custos que não couberam em
  // nenhum cliente. É o bolo que sobra no mês — e, quando alguém do time é
  // remunerado por divisão de resultado, é literalmente de onde sai o
  // pagamento dessa pessoa.
  resultado: number;
  // Quantos clientes ficaram fora de `resultado` por não ter valor mensal
  // cadastrado: com isso > 0, o resultado está subestimado, e a UI avisa.
  clientesSemReceita: number;
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function somarNoMapa(mapa: Map<string, number>, chave: string, valor: number): void {
  mapa.set(chave, (mapa.get(chave) ?? 0) + valor);
}

export function lucroPorClienteNoMes(
  tarefas: TarefaComContexto[],
  clientes: ClienteComReceita[],
  pessoas: PessoaComCusto[],
  mesISO: string
): LucroNoMes {
  const entregas = tarefas.filter((t) => mesDeConclusao(t) === mesISO);

  const custoRateado = new Map<string, number>();
  const custoDireto = new Map<string, number>();
  const entregasPorCliente = new Map<string, number>();
  let custoOcioso = 0;
  let custoSemCliente = 0;

  // Rateio do custo fixo: dividido igualmente entre as entregas do mês daquela
  // pessoa. Divisão por entrega (e não por horas) é o que os dados sustentam
  // hoje — quando houver horas reais, esta é a linha a trocar.
  for (const p of pessoas) {
    if (p.vinculo === null || !VINCULOS_CUSTO_FIXO.includes(p.vinculo)) continue;
    if (p.custoMensal === undefined || p.custoMensal <= 0) continue;
    const suasEntregas = entregas.filter((t) => t.quem === p.nome);
    if (suasEntregas.length === 0) {
      custoOcioso += p.custoMensal;
      continue;
    }
    const fatia = p.custoMensal / suasEntregas.length;
    for (const t of suasEntregas) {
      if (!t.cliente) custoSemCliente += fatia;
      else somarNoMapa(custoRateado, t.cliente.id, fatia);
    }
  }

  for (const t of entregas) {
    if (t.cliente) somarNoMapa(entregasPorCliente, t.cliente.id, 1);
    const custo = t.custoExecucao ?? 0;
    if (custo <= 0) continue;
    if (!t.cliente) custoSemCliente += custo;
    else somarNoMapa(custoDireto, t.cliente.id, custo);
  }

  const porCliente = clientes.map((c) => {
    const direto = arredondar(custoDireto.get(c.id) ?? 0);
    const rateado = arredondar(custoRateado.get(c.id) ?? 0);
    const custoTotal = arredondar(direto + rateado);
    const receita = c.valorMensal ?? null;
    const margem = receita === null ? null : arredondar(receita - custoTotal);
    return {
      clienteId: c.id,
      nome: c.nome,
      receita,
      custoDireto: direto,
      custoRateado: rateado,
      custoTotal,
      margem,
      margemPercentual:
        receita !== null && receita > 0 && margem !== null
          ? Math.round((margem / receita) * 100)
          : null,
      entregas: entregasPorCliente.get(c.id) ?? 0,
    };
  });

  // Pior margem primeiro: a lista existe para decidir o que renegociar, e quem
  // não tem receita cadastrada não é comparável — vai para o fim.
  porCliente.sort((a, b) => {
    if (a.margem === null && b.margem === null) return a.nome.localeCompare(b.nome);
    if (a.margem === null) return 1;
    if (b.margem === null) return -1;
    return a.margem - b.margem;
  });

  const margensConhecidas = porCliente.filter((c) => c.margem !== null);
  const resultado =
    margensConhecidas.reduce((soma, c) => soma + (c.margem ?? 0), 0) -
    custoOcioso -
    custoSemCliente;

  return {
    porCliente,
    custoOcioso: arredondar(custoOcioso),
    custoSemCliente: arredondar(custoSemCliente),
    resultado: arredondar(resultado),
    clientesSemReceita: porCliente.length - margensConhecidas.length,
  };
}
