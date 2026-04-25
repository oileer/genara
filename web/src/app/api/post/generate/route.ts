import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TEXT_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

interface PostCopy {
  headline: string;
  subtitle: string;
  cta: string;
}

interface Brand {
  name: string;
  handle: string;
  segment: string;
  tone: string;
  visual_style: string;
  colors: { background: string; primary: string; text: string; secondary: string };
  copy_examples: { headline: string; subtitle: string; cta: string };
  effects: string[];
  dont: string[];
}

interface ApprovedExample {
  imageUrl: string;
  copy: PostCopy;
}

async function generatePostCopy(brand: Brand, tema: string): Promise<PostCopy> {
  const prompt = `Você é um copywriter especialista em marketing digital brasileiro.
Crie o texto para um post de redes sociais.

Marca: ${brand.name}
Segmento: ${brand.segment}
Tom de voz: ${brand.tone}
Tema: ${tema}

Referências de copy da marca:
- Headline: "${brand.copy_examples.headline}"
- Subtítulo: "${brand.copy_examples.subtitle}"
- CTA: "${brand.copy_examples.cta}"

Crie textos ORIGINAIS adaptados ao tema "${tema}".
Use acentuação correta: ã, ê, ç, ó, á, etc.

Retorne APENAS este JSON (sem markdown):
{
  "headline": "HEADLINE EM CAIXA ALTA (máx 6 palavras)",
  "subtitle": "subtítulo em caixa baixa (máx 8 palavras)",
  "cta": "CTA curto (máx 4 palavras)"
}`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Erro ao gerar copy");
  return JSON.parse(text) as PostCopy;
}

async function fetchImageBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const buffer = await resp.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

async function generateImage(
  brand: Brand,
  tema: string,
  ratio: "9:16 vertical" | "1:1 square",
  approvedExamples: ApprovedExample[]
): Promise<string> {
  const exampleParts: unknown[] = [];

  if (approvedExamples.length > 0) {
    exampleParts.push({
      text: `These are previously approved posts for this brand. Study their visual style, colors, lighting and composition — replicate the same aesthetic quality:`,
    });
    for (const ex of approvedExamples) {
      try {
        const b64 = await fetchImageBase64(ex.imageUrl);
        exampleParts.push({ inlineData: { mimeType: "image/png", data: b64 } });
        exampleParts.push({ text: `Approved visual for copy: "${ex.copy.headline}"` });
      } catch { /* skip example if fetch fails */ }
    }
  }

  const mainPrompt = `Generate a ${ratio} photo-realistic marketing background image for Brazilian social media.

Brand: ${brand.name} — ${brand.segment}
Visual style: ${brand.visual_style}
Topic to represent visually: ${tema}

Color palette:
- Background: ${brand.colors.background} (dominant — use this as the main background color)
- Primary accent: ${brand.colors.primary} (glows, neon highlights, key elements)
- Keep palette consistent

Visual effects: ${brand.effects?.join(", ") || "cinematic dark atmosphere"}
Central visual element: one powerful image representing "${tema}"

⚠️ CRITICAL RULES:
- DO NOT render ANY text, letters, words, numbers or characters in the image
- Generate ONLY the background visual — text will be added programmatically
- Ultra high contrast, cinematic dramatic lighting
- Photo-realistic quality
- No watermarks, no borders, no frames
- Do NOT include: ${brand.dont?.join(", ") || "low quality elements, clipart"}`;

  const parts = [...exampleParts, { text: mainPrompt }];

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Image API error: ${resp.status} ${err?.error?.message || ""}`);
  }

  const data = await resp.json();
  const resParts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = resParts.find((p: { inlineData?: { data: string } }) => p.inlineData);
  if (!imgPart) throw new Error("Nenhuma imagem gerada");
  return `data:image/png;base64,${imgPart.inlineData.data}`;
}

export async function POST(req: NextRequest) {
  const { brand, tema, formato, approvedExamples = [] } = await req.json();

  if (!brand || !tema) {
    return NextResponse.json({ error: "Marca e tema são obrigatórios." }, { status: 400 });
  }

  try {
    const copy = await generatePostCopy(brand, tema);

    if (formato === "ambos") {
      const [story, feed] = await Promise.all([
        generateImage(brand, tema, "9:16 vertical", approvedExamples),
        generateImage(brand, tema, "1:1 square", approvedExamples),
      ]);
      return NextResponse.json({ images: { story, feed }, copy });
    }

    const ratio = formato === "feed" ? "1:1 square" : "9:16 vertical";
    const image = await generateImage(brand, tema, ratio, approvedExamples);
    return NextResponse.json({ image, copy });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[post/generate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
