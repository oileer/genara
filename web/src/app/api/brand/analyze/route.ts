import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

async function extractColorsFromSite(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      signal: AbortSignal.timeout(6000),
    });
    const html = await res.text();

    // coleta CSS inline (<style> tags) + atributos style=""
    const cssChunks: string[] = [];

    const styleTags = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    for (const m of styleTags) cssChunks.push(m[1]);

    const inlineStyles = html.matchAll(/style="([^"]+)"/gi);
    for (const m of inlineStyles) cssChunks.push(m[1]);

    // busca URLs de stylesheets externos
    const linkTags = html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi);
    const base = new URL(url);
    for (const m of linkTags) {
      try {
        const cssUrl = new URL(m[1], base).toString();
        const cssRes = await fetch(cssUrl, { signal: AbortSignal.timeout(4000) });
        cssChunks.push(await cssRes.text());
      } catch { /* ignora CSS externo que falhar */ }
    }

    const allCss = cssChunks.join("\n");

    // extrai todas as cores hex e rgb/rgba
    const hexColors = [...allCss.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)].map(m => m[0]);
    const rgbColors = [...allCss.matchAll(/rgba?\([^)]+\)/g)].map(m => m[0]);

    // conta frequência
    const freq: Record<string, number> = {};
    for (const c of [...hexColors, ...rgbColors]) {
      freq[c] = (freq[c] || 0) + 1;
    }

    const top = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([color, count]) => `${color} (${count}x)`)
      .join(", ");

    return top || "nenhuma cor extraída";
  } catch {
    return "não foi possível acessar o site";
  }
}

export async function POST(req: NextRequest) {
  const { name, instagram, site } = await req.json();

  if (!name || !instagram) {
    return NextResponse.json({ error: "Nome e Instagram são obrigatórios." }, { status: 400 });
  }

  const siteColors = site ? await extractColorsFromSite(site) : "site não informado";

  const prompt = `
Você é um especialista em branding e marketing digital brasileiro.
Analise a marca "${name}" com base nas informações abaixo e extraia o máximo de contexto possível.

Instagram: @${instagram}
Site: ${site || "não informado"}

CORES REAIS EXTRAÍDAS DO CSS DO SITE (use estas como base para o campo "colors"):
${siteColors}

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

Para o campo "colors": use as cores reais do CSS listadas acima. Escolha as mais relevantes considerando frequência e contexto (background, destaque, texto). Converta rgb/rgba para hex se necessário.
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
          tools: [{ googleSearch: {} }],
        }),
      }
    );

    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.find((p: { text?: string }) => p.text)?.text;

    if (!text) throw new Error(`Sem resposta da IA. Status: ${resp.status}. Data: ${JSON.stringify(data).slice(0, 500)}`);

    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    const brand = JSON.parse(jsonStr);
    return NextResponse.json(brand);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[brand/analyze]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
