import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TEXT_MODEL = "gemini-2.5-flash";

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const mimeType = resp.headers.get("content-type") || "image/jpeg";
    const data = Buffer.from(buffer).toString("base64");
    return { data, mimeType };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { brand, tema, referenceImages } = await req.json();

  if (!brand) {
    return NextResponse.json({ error: "Marca obrigatória." }, { status: 400 });
  }

  const context = tema?.trim()
    ? `O usuário começou a digitar: "${tema}". Gere 5 variações ou expansões desse tema.`
    : `O usuário não digitou nada. Gere 5 ideias de tema originais baseadas no contexto da marca.`;

  const textPrompt = `
Você é um especialista em marketing digital brasileiro.
Sugira exatamente 5 ideias de tema para um post de redes sociais para a marca abaixo.

Marca: ${brand.name}
Segmento: ${brand.segment}
Tom de voz: ${brand.tone}
Estilo visual: ${brand.visual_style}

${context}

${(referenceImages?.length) ? `As imagens acima são referências visuais da marca — use o estilo, ambiente e mensagem delas para inspirar os temas.` : ""}

Regras:
- Cada tema deve ser curto (máximo 8 palavras), direto e impactante
- Devem ser específicos para essa marca e segmento
- Em português do Brasil com acentuação correta
- Sem numeração, sem bullets, apenas o texto do tema

Retorne APENAS um JSON array com 5 strings, sem markdown:
["tema 1", "tema 2", "tema 3", "tema 4", "tema 5"]
`.trim();

  try {
    // Monta parts: imagens de referência + texto
    const parts: unknown[] = [];

    if (referenceImages?.length) {
      const imageResults = await Promise.all(
        (referenceImages as string[]).slice(0, 4).map(fetchImageAsBase64)
      );
      for (const img of imageResults) {
        if (img) {
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        }
      }
    }

    parts.push({ text: textPrompt });

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${resp.status} ${errData?.error?.message || resp.statusText}`);
    }
    const data = await resp.json();
    const resParts = data?.candidates?.[0]?.content?.parts || [];
    const text = resParts.find((p: { text?: string }) => p.text)?.text;

    if (!text) throw new Error("Sem resposta da IA");

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const suggestions: string[] = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    return NextResponse.json({ suggestions: suggestions.slice(0, 5) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[post/suggest]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
