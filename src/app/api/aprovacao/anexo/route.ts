import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

// Rota pública de propósito (sem exigirLogin) — quem chama é a página
// /aprovar/[token], sem sessão. A segurança não vem de login: vem de
// aprovacao_anexos() já confirmar, no banco, que o anexo pertence ao cliente
// do token antes de qualquer link ser gerado.

interface CorpoRequisicao {
  token: string;
  tarefaId: string;
  anexoId: string;
}

interface AnexoRow {
  id: string;
  nome: string;
  caminho: string;
}

export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => null)) as CorpoRequisicao | null;
  if (!corpo?.token || !corpo.tarefaId || !corpo.anexoId) {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ erro: "Configuração do servidor incompleta." }, { status: 500 });
  }
  const supabaseAnon = createSupabaseClient(url, anonKey);

  const { data, error } = await supabaseAnon.rpc("aprovacao_anexos", {
    p_token: corpo.token,
    p_tarefa_id: corpo.tarefaId,
  });
  if (error) {
    console.error("Erro ao validar anexo na aprovação:", error.message);
    return NextResponse.json({ erro: "Não foi possível validar o anexo." }, { status: 500 });
  }

  const anexo = (data as AnexoRow[] | null)?.find((a) => a.id === corpo.anexoId);
  if (!anexo) {
    // Ou o token é inválido, ou a missão não é desse cliente, ou o anexo não
    // existe — em qualquer caso, a resposta é a mesma pra não vazar qual.
    return NextResponse.json({ erro: "Anexo não encontrado." }, { status: 404 });
  }

  try {
    const supabaseService = createServiceRoleClient();
    const { data: assinado, error: erroAssinatura } = await supabaseService.storage
      .from("anexos")
      .createSignedUrl(anexo.caminho, 60);
    if (erroAssinatura || !assinado) {
      console.error("Erro ao gerar link do anexo:", erroAssinatura?.message);
      return NextResponse.json({ erro: "Não foi possível gerar o link." }, { status: 500 });
    }
    return NextResponse.json({ url: assinado.signedUrl });
  } catch (erro) {
    console.error("Erro inesperado ao gerar link do anexo:", erro);
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Erro inesperado." },
      { status: 500 }
    );
  }
}
