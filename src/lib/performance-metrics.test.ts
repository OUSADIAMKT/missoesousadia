import { test } from "node:test";
import assert from "node:assert/strict";
import type { Cliente, Status, TarefaComContexto, Vinculo } from "./types.ts";
import {
  custoPorEntregaNoMes,
  formatMes,
  lucroPorClienteNoMes,
  mesesComEntrega,
  type PessoaComCusto,
} from "./performance-metrics.ts";

// Uma missão mínima: quem, status e a data da última mudança de status (de onde
// sai a data de conclusão), mais o cliente e o custo direto que o cálculo de
// lucro precisa.
function missao(
  quem: string,
  status: Status,
  concluidaEm: string,
  extras: { cliente?: Cliente; custoExecucao?: number } = {}
): TarefaComContexto {
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
    custoExecucao: extras.custoExecucao,
    tags: [],
    bloqueios: [],
    historico: [
      { id: "h1", statusAnterior: "Em Andamento", statusNovo: status, usuario: quem, data: `${concluidaEm}T12:00:00.000Z` },
    ],
    projeto: undefined,
    cliente: extras.cliente,
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

// --- lucroPorClienteNoMes ---------------------------------------------------

const ekilibre: Cliente = { id: "c1", nome: "Ekilibre", valorMensal: 3000 };
const flix: Cliente = { id: "c2", nome: "FLIX", valorMensal: 1000 };

test("lucroPorClienteNoMes rateia o custo fixo entre as entregas do mês", () => {
  // Pacote de R$ 3.000 e 3 entregas: 2 para a Ekilibre, 1 para a FLIX.
  const tarefas = [
    missao("Produtora", "Concluído", "2026-09-05", { cliente: ekilibre }),
    missao("Produtora", "Aprovado", "2026-09-12", { cliente: ekilibre }),
    missao("Produtora", "Concluído", "2026-09-18", { cliente: flix }),
  ];
  const { porCliente } = lucroPorClienteNoMes(
    tarefas,
    [ekilibre, flix],
    [pessoa("Produtora", "fornecedor", 3000)],
    "2026-09"
  );
  const porNome = Object.fromEntries(porCliente.map((c) => [c.nome, c]));
  assert.equal(porNome.Ekilibre.custoRateado, 2000);
  assert.equal(porNome.Ekilibre.margem, 1000);
  assert.equal(porNome.FLIX.custoRateado, 1000);
  assert.equal(porNome.FLIX.margem, 0);
});

test("lucroPorClienteNoMes soma o custo direto de quem é pago por entrega", () => {
  const tarefas = [
    missao("Eliseu", "Concluído", "2026-09-08", { cliente: ekilibre, custoExecucao: 800 }),
    missao("Eliseu", "Concluído", "2026-09-22", { cliente: ekilibre, custoExecucao: 700 }),
  ];
  const [linha] = lucroPorClienteNoMes(
    tarefas,
    [ekilibre],
    [pessoa("Eliseu", "por_projeto")],
    "2026-09"
  ).porCliente;
  assert.equal(linha.custoDireto, 1500);
  assert.equal(linha.custoRateado, 0);
  assert.equal(linha.margem, 1500);
  assert.equal(linha.margemPercentual, 50);
});

// O caso que decide contrato: o cliente custa mais do que paga.
test("lucroPorClienteNoMes devolve margem negativa quando o cliente dá prejuízo", () => {
  const tarefas = [missao("Eliseu", "Concluído", "2026-09-08", { cliente: flix, custoExecucao: 1800 })];
  const [linha] = lucroPorClienteNoMes(
    tarefas,
    [flix],
    [pessoa("Eliseu", "por_projeto")],
    "2026-09"
  ).porCliente;
  assert.equal(linha.margem, -800);
  assert.equal(linha.margemPercentual, -80);
});

test("lucroPorClienteNoMes ordena da pior margem para a melhor", () => {
  const tarefas = [missao("Eliseu", "Concluído", "2026-09-08", { cliente: flix, custoExecucao: 1800 })];
  const nomes = lucroPorClienteNoMes(tarefas, [ekilibre, flix], [], "2026-09").porCliente.map(
    (c) => c.nome
  );
  assert.deepEqual(nomes, ["FLIX", "Ekilibre"]);
});

// Custo fixo de quem não entregou nada não pode ser diluído entre os clientes:
// isso faria a margem de todo mundo parecer melhor do que é.
test("lucroPorClienteNoMes separa o custo fixo de quem não entregou nada", () => {
  const tarefas = [missao("Produtora", "Concluído", "2026-09-05", { cliente: ekilibre })];
  const resultado = lucroPorClienteNoMes(
    tarefas,
    [ekilibre],
    [pessoa("Produtora", "fornecedor", 3000), pessoa("Parado", "clt", 2000)],
    "2026-09"
  );
  assert.equal(resultado.custoOcioso, 2000);
  assert.equal(resultado.porCliente[0].custoRateado, 3000);
});

test("lucroPorClienteNoMes separa o custo de entrega sem cliente", () => {
  const tarefas = [
    missao("Produtora", "Concluído", "2026-09-05", { cliente: ekilibre }),
    missao("Produtora", "Concluído", "2026-09-06"), // sem cliente resolvido
  ];
  const resultado = lucroPorClienteNoMes(
    tarefas,
    [ekilibre],
    [pessoa("Produtora", "fornecedor", 3000)],
    "2026-09"
  );
  assert.equal(resultado.custoSemCliente, 1500);
  assert.equal(resultado.porCliente[0].custoRateado, 1500);
});

test("lucroPorClienteNoMes deixa a margem nula para cliente sem valor mensal", () => {
  const semValor: Cliente = { id: "c3", nome: "Sem contrato" };
  const [linha] = lucroPorClienteNoMes([], [semValor], [], "2026-09").porCliente;
  assert.equal(linha.receita, null);
  assert.equal(linha.margem, null);
  assert.equal(linha.margemPercentual, null);
});

test("lucroPorClienteNoMes inclui cliente que não teve nenhuma entrega no mês", () => {
  const [linha] = lucroPorClienteNoMes([], [ekilibre], [], "2026-09").porCliente;
  assert.equal(linha.entregas, 0);
  assert.equal(linha.custoTotal, 0);
  assert.equal(linha.margem, 3000);
});

test("lucroPorClienteNoMes ignora missão concluída em outro mês", () => {
  const tarefas = [missao("Eliseu", "Concluído", "2026-08-30", { cliente: ekilibre, custoExecucao: 900 })];
  const [linha] = lucroPorClienteNoMes(tarefas, [ekilibre], [], "2026-09").porCliente;
  assert.equal(linha.custoDireto, 0);
  assert.equal(linha.entregas, 0);
});

test("lucroPorClienteNoMes soma o resultado do mês descontando o custo ocioso", () => {
  // Ekilibre R$ 3.000 e FLIX R$ 1.000 de receita; R$ 1.500 pagos ao Eliseu na
  // missão da Ekilibre; R$ 2.000 de custo fixo de quem não entregou nada.
  const tarefas = [
    missao("Eliseu", "Concluído", "2026-09-08", { cliente: ekilibre, custoExecucao: 1500 }),
  ];
  const resultado = lucroPorClienteNoMes(
    tarefas,
    [ekilibre, flix],
    [pessoa("Eliseu", "por_projeto"), pessoa("Parado", "clt", 2000)],
    "2026-09"
  );
  // (3000 - 1500) + (1000 - 0) - 2000 de custo ocioso
  assert.equal(resultado.resultado, 500);
  assert.equal(resultado.clientesSemReceita, 0);
});

test("lucroPorClienteNoMes conta quantos clientes ficaram fora do resultado", () => {
  const semValor: Cliente = { id: "c3", nome: "Sem contrato" };
  const resultado = lucroPorClienteNoMes([], [ekilibre, semValor], [], "2026-09");
  assert.equal(resultado.resultado, 3000);
  assert.equal(resultado.clientesSemReceita, 1);
});
