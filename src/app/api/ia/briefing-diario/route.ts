import { NextResponse } from "next/server";
import { exigirLogin } from "@/lib/api-auth";
import { chamarClaude, ErroIA, MODELO_RAPIDO } from "@/lib/claude-server";

interface ItemBriefing {
  titulo: string;
  cliente: string;
  status: string;
  diasDeAtraso?: number;
  bloqueio?: string;
}

interface CorpoRequisicao {
  usuarioAtual: string;
  bloqueadas: ItemBriefing[];
  atrasadas: ItemBriefing[];
  minhaAcao: ItemBriefing[];
  proximas: ItemBriefing[];
}

function formatarLista(itens: ItemBriefing[]): string {
  if (itens.length === 0) return "(nenhuma)";
  return itens
    .map((i) => {
      const extras = [
        i.diasDeAtraso ? `${i.diasDeAtraso}d de atraso` : null,
        i.bloqueio ? `bloqueio: ${i.bloqueio}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `- "${i.titulo}" (${i.cliente}, ${i.status}${extras ? `, ${extras}` : ""})`;
    })
    .join("\n");
}

export async function POST(request: Request) {
  const negado = await exigirLogin();
  if (negado) return negado;

  const corpo = (await request.json().catch(() => null)) as CorpoRequisicao | null;
  if (!corpo || typeof corpo.usuarioAtual !== "string") {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const prompt = `Missões bloqueadas:
${formatarLista(corpo.bloqueadas)}

Missões atrasadas (mais antigas primeiro):
${formatarLista(corpo.atrasadas)}

Aguardando ação de ${corpo.usuarioAtual}:
${formatarLista(corpo.minhaAcao)}

Prazo nos próximos 2 dias:
${formatarLista(corpo.proximas)}`;

  try {
    const texto = await chamarClaude({
      model: MODELO_RAPIDO,
      maxTokens: 350,
      system:
        "Você escreve o briefing do dia para um colaborador de agência de marketing, em português brasileiro. " +
        "3 a 5 frases corridas (sem lista, sem markdown), direto ao ponto, priorizando o que é mais urgente primeiro. " +
        "Se uma categoria estiver vazia, não precisa mencioná-la. Tom profissional e direto, nunca alarmista. " +
        "Não invente dado que não foi dado a você.",
      prompt,
    });
    return NextResponse.json({ texto });
  } catch (erro) {
    if (erro instanceof ErroIA) {
      return NextResponse.json({ erro: erro.message }, { status: 503 });
    }
    console.error("Erro inesperado em /api/ia/briefing-diario:", erro);
    return NextResponse.json({ erro: "Erro inesperado ao gerar o briefing." }, { status: 500 });
  }
}
