import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TEXT_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

interface SlideScript {
  headline: string;
  subtitle: string;
  visual_description: string;
}

interface Brand {
  name: string;
  handle: string;
  segment: string;
  tone: string;
  visual_style: string;
  colors: { background: string; primary: string; text: string; secondary: string };
  dont: string[];
}

async function generateCarouselScript(brand: Brand, tema: string, numSlides: number): Promise<SlideScript[]> {
  const prompt = `Você é um estrategista de conteúdo brasileiro especialista em carrosséis para redes sociais.
Crie o roteiro de um carrossel com ${numSlides} slides para a marca abaixo.

Marca: ${brand.name}
Segmento: ${brand.segment}
Tom de voz: ${brand.tone}
Tema: ${tema}

Regras:
- Slide 1: gancho forte que prenda atenção imediatamente
- Slides 2 a ${numSlides - 1}: desenvolvimento do tema (dicas, argumentos, dados)
- Slide ${numSlides}: CTA claro e direto
- Headline: CAIXA ALTA, máx 6 palavras, com acentuação correta (ã, ê, ç, etc.)
- Subtitle: caixa baixa, máx 8 palavras, com acentuação correta
- visual_description: descrição em INGLÊS do elemento visual central do slide

Retorne APENAS um JSON array (sem markdown):
[
  {
    "headline": "HEADLINE DO SLIDE",
    "subtitle": "subtítulo do slide",
    "visual_description": "english description of the central visual element"
  }
]`;

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
  if (!text) throw new Error("Erro ao gerar roteiro do carrossel");
  return JSON.parse(text) as SlideScript[];
}

async function generateSlideImage(
  brand: Brand,
  slide: SlideScript,
  slideNum: number,
  totalSlides: number,
  ratio: "9:16 vertical" | "1:1 square"
): Promise<string> {
  const prompt = `Dark cinematic photo-realistic ${ratio} marketing carousel slide for Brazilian social media.

Brand: ${brand.name} — ${brand.segment}
Visual style: ${brand.visual_style}
Slide: ${slideNum} of ${totalSlides}

Color palette:
- Background: ${brand.colors.background} (dominant)
- Primary accent: ${brand.colors.primary} (glows, highlights)
- Text color: ${brand.colors.text}

Central visual element: ${slide.visual_description}

RENDER THESE EXACT TEXTS ON THE IMAGE (character by character, correct Portuguese accents):
${JSON.stringify({
  headline: slide.headline,
  subtitle: slide.subtitle,
  slide_indicator: `${slideNum}/${totalSlides}`,
  handle: "@" + brand.handle,
}, null, 2)}

Text placement:
- headline: large bold uppercase, bottom third
- subtitle: smaller, below headline
- slide_indicator: small, top or bottom corner
- handle: small, opposite corner

Rules:
- Ultra high contrast, cinematic lighting
- Consistent visual style across all slides of this carousel
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
    throw new Error(`Slide ${slideNum} error: ${resp.status} ${err?.error?.message || ""}`);
  }

  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p: { inlineData?: { data: string } }) => p.inlineData);
  if (!imgPart) throw new Error(`Slide ${slideNum}: nenhuma imagem gerada`);
  return `data:image/png;base64,${imgPart.inlineData.data}`;
}

export async function POST(req: NextRequest) {
  const { brand, tema, formato, numSlides = 3 } = await req.json();

  if (!brand || !tema) {
    return NextResponse.json({ error: "Marca e tema são obrigatórios." }, { status: 400 });
  }

  try {
    const script = await generateCarouselScript(brand, tema, Math.min(Math.max(numSlides, 3), 5));

    const slides = await Promise.all(
      script.map(async (slide, i) => {
        if (formato === "ambos") {
          const [story, feed] = await Promise.all([
            generateSlideImage(brand, slide, i + 1, script.length, "9:16 vertical"),
            generateSlideImage(brand, slide, i + 1, script.length, "1:1 square"),
          ]);
          return { story, feed };
        }
        const ratio = formato === "feed" ? "1:1 square" : "9:16 vertical";
        const image = await generateSlideImage(brand, slide, i + 1, script.length, ratio);
        return formato === "feed" ? { feed: image } : { story: image };
      })
    );

    return NextResponse.json({ slides, script });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[post/generate-carousel]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
