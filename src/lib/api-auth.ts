import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Trava mínima dos endpoints /api/ia/*: exige sessão Supabase válida, mesma
// checagem "otimista" do proxy.ts (só olha o cookie). Não confere de novo se
// o e-mail está em `usuarios` — quem chega até o botão que dispara isso já
// passou pela tela "Sem acesso" em page.tsx; isto aqui só impede alguém sem
// login nenhum de bater direto no endpoint e gastar chamada de IA.
export async function exigirLogin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  return null;
}
