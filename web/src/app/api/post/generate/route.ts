import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.1-flash-image-preview";

export async function POST(req: NextRequest) {
  const { brand, tema, formato } = await req.json();

  const ratio = formato === "feed" ? "1:1 square" : "9:16 vertical";

  const prompt = `
Dark cinematic photo-realistic ${ratio} marketing image for Brazilian social media.

Brand: ${brand.name} — ${brand.segment}
Visual style: ${brand.visual_style}
Tone: ${brand.tone}

Topic: ${tema}

Color rules:
- Background: ${brand.colors.background} (dominant, dark)
- Primary accent: ${brand.colors.primary} (glow, highlights, neon)
- Text: ${brand.colors.text}

Visual effects to apply: ${brand.effects?.join(", ") || "cinematic dark atmosphere"}

Central visual: one powerful image element directly related to the topic "${tema}"

Text on image (use EXACT words, correct Portuguese accents: ã, ê, ç, ó, etc.):
- Large bold uppercase headline inspired by: "${brand.copy_examples.headline}" but adapted to topic "${tema}"
- Smaller subtitle below
- Brand handle at bottom corner: @${brand.handle}
- NO invented text, NO placeholder, NO lorem ipsum
- ALL text must have correct Portuguese accents

Rules:
- Ultra high contrast
- Cinematic dramatic lighting
- Performance marketing aesthetic
- Photo-realistic quality
- No watermarks, no borders
- Do NOT include: ${brand.dont?.join(", ") || "low quality elements"}
`.trim();

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      }
    );

    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        return NextResponse.json({
          image: `data:image/png;base64,${part.inlineData.data}`,
        });
      }
    }

    return NextResponse.json({ error: "Nenhuma imagem gerada." }, { status: 500 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro ao gerar imagem." }, { status: 500 });
  }
}
