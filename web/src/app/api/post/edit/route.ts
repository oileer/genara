import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkRateLimit, RATE_LIMITS, validateExternalUrl, sanitizeString, safeError, LIMITS } from "@/lib/security";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

async function fetchImageBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Erro ao buscar imagem");
  const buffer = await resp.arrayBuffer();
  const mimeType = resp.headers.get("content-type") || "image/png";
  return { data: Buffer.from(buffer).toString("base64"), mimeType };
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { allowed, resetIn } = checkRateLimit(`edit:${auth.uid}`, RATE_LIMITS.EDIT.max, RATE_LIMITS.EDIT.windowMs);
  if (!allowed) return NextResponse.json({ error: "Muitas requisições. Tente novamente em alguns minutos." }, { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } });

  const body = await req.json();
  const { imageBase64, imageUrl } = body;
  const instruction = sanitizeString(body.instruction, LIMITS.INSTRUCTION);

  if (!instruction) {
    return NextResponse.json({ error: "Instrução obrigatória." }, { status: 400 });
  }

  // SSRF: validate imageUrl if provided
  if (imageUrl && !validateExternalUrl(imageUrl, true)) {
    return safeError("ssrf", 400);
  }

  try {
    let imgData: string;
    let mimeType: string;

    if (imageBase64) {
      const match = imageBase64.match(/^data:(.+);base64,(.+)$/);
      if (!match) throw new Error("Formato de imagem inválido");
      mimeType = match[1];
      imgData = match[2];
    } else if (imageUrl) {
      const fetched = await fetchImageBase64(imageUrl);
      imgData = fetched.data;
      mimeType = fetched.mimeType;
    } else {
      return NextResponse.json({ error: "Imagem obrigatória." }, { status: 400 });
    }

    const prompt = `You are editing an existing social media post image.

Current image is attached. Apply this edit instruction:
"${instruction}"

Rules:
- Keep everything that is NOT mentioned in the instruction (layout, colors, text, brand style)
- Apply ONLY the requested change
- Maintain the same image dimensions and overall composition
- Output the complete edited image`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: imgData } },
              { text: prompt },
            ],
          }],
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
    if (!imgPart) throw new Error("Nenhuma imagem retornada");

    return NextResponse.json({ image: `data:image/png;base64,${imgPart.inlineData.data}` });
  } catch (e) {
    console.error("[post/edit]", e instanceof Error ? e.message : e);
    return safeError("default", 500);
  }
}
