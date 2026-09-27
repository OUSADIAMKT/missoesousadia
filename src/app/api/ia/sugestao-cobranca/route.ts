import { NextResponse } from "next/server";
import { exigirLogin } from "@/lib/api-auth";
import { chamarClaude, ErroIA, MODELO_RAPIDO } from "@/lib/claude-server";

interface CorpoRequisicao {
  titulo: string;
  cliente: string;
  dias: number;
}

export async function POST(request: Request) {
  const negado = await exigirLogin();
  if (negado) return negado;

  const corpo = (await request.json().catch(() => null)) as CorpoRequisicao | null;
  if (!corpo || typeof corpo.titulo !== "string" || typeof corpo.dias !== "number") {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const prompt = `Missão: "${corpo.titulo}"
Cliente: ${corpo.cliente || "não informado"}
Está esperando resposta/aprovação do cliente há ${corpo.dias} dia(s).`;

  try {
    const texto = await chamarClaude({
      model: MODELO_RAPIDO,
      maxTokens: 250,
      system:
        "Você escreve, em português brasileiro, uma mensagem curta e educada para cobrar um cliente que está " +
        "com uma aprovação pendente há um tempo. Tom cordial, profissional, sem soar impaciente ou passivo-agressivo. " +
        "2 a 4 frases, pronta para copiar e enviar por WhatsApp ou e-mail (sem saudação/despedida formais de e-mail, " +
        "só o corpo da mensagem). Não use markdown.",
      prompt,
    });
    return NextResponse.json({ texto });
  } catch (erro) {
    if (erro instanceof ErroIA) {
      return NextResponse.json({ erro: erro.message }, { status: 503 });
    }
    console.error("Erro inesperado em /api/ia/sugestao-cobranca:", erro);
    return NextResponse.json({ erro: "Erro inesperado ao gerar a sugestão." }, { status: 500 });
  }
}
