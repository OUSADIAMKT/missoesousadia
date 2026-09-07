import { test } from "node:test";
import assert from "node:assert/strict";
import type { Status, TarefaComContexto, Vinculo } from "./types.ts";
import {
  custoPorEntregaNoMes,
  formatMes,
  mesesComEntrega,
  type PessoaComCusto,
} from "./performance-metrics.ts";

// Uma missão mínima: só o que `custoPorEntregaNoMes` olha (quem, status e a
// data da última mudança de status, de onde sai a data de conclusão).
function missao(quem: string, status: Status, concluidaEm: string): TarefaComContexto {
  return {
    id: `${quem}-${concluidaEm}-${status}`,
    titulo: "Missão",
    projetoId: "p1",
    descricao: "",
    dataRegistro: "2026-08-01",
    dataInicio: "2026-08-01",
    prazoEntrega: "2026-09-30",
    prioridade: "Normal",
    complexidade: "Simples",
    status,
    quem,
    bloqueios: [],
    historico: [
      { id: "h1", statusAnterior: "Em Andamento", statusNovo: status, usuario: quem, data: `${concluidaEm}T12:00:00.000Z` },
    ],
    projeto: undefined,
    cliente: undefined,
  };
}

function pessoa(nome: string, vinculo: Vinculo | null, custoMensal?: number): PessoaComCusto {
  return { nome, vinculo, custoMensal };
}

const mesAtual = new Date().toISOString().slice(0, 7);

test("custoPorEntregaNoMes divide o pacote fechado pelas entregas do mês", () => {
  const tarefas = [
    missao("Produtora", "Concluído", "2026-09-03"),
    missao("Produtora", "Aprovado", "2026-09-20"),
  ];
  const [linha] = custoPorEntregaNoMes(tarefas, [pessoa("Produtora", "fornecedor", 3000)], "2026-09");
  assert.equal(linha.entregas, 2);
  assert.equal(linha.custoPorEntrega, 1500);
});

test("custoPorEntregaNoMes ignora entregas de outros meses", () => {
  const tarefas = [
    missao("Produtora", "Concluído", "2026-08-28"),
    missao("Produtora", "Concluído", "2026-09-02"),
  ];
  const [linha] = custoPorEntregaNoMes(tarefas, [pessoa("Produtora", "fornecedor", 3000)], "2026-09");
  assert.equal(linha.entregas, 1);
  assert.equal(linha.custoPorEntrega, 3000);
});

test("custoPorEntregaNoMes não conta missão que ainda não foi concluída", () => {
  const tarefas = [
    missao("Produtora", "Em Andamento", "2026-09-05"),
    missao("Produtora", "Aguardando Cliente", "2026-09-06"),
  ];
  const [linha] = custoPorEntregaNoMes(tarefas, [pessoa("Produtora", "fornecedor", 3000)], "2026-09");
  assert.equal(linha.entregas, 0);
});

// O caso que justifica a métrica existir: o custo correu e não comprou nada.
// `null` é diferente de zero — a UI precisa distinguir para poder alertar.
test("custoPorEntregaNoMes devolve null (não zero) quando o mês não teve entrega", () => {
  const [linha] = custoPorEntregaNoMes([], [pessoa("Produtora", "fornecedor", 3000)], "2026-09");
  assert.equal(linha.entregas, 0);
  assert.equal(linha.custoPorEntrega, null);
  assert.equal(linha.custoMensal, 3000);
});

test("custoPorEntregaNoMes deixa de fora quem não tem vínculo ou custo lançado", () => {
  const tarefas = [missao("Eliseu", "Concluído", "2026-09-10")];
  const pessoas = [
    pessoa("Sem classificação", null, 2000),
    pessoa("Sem custo", "fornecedor"),
    pessoa("Eliseu", "por_projeto", 800), // custo é por entrega, não mensal
    pessoa("Sócia sem pró-labore", "socio", 0),
  ];
  assert.deepEqual(custoPorEntregaNoMes(tarefas, pessoas, "2026-09"), []);
});

test("custoPorEntregaNoMes ordena do custo fixo mais caro para o mais barato", () => {
  const pessoas = [pessoa("Barato", "fornecedor", 500), pessoa("Caro", "clt", 4000)];
  const nomes = custoPorEntregaNoMes([], pessoas, "2026-09").map((l) => l.nome);
  assert.deepEqual(nomes, ["Caro", "Barato"]);
});

// Meses fixos no passado de propósito: o mês corrente entra sempre (ver o teste
// seguinte), então usar datas de "agora" faria o resultado depender do dia em
// que a suíte roda.
test("mesesComEntrega lista do mais recente para o mais antigo", () => {
  const tarefas = [
    missao("A", "Concluído", "2024-07-15"),
    missao("B", "Concluído", "2024-09-01"),
    missao("C", "Concluído", "2024-08-20"),
  ];
  const meses = mesesComEntrega(tarefas).filter((m) => m !== mesAtual);
  assert.deepEqual(meses, ["2024-09", "2024-08", "2024-07"]);
});

// Sem isso, um mês em que nada foi entregue sumiria do seletor — escondendo
// justamente o caso de custo parado que a métrica existe para revelar.
test("mesesComEntrega sempre inclui o mês corrente, mesmo sem entregas", () => {
  assert.deepEqual(mesesComEntrega([]), [mesAtual]);
});

test("formatMes devolve o mês por extenso com inicial maiúscula", () => {
  assert.equal(formatMes("2026-09"), "Setembro de 2026");
});

test("formatMes devolve a entrada crua se não for um mês válido", () => {
  assert.equal(formatMes("sem-mes"), "sem-mes");
});
