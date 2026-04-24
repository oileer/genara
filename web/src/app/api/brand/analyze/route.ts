import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.0-flash";

export async function POST(req: NextRequest) {
  const { name, instagram, site } = await req.json();

  if (!name || !instagram) {
    return NextResponse.json({ error: "Nome e Instagram são obrigatórios." }, { status: 400 });
  }

  const prompt = `
Você é um especialista em branding e marketing digital brasileiro.
Analise a marca "${name}" com base nas informações abaixo e extraia o máximo de contexto possível.

Instagram: @${instagram}
Site: ${site || "não informado"}

Retorne um JSON com EXATAMENTE esta estrutura (sem markdown, apenas JSON puro):
{
  "name": "${name}",
  "handle": "${instagram}",
  "segment": "descrição do segmento e público-alvo em português",
  "tone": "como a marca fala — tom de voz em português",
  "visual_style": "descrição do estilo visual em português",
  "colors": {
    "background": "#hex da cor de fundo predominante",
    "primary": "#hex da cor principal/destaque",
    "text": "#hex da cor do texto",
    "secondary": "#hex da cor secundária"
  },
  "copy_examples": {
    "headline": "exemplo de headline forte para essa marca em português",
    "subtitle": "exemplo de subtítulo em português",
    "cta": "chamada para ação padrão da marca em português"
  },
  "effects": [
    "efeito visual 1 que combina com a marca",
    "efeito visual 2",
    "efeito visual 3"
  ],
  "dont": [
    "o que nunca fazer visualmente",
    "o que nunca fazer no texto"
  ]
}

Use Google Search para buscar informações reais sobre @${instagram} e ${site || name}.
Seja específico e preciso. Tudo em português do Brasil com acentuação correta.
`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("Sem resposta da IA");

    const brand = JSON.parse(text);
    return NextResponse.json(brand);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro ao analisar a marca." }, { status: 500 });
  }
}
