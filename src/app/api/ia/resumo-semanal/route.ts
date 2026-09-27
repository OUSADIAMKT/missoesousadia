import { NextResponse } from "next/server";
import { exigirLogin } from "@/lib/api-auth";
import { chamarClaude, ErroIA, MODELO_QUALIDADE } from "@/lib/claude-server";

interface CargaPessoa {
  nome: string;
  qtd: number;
  sobrecarregada: boolean;
}

interface CustoEntrega {
  nome: string;
  custoPorEntrega: number | null;
  entregas: number;
}

interface LucroCliente {
  nome: string;
  margem: number | null;
  entregas: number;
}

interface CorpoRequisicao {
  mesReferencia: string; // rótulo já formatado, ex.: "Setembro de 2026"
  total: number;
  taxaConclusao: number;
  emAndamento: number;
  emRisco: number;
  carga: CargaPessoa[];
  custosPorEntrega: CustoEntrega[];
  lucroPorCliente: LucroCliente[];
  resultadoDoMes: number;
  clienteLider?: { nome: string; pctMissoes: number };
}

export async function POST(request: Request) {
  const negado = await exigirLogin();
  if (negado) return negado;

  const corpo = (await request.json().catch(() => null)) as CorpoRequisicao | null;
  if (!corpo || typeof corpo.total !== "number") {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const sobrecarregados = corpo.carga.filter((c) => c.sobrecarregada).map((c) => c.nome);
  const custoOcioso = corpo.custosPorEntrega.filter((c) => c.entregas === 0).map((c) => c.nome);
  const clientesNoPrejuizo = corpo.lucroPorCliente
    .filter((c) => c.margem !== null && c.margem < 0)
    .map((c) => c.nome);

  const prompt = `Snapshot atual da operação — ${corpo.mesReferencia} (não é uma comparação com semanas anteriores, é uma foto de agora):

- ${corpo.total} missões no total, ${corpo.taxaConclusao}% de taxa de conclusão, ${corpo.emAndamento} em andamento, ${corpo.emRisco} em ajuste/risco.
- Carga por pessoa: ${corpo.carga.map((c) => `${c.nome} (${c.qtd} ativas${c.sobrecarregada ? ", ACIMA da média do time" : ""})`).join("; ") || "sem dados"}.
- Pessoas sobrecarregadas: ${sobrecarregados.join(", ") || "nenhuma"}.
- Custo fixo sem nenhuma entrega no mês (correndo à toa): ${custoOcioso.join(", ") || "nenhum"}.
- Lucro por cliente (margem de contribuição): ${corpo.lucroPorCliente.map((c) => `${c.nome}: ${c.margem === null ? "sem receita cadastrada" : `R$ ${c.margem.toFixed(2)}`}`).join("; ") || "sem dados"}.
- Clientes com margem negativa: ${clientesNoPrejuizo.join(", ") || "nenhum"}.
- Resultado do mês (soma das margens menos custo ocioso e sem cliente): R$ ${corpo.resultadoDoMes.toFixed(2)}.
${corpo.clienteLider ? `- Cliente mais concentrado: ${corpo.clienteLider.nome} (${corpo.clienteLider.pctMissoes}% das missões).` : ""}`;

  try {
    const texto = await chamarClaude({
      model: MODELO_QUALIDADE,
      maxTokens: 500,
      system:
        "Você escreve um resumo executivo curto, em português brasileiro, para o dono de uma agência de marketing " +
        "olhar os números da operação. 3 a 5 frases corridas (sem lista, sem markdown), indo direto aos riscos e " +
        "pontos que merecem atenção — não repita todos os números, destaque o que importa decidir. Deixe claro que " +
        "é uma foto do momento atual, não uma tendência ao longo do tempo (o sistema não guarda histórico ainda). " +
        "Não invente nenhum dado além do que foi passado.",
      prompt,
    });
    return NextResponse.json({ texto });
  } catch (erro) {
    if (erro instanceof ErroIA) {
      return NextResponse.json({ erro: erro.message }, { status: 503 });
    }
    console.error("Erro inesperado em /api/ia/resumo-semanal:", erro);
    return NextResponse.json({ erro: "Erro inesperado ao gerar o resumo." }, { status: 500 });
  }
}
