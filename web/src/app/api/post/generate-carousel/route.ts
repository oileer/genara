import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit, RATE_LIMITS, validateExternalUrl, sanitizeString, safeError, LIMITS } from "@/lib/security";

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
  effects: string[];
}

interface ApprovedExample {
  imageUrl: string;
  copy: { headline: string; subtitle: string; cta: string };
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
- Slides 2 a ${numSlides - 1}: desenvolvimento (dicas, argumentos, dados)
- Slide ${numSlides}: CTA claro e direto
- Headline: CAIXA ALTA, máx 6 palavras, acentuação correta (ã, ê, ç, etc.)
- Subtitle: caixa baixa, máx 8 palavras, acentuação correta
- visual_description: descreva em INGLÊS o elemento visual central do slide (para geração de imagem)

Retorne APENAS um JSON array (sem markdown):
[
  {
    "headline": "HEADLINE DO SLIDE",
    "subtitle": "subtítulo do slide",
    "visual_description": "english description of central visual element"
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
  if (!text) throw new Error("Erro ao gerar roteiro");
  return JSON.parse(text) as SlideScript[];
}

async function fetchImageBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const buffer = await resp.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

async function generateSlideImage(
  brand: Brand,
  slide: SlideScript,
  slideNum: number,
  totalSlides: number,
  ratio: "9:16 vertical" | "1:1 square",
  approvedExamples: ApprovedExample[]
): Promise<string> {
  const exampleParts: unknown[] = [];

  if (approvedExamples.length > 0) {
    exampleParts.push({
      text: `These are approved posts for this brand. Replicate their visual style and aesthetic quality:`,
    });
    for (const ex of approvedExamples) {
      try {
        const b64 = await fetchImageBase64(ex.imageUrl);
        exampleParts.push({ inlineData: { mimeType: "image/png", data: b64 } });
      } catch { /* skip */ }
    }
  }

  const slideRole = slideNum === 1 ? "hook slide — must grab attention instantly"
    : slideNum === totalSlides ? "CTA slide — drive action, clear call to action"
    : `content slide ${slideNum} — develop the narrative`;

  const mainPrompt = `Create a ${ratio} carousel slide image. Slide ${slideNum} of ${totalSlides} — ${slideRole}.

Brand: ${brand.name} — ${brand.segment}
Visual style: ${brand.visual_style}
Central visual: ${slide.visual_description}

HEADLINE (the ONLY text — render it once, exactly):
"${slide.headline}"

Color palette:
- Background: ${brand.colors.background} (keep consistent across ALL ${totalSlides} slides)
- Accent: ${brand.colors.primary}

Visual effects: ${brand.effects?.join(", ") || "cinematic dark atmosphere"}

RULES:
- Render the headline ONCE — do NOT repeat or add extra words
- NO subtitle, NO extra copy — only the headline
- Same background color and visual identity on every slide for carousel cohesion
- ${slideNum === 1 ? "Slide 1: explosive hook, stops the scroll" : slideNum === totalSlides ? "Last slide: action energy, strong composition" : `Slide ${slideNum}: continuation of the visual story`}
- Ultra high contrast, cinematic lighting, photo-realistic
- No watermarks, no borders
- Do NOT include: ${brand.dont?.join(", ") || "low quality elements"}`;

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
    throw new Error(`Slide ${slideNum} error: ${resp.status} ${err?.error?.message || ""}`);
  }

  const data = await resp.json();
  const resParts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = resParts.find((p: { inlineData?: { data: string } }) => p.inlineData);
  if (!imgPart) throw new Error(`Slide ${slideNum}: nenhuma imagem gerada`);
  return `data:image/png;base64,${imgPart.inlineData.data}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { allowed, resetIn } = checkRateLimit(`generate:${auth.uid}`, RATE_LIMITS.GENERATE.max, RATE_LIMITS.GENERATE.windowMs);
  if (!allowed) return NextResponse.json({ error: "Muitas requisições. Tente novamente em alguns minutos." }, { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } });

  const body = await req.json();
  const { brand, formato, numSlides = 3, approvedExamples = [] } = body;
  const tema = sanitizeString(body.tema, LIMITS.TEMA);

  if (!brand || !tema) {
    return NextResponse.json({ error: "Marca e tema são obrigatórios." }, { status: 400 });
  }

  const safeExamples: ApprovedExample[] = (approvedExamples as ApprovedExample[])
    .slice(0, LIMITS.MAX_APPROVED_EXAMPLES)
    .filter((ex) => ex?.imageUrl && validateExternalUrl(ex.imageUrl, true));

  try {
    const n = Math.min(Math.max(numSlides, 3), 5);
    const script = await generateCarouselScript(brand, tema, n);

    const slides = await Promise.all(
      script.map(async (slide, i) => {
        if (formato === "ambos") {
          const [story, feed] = await Promise.all([
            generateSlideImage(brand, slide, i + 1, script.length, "9:16 vertical", safeExamples),
            generateSlideImage(brand, slide, i + 1, script.length, "1:1 square", safeExamples),
          ]);
          return { story, feed, copy: { headline: slide.headline, subtitle: slide.subtitle, cta: "" } };
        }
        const ratio = formato === "feed" ? "1:1 square" : "9:16 vertical";
        const image = await generateSlideImage(brand, slide, i + 1, script.length, ratio, safeExamples);
        return {
          ...(formato === "feed" ? { feed: image } : { story: image }),
          copy: { headline: slide.headline, subtitle: slide.subtitle, cta: "" },
        };
      })
    );

    return NextResponse.json({ slides, script });
  } catch (e) {
    console.error("[post/generate-carousel]", e instanceof Error ? e.message : e);
    return safeError("default", 500);
  }
}
