import { NextResponse } from "next/server";
import { exigirLogin } from "@/lib/api-auth";
import { chamarClaude, ErroIA, MODELO_RAPIDO } from "@/lib/claude-server";

interface ComentarioResumo {
  autor: string;
  texto: string;
}

interface BloqueioResumo {
  motivo: string;
  resolvido: boolean;
}

interface CorpoRequisicao {
  titulo: string;
  comentarios: ComentarioResumo[];
  bloqueios: BloqueioResumo[];
}

export async function POST(request: Request) {
  const negado = await exigirLogin();
  if (negado) return negado;

  const corpo = (await request.json().catch(() => null)) as CorpoRequisicao | null;
  if (!corpo || typeof corpo.titulo !== "string") {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const comentarios = (corpo.comentarios ?? [])
    .map((c) => `${c.autor}: ${c.texto}`)
    .join("\n");
  const bloqueios = (corpo.bloqueios ?? [])
    .map((b) => `- ${b.motivo}${b.resolvido ? " (resolvido)" : " (ainda ativo)"}`)
    .join("\n");

  const prompt = `Missão: "${corpo.titulo}"

Bloqueios registrados:
${bloqueios || "(nenhum)"}

Comentários (ordem cronológica):
${comentarios || "(nenhum)"}`;

  try {
    const texto = await chamarClaude({
      model: MODELO_RAPIDO,
      maxTokens: 250,
      system:
        "Resuma, em português brasileiro, o que já rolou numa missão de agência a partir dos comentários e " +
        "bloqueios dela. 2 a 3 frases corridas, sem lista, focando em decisões tomadas e o que ainda está em " +
        "aberto. Não invente nada que não esteja no texto.",
      prompt,
    });
    return NextResponse.json({ texto });
  } catch (erro) {
    if (erro instanceof ErroIA) {
      return NextResponse.json({ erro: erro.message }, { status: 503 });
    }
    console.error("Erro inesperado em /api/ia/resumo-missao:", erro);
    return NextResponse.json({ erro: "Erro inesperado ao gerar o resumo." }, { status: 500 });
  }
}
