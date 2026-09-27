import { NextResponse } from "next/server";
import { exigirLogin } from "@/lib/api-auth";
import { chamarClaude, ErroIA, MODELO_QUALIDADE } from "@/lib/claude-server";

interface CorpoRequisicao {
  titulo: string;
  descricao: string;
  tags: string[];
  cliente: string;
}

export async function POST(request: Request) {
  const negado = await exigirLogin();
  if (negado) return negado;

  const corpo = (await request.json().catch(() => null)) as CorpoRequisicao | null;
  if (!corpo || typeof corpo.titulo !== "string" || !corpo.titulo.trim()) {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const prompt = `Cliente: ${corpo.cliente || "não informado"}
Título da missão: ${corpo.titulo}
Tags: ${corpo.tags?.length ? corpo.tags.join(", ") : "nenhuma"}
Descrição/briefing: ${corpo.descricao?.trim() || "(sem descrição — use só o título e as tags)"}`;

  try {
    const texto = await chamarClaude({
      model: MODELO_QUALIDADE,
      maxTokens: 900,
      system:
        "Você é redator de uma agência de marketing brasileira. A partir do título/briefing de uma entrega " +
        "(post, roteiro de vídeo, anúncio, e-mail etc.), escreva um primeiro RASCUNHO em português brasileiro — " +
        "não um plano nem explicação sobre o que fazer, e sim o texto/roteiro em si, pronto para quem for executar " +
        "revisar e ajustar. Se o tipo de entrega não ficar claro pelo título, tente inferir pelas tags. " +
        "Seja específico e usável, não genérico. Não invente dado do cliente que não foi informado.",
      prompt,
    });
    return NextResponse.json({ texto });
  } catch (erro) {
    if (erro instanceof ErroIA) {
      return NextResponse.json({ erro: erro.message }, { status: 503 });
    }
    console.error("Erro inesperado em /api/ia/rascunho-entrega:", erro);
    return NextResponse.json({ erro: "Erro inesperado ao gerar o rascunho." }, { status: 500 });
  }
}
