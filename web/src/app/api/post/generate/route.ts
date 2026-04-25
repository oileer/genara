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
  "headline": "Headline impactante em português (máx 7 palavras, pode ter pergunta ou tensão)",
  "subtitle": "subtítulo curto explicando a solução (máx 8 palavras)",
  "cta": "CTA do botão (máx 3 palavras, ex: Arrasta p/lado)"
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

async function generateVisualBrief(
  brand: Brand,
  copy: PostCopy,
  tema: string,
  ratio: "9:16 vertical" | "1:1 square",
  direcaoVisual?: string
): Promise<string> {
  const orientation = ratio === "9:16 vertical" ? "9:16 vertical" : "1:1 square";

  const prompt = `You are a world-class art director for Brazilian social media brands.

Generate a SHORT image prompt (max 90 words) for a ${orientation} social media post.

Brand: ${brand.name} — ${brand.segment}
Visual style: ${brand.visual_style}
Topic: "${tema}"
Background: ${brand.colors.background} (very dark / black)
Accent color: ${brand.colors.primary} (neon/vivid)
Effects: ${brand.effects?.join(", ") || "cinematic, high contrast"}
Avoid: ${brand.dont?.join(", ") || "white backgrounds, generic elements"}

Post text to display:
- HEADLINE: "${copy.headline}" — large bold white font, ONE key word highlighted in ${brand.colors.primary}
- SUBTITLE: "${copy.subtitle}" — small gray text below headline
- CTA BUTTON: pill-shaped button in ${brand.colors.primary} with text "${copy.cta}" and arrow icon

Layout rules (describe the image following this structure):
1. TOP 55%: hero visual — pick ONE specific element that represents the topic: a dramatic 3D rendered object (logo, icon, device, symbol), OR a cinematic photo. Be SPECIFIC about what the object is — not just "abstract shapes".
2. BOTTOM 45%: text block — headline (bold white, key word in neon ${brand.colors.primary}), subtitle below in small gray, then the CTA pill button.
3. Background: pure ${brand.colors.background}, dark atmosphere.

Examples of good hero visuals for different topics:
- WhatsApp blocked → giant 3D WhatsApp logo glowing red with glitch/crack effect
- Facebook profile → massive 3D chrome profile icon with neon green paint strokes
- Google Ads → 3D Google logo breaking apart, sparks flying
- Hacker/security → cinematic hooded figure at multiple screens
- TikTok → person holding phone showing TikTok interface, dark desk setup

${direcaoVisual ? `USER VISUAL DIRECTION (prioritize this above all else for the hero visual): "${direcaoVisual}"` : ""}

Now write the prompt for topic "${tema}". Output ONLY the prompt text in English, no headers, no bullets.`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Erro ao gerar briefing visual");
  return text.trim();
}

async function fetchImageBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const buffer = await resp.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

async function generateImage(
  brand: Brand,
  copy: PostCopy,
  ratio: "9:16 vertical" | "1:1 square",
  approvedExamples: ApprovedExample[],
  visualBrief: string
): Promise<string> {
  const exampleParts: unknown[] = [];

  if (approvedExamples.length > 0) {
    exampleParts.push({
      text: `REFERENCE POSTS for this brand — study the layout, hero visual style, typography placement, color palette, and overall design language. Your output must feel like it belongs to this same brand:`,
    });
    for (const ex of approvedExamples) {
      try {
        const b64 = await fetchImageBase64(ex.imageUrl);
        exampleParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
        if (ex.copy.headline) {
          exampleParts.push({ text: `↑ headline: "${ex.copy.headline}"` });
        }
      } catch { /* skip */ }
    }
  }

  const mainPrompt = `${visualBrief}

HARD RULES:
- Background MUST be ${brand.colors.background} — pitch black/very dark. NOT white, NOT gray, NOT light.
- Accent color: ${brand.colors.primary}
- Render all 3 text elements exactly as specified in the brief (headline, subtitle, CTA button)
- Headline: bold white, with ONE key word in ${brand.colors.primary}
- Do NOT add extra text, logos, watermarks, or borders beyond what is described`;

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
  const { brand, tema, formato, approvedExamples = [], direcaoVisual } = await req.json();

  if (!brand || !tema) {
    return NextResponse.json({ error: "Marca e tema são obrigatórios." }, { status: 400 });
  }

  try {
    const copy = await generatePostCopy(brand, tema);

    if (formato === "ambos") {
      const [briefStory, briefFeed] = await Promise.all([
        generateVisualBrief(brand, copy, tema, "9:16 vertical", direcaoVisual),
        generateVisualBrief(brand, copy, tema, "1:1 square", direcaoVisual),
      ]);
      const [story, feed] = await Promise.all([
        generateImage(brand, copy, "9:16 vertical", approvedExamples, briefStory),
        generateImage(brand, copy, "1:1 square", approvedExamples, briefFeed),
      ]);
      return NextResponse.json({ images: { story, feed }, copy });
    }

    const ratio = formato === "feed" ? "1:1 square" : "9:16 vertical";
    const visualBrief = await generateVisualBrief(brand, copy, tema, ratio, direcaoVisual);
    const image = await generateImage(brand, copy, ratio, approvedExamples, visualBrief);
    return NextResponse.json({ image, copy });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[post/generate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
