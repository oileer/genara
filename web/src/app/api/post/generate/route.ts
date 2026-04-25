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
  copy: { headline: string; subtitle: string; cta: string };
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
  copy: PostCopy,
  tema: string,
  ratio: "9:16 vertical" | "1:1 square",
  approvedExamples: ApprovedExample[]
): Promise<string> {
  const exampleParts: unknown[] = [];

  if (approvedExamples.length > 0) {
    exampleParts.push({
      text: `These are previously approved posts for this brand. Study their visual style, typography placement, colors, lighting and composition — replicate the same creative energy:`,
    });
    for (const ex of approvedExamples) {
      try {
        const b64 = await fetchImageBase64(ex.imageUrl);
        exampleParts.push({ inlineData: { mimeType: "image/png", data: b64 } });
        exampleParts.push({ text: `Reference post — headline: "${ex.copy.headline}"` });
      } catch { /* skip example if fetch fails */ }
    }
  }

  const mainPrompt = `Create a ${ratio} social media post image for a Brazilian brand. This is a COMPLETE final post — typography, visual and layout all integrated.

Brand: ${brand.name} — ${brand.segment}
Visual style: ${brand.visual_style}
Topic: ${tema}

TEXT TO RENDER IN THE IMAGE (render these exactly, no changes):
- HEADLINE (big, bold, prominent): ${copy.headline}
- Subtitle (smaller, elegant): ${copy.subtitle}
- CTA (small, bottom area): ${copy.cta}
- Handle (very small, subtle): @${brand.handle}

Color palette:
- Background: ${brand.colors.background}
- Primary accent: ${brand.colors.primary}
- Text: ${brand.colors.text}

Visual effects: ${brand.effects?.join(", ") || "cinematic dark atmosphere"}

CREATIVE DIRECTION — be bold and unexpected:
- Break the standard "text at the bottom" template
- Experiment: huge type behind the visual, text integrated into the scene, minimal text on rich visual, diagonal layouts, centered dramatic composition, text as part of the art
- Each post must feel unique — not a template
- Ultra high contrast, cinematic lighting, photo-realistic quality
- The typography must be legible and beautiful
- No watermarks, no logos, no borders
- Do NOT include: ${brand.dont?.join(", ") || "low quality elements, clipart"}

Think like a world-class creative director. Make it stunning.`;

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
        generateImage(brand, copy, tema, "9:16 vertical", approvedExamples),
        generateImage(brand, copy, tema, "1:1 square", approvedExamples),
      ]);
      return NextResponse.json({ images: { story, feed }, copy });
    }

    const ratio = formato === "feed" ? "1:1 square" : "9:16 vertical";
    const image = await generateImage(brand, copy, tema, ratio, approvedExamples);
    return NextResponse.json({ image, copy });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[post/generate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
