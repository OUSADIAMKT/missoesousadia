import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente com a service_role key — IGNORA TODA RLS do banco. Só existe pra
// UMA coisa: gerar o link assinado de um anexo já validado por
// aprovacao_anexos() (função no banco que confirma que o anexo pertence ao
// cliente do token) na rota /api/aprovacao/anexo. Não importe isto em mais
// nenhum lugar — qualquer outra necessidade de servidor usa o cliente normal
// (src/lib/supabase/server.ts), que respeita RLS.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente do servidor — veja .env.local.example."
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
