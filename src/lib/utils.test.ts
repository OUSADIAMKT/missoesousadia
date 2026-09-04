import { test } from "node:test";
import assert from "node:assert/strict";
import { STATUSES, PRIORIDADES } from "./types.ts";
import {
  corPrioridade,
  corResponsavel,
  corStatus,
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  idClienteSeed,
  idProjetoPadraoSeed,
  iniciais,
  isAtrasada,
  isProximaDoPrazo,
  uid,
} from "./utils.ts";

function isoOffset(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

test("formatDateBR converte ISO para dd/mm/aaaa", () => {
  assert.equal(formatDateBR("2026-09-04"), "04/09/2026");
});

test("formatDateBR devolve travessão para string vazia", () => {
  assert.equal(formatDateBR(""), "—");
});

test("formatDateTimeBR devolve travessão para entrada vazia ou inválida", () => {
  assert.equal(formatDateTimeBR(""), "—");
  assert.equal(formatDateTimeBR("não é uma data"), "—");
});

test("formatDateTimeBR formata um datetime ISO válido", () => {
  const resultado = formatDateTimeBR("2026-09-04T15:30:00.000Z");
  assert.notEqual(resultado, "—");
  assert.match(resultado, /2026/);
});

test("isAtrasada é true para prazo no passado em status ativo", () => {
  assert.equal(isAtrasada(isoOffset(-3), "A Fazer"), true);
});

test("isAtrasada é false para prazo no futuro", () => {
  assert.equal(isAtrasada(isoOffset(3), "A Fazer"), false);
});

test("isAtrasada ignora prazo passado quando a missão já está Concluído ou Aprovado", () => {
  assert.equal(isAtrasada(isoOffset(-3), "Concluído"), false);
  assert.equal(isAtrasada(isoOffset(-3), "Aprovado"), false);
});

test("isProximaDoPrazo é true dentro da janela de 2 dias", () => {
  assert.equal(isProximaDoPrazo(isoOffset(1), "A Fazer"), true);
});

test("isProximaDoPrazo é false fora da janela ou já atrasada", () => {
  assert.equal(isProximaDoPrazo(isoOffset(10), "A Fazer"), false);
  assert.equal(isProximaDoPrazo(isoOffset(-1), "A Fazer"), false);
});

test("isProximaDoPrazo ignora status Concluído/Aprovado", () => {
  assert.equal(isProximaDoPrazo(isoOffset(1), "Concluído"), false);
});

test("iniciais pega a primeira letra de nome e sobrenome", () => {
  assert.equal(iniciais("Ana Souza"), "AS");
});

test("iniciais usa as duas primeiras letras quando só há um nome", () => {
  assert.equal(iniciais("Madonna"), "MA");
});

test("iniciais devolve '?' para nome vazio", () => {
  assert.equal(iniciais(""), "?");
  assert.equal(iniciais("   "), "?");
});

test("corResponsavel é determinístico para o mesmo nome", () => {
  assert.equal(corResponsavel("Jackson"), corResponsavel("Jackson"));
});

test("corStatus cobre todos os STATUSES sem lançar erro", () => {
  for (const status of STATUSES) {
    assert.match(corStatus(status), /border-/);
  }
});

test("corPrioridade cobre todas as PRIORIDADES sem lançar erro", () => {
  for (const prioridade of PRIORIDADES) {
    assert.match(corPrioridade(prioridade), /border-/);
  }
});

test("formatBRL formata em real brasileiro", () => {
  const resultado = formatBRL(1500);
  assert.ok(resultado.startsWith("R$"));
  assert.ok(resultado.includes("1.500,00"));
});

test("idClienteSeed e idProjetoPadraoSeed geram slugs estáveis e sem acento", () => {
  assert.equal(idClienteSeed("Ekilibre"), "cliente-ekilibre");
  assert.equal(idProjetoPadraoSeed("Ekilibre"), "projeto-ekilibre-geral");
  assert.equal(idClienteSeed("Interno / Ousadia"), "cliente-interno-ousadia");
});

test("uid gera strings diferentes a cada chamada", () => {
  const a = uid();
  const b = uid();
  assert.notEqual(a, b);
  assert.ok(a.length > 0);
});
