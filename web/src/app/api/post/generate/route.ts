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

async function generatePostCopy(brand: Brand, tema: string): Promise<PostCopy> {
  const prompt = `Você é um copywriter especialista em marketing digital brasileiro.
Crie o texto para um post de redes sociais.

Marca: ${brand.name}
Segmento: ${brand.segment}
Tom de voz: ${brand.tone}
Tema do post: ${tema}

Referências de copy da marca:
- Headline: "${brand.copy_examples.headline}"
- Subtítulo: "${brand.copy_examples.subtitle}"
- CTA: "${brand.copy_examples.cta}"

Crie textos ORIGINAIS adaptados ao tema "${tema}", mantendo o tom da marca.
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
  if (!text) throw new Error("Erro ao gerar copy do post");
  return JSON.parse(text) as PostCopy;
}

async function generateImage(brand: Brand, tema: string, ratio: "9:16 vertical" | "1:1 square", copy: PostCopy): Promise<string> {
  const prompt = `Dark cinematic photo-realistic ${ratio} marketing image for Brazilian social media.

Brand: ${brand.name} — ${brand.segment}
Visual style: ${brand.visual_style}
Topic: ${tema}

Color palette:
- Background: ${brand.colors.background} (dominant)
- Primary accent: ${brand.colors.primary} (glows, highlights, key elements)
- Text color: ${brand.colors.text}

Visual effects: ${brand.effects?.join(", ") || "cinematic dark atmosphere"}
Central visual element: one powerful image related to "${tema}"

RENDER THESE EXACT TEXTS ON THE IMAGE (character by character, correct Portuguese accents):
${JSON.stringify({
  headline: copy.headline,
  subtitle: copy.subtitle,
  cta: copy.cta,
  handle: "@" + brand.handle,
}, null, 2)}

Text placement:
- headline: large bold uppercase, bottom third or center
- subtitle: smaller, directly below headline
- cta: small rounded pill
- handle: small, bottom corner

Rules:
- Ultra high contrast, cinematic dramatic lighting
- Performance marketing aesthetic, photo-realistic
- No watermarks, no borders
- Do NOT include: ${brand.dont?.join(", ") || "low quality elements"}`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Image API error: ${resp.status} ${err?.error?.message || ""}`);
  }

  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p: { inlineData?: { data: string } }) => p.inlineData);
  if (!imgPart) throw new Error("Nenhuma imagem gerada");
  return `data:image/png;base64,${imgPart.inlineData.data}`;
}

export async function POST(req: NextRequest) {
  const { brand, tema, formato } = await req.json();

  if (!brand || !tema) {
    return NextResponse.json({ error: "Marca e tema são obrigatórios." }, { status: 400 });
  }

  try {
    const copy = await generatePostCopy(brand, tema);

    if (formato === "ambos") {
      const [story, feed] = await Promise.all([
        generateImage(brand, tema, "9:16 vertical", copy),
        generateImage(brand, tema, "1:1 square", copy),
      ]);
      return NextResponse.json({ images: { story, feed }, copy });
    }

    const ratio = formato === "feed" ? "1:1 square" : "9:16 vertical";
    const image = await generateImage(brand, tema, ratio, copy);
    return NextResponse.json({ image, copy });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[post/generate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
