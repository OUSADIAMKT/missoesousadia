import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Troca o código do OAuth do Google pela sessão do Supabase e redireciona
// de volta para o app. Chamado pelo próprio Supabase após o login.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const proximaRota = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${proximaRota}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=auth`);
}
