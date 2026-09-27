// Ponte server-only para a Messages API da Anthropic. Chamada só de dentro de
// src/app/api/ia/*/route.ts — nunca importado por um componente "use client",
// porque ANTHROPIC_API_KEY só existe no processo do servidor (sem prefixo
// NEXT_PUBLIC_, ver .env.local.example). Fetch puro em vez do SDK oficial: é
// uma chamada HTTP só, evita mais uma dependência nova no projeto.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const MODELO_RAPIDO = "claude-haiku-4-5-20251001";
export const MODELO_QUALIDADE = "claude-sonnet-5";

export class ErroIA extends Error {}

interface ChamarClaudeOpts {
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}

export async function chamarClaude({
  system,
  prompt,
  model = MODELO_RAPIDO,
  maxTokens = 500,
}: ChamarClaudeOpts): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ErroIA(
      "IA não configurada — falta ANTHROPIC_API_KEY nas variáveis de ambiente do servidor."
    );
  }

  let resposta: Response;
  try {
    resposta = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new ErroIA("Não foi possível falar com a IA agora. Tente de novo em instantes.");
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    console.error("Erro da API da Anthropic:", resposta.status, corpo);
    throw new ErroIA("A IA recusou o pedido. Tente de novo em instantes.");
  }

  const dados = (await resposta.json()) as {
    content?: { type: string; text?: string }[];
  };
  const texto = dados.content?.find((c) => c.type === "text")?.text;
  if (!texto) {
    throw new ErroIA("A IA respondeu vazio. Tente de novo.");
  }
  return texto;
}

// Alguns endpoints pedem JSON estruturado de volta (ex.: estimativa de
// missão). Extrai o primeiro bloco {...} da resposta — cobre tanto uma
// resposta limpa quanto o caso raro de o modelo envolver em ```json.
export function extrairJSON<T>(texto: string): T {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio === -1 || fim === -1 || fim < inicio) {
    throw new ErroIA("A IA respondeu em um formato inesperado.");
  }
  try {
    return JSON.parse(texto.slice(inicio, fim + 1)) as T;
  } catch {
    throw new ErroIA("A IA respondeu em um formato inesperado.");
  }
}
