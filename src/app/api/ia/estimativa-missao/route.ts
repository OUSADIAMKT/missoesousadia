import { NextResponse } from "next/server";
import { PRIORIDADES, COMPLEXIDADES } from "@/lib/types";
import { exigirLogin } from "@/lib/api-auth";
import { chamarClaude, extrairJSON, ErroIA, MODELO_RAPIDO } from "@/lib/claude-server";

interface MissaoHistorico {
  titulo: string;
  complexidade: string;
  prioridade: string;
  horasEstimadas?: number;
}

interface CorpoRequisicao {
  titulo: string;
  descricao: string;
  tags: string[];
  cliente: string;
  historico: MissaoHistorico[];
}

interface EstimativaResposta {
  prioridade: string;
  complexidade: string;
  horasEstimadas: number;
  justificativa: string;
}

function formatarHistorico(historico: MissaoHistorico[]): string {
  if (historico.length === 0) return "(sem histórico de missões concluídas para comparar ainda)";
  return historico
    .slice(0, 15)
    .map(
      (m) =>
        `- "${m.titulo}" — ${m.complexidade}, prioridade ${m.prioridade}${
          m.horasEstimadas ? `, ${m.horasEstimadas}h` : ""
        }`
    )
    .join("\n");
}

export async function POST(request: Request) {
  const negado = await exigirLogin();
  if (negado) return negado;

  const corpo = (await request.json().catch(() => null)) as CorpoRequisicao | null;
  if (!corpo || typeof corpo.titulo !== "string" || !corpo.titulo.trim()) {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const prompt = `Nova missão a estimar:
Título: ${corpo.titulo}
Cliente: ${corpo.cliente || "não informado"}
Tags: ${corpo.tags?.length ? corpo.tags.join(", ") : "nenhuma"}
Descrição: ${corpo.descricao?.trim() || "(sem descrição)"}

Missões parecidas já registradas, para calibrar (mais recentes primeiro):
${formatarHistorico(corpo.historico)}

Responda APENAS com um JSON válido, sem texto antes ou depois, sem markdown, neste formato exato:
{"prioridade": "Baixa|Normal|Alta|Urgente", "complexidade": "Simples|Média|Complexa", "horasEstimadas": <número>, "justificativa": "<1 frase curta>"}`;

  try {
    const texto = await chamarClaude({
      model: MODELO_RAPIDO,
      maxTokens: 300,
      system:
        "Você estima esforço de missões de uma agência de marketing (posts, vídeos, anúncios, roteiros etc.) " +
        "a partir do título/descrição e, quando disponível, de missões parecidas já registradas. " +
        "horasEstimadas é um número (pode ter meio, ex.: 2.5). Responda só o JSON pedido, nada além disso.",
      prompt,
    });

    const estimativa = extrairJSON<EstimativaResposta>(texto);

    if (
      !PRIORIDADES.includes(estimativa.prioridade as (typeof PRIORIDADES)[number]) ||
      !COMPLEXIDADES.includes(estimativa.complexidade as (typeof COMPLEXIDADES)[number]) ||
      typeof estimativa.horasEstimadas !== "number" ||
      !(estimativa.horasEstimadas > 0)
    ) {
      throw new ErroIA("A IA respondeu com valores fora do esperado.");
    }

    return NextResponse.json(estimativa);
  } catch (erro) {
    if (erro instanceof ErroIA) {
      return NextResponse.json({ erro: erro.message }, { status: 503 });
    }
    console.error("Erro inesperado em /api/ia/estimativa-missao:", erro);
    return NextResponse.json({ erro: "Erro inesperado ao gerar a estimativa." }, { status: 500 });
  }
}
