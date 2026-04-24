import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export async function POST(req: NextRequest) {
  const { brand, tema } = await req.json();

  if (!brand) {
    return NextResponse.json({ error: "Marca obrigatória." }, { status: 400 });
  }

  const context = tema?.trim()
    ? `O usuário começou a digitar: "${tema}". Gere 5 variações ou expansões desse tema.`
    : `O usuário não digitou nada. Gere 5 ideias de tema originais baseadas no contexto da marca.`;

  const prompt = `
Você é um especialista em marketing digital brasileiro.
Sugira exatamente 5 ideias de tema para um post de redes sociais para a marca abaixo.

Marca: ${brand.name}
Segmento: ${brand.segment}
Tom de voz: ${brand.tone}
Estilo visual: ${brand.visual_style}

${context}

Regras:
- Cada tema deve ser curto (máximo 8 palavras), direto e impactante
- Devem ser específicos para essa marca e segmento
- Em português do Brasil com acentuação correta
- Sem numeração, sem bullets, apenas o texto do tema

Retorne APENAS um JSON array com 5 strings, sem markdown:
["tema 1", "tema 2", "tema 3", "tema 4", "tema 5"]
`.trim();

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.find((p: { text?: string }) => p.text)?.text;

    if (!text) throw new Error("Sem resposta da IA");

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const suggestions: string[] = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    return NextResponse.json({ suggestions: suggestions.slice(0, 5) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
