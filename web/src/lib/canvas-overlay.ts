export interface OverlayCopy {
  headline: string;
  subtitle: string;
  cta: string;
  handle: string;
}

export interface OverlayColors {
  primary: string;
  text: string;
}

let fontLoaded = false;

async function ensureFont() {
  if (fontLoaded) return;
  try {
    const bold = new FontFace(
      "Inter",
      "url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2)",
      { weight: "900", style: "normal" }
    );
    const reg = new FontFace(
      "Inter",
      "url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2)",
      { weight: "400", style: "normal" }
    );
    await Promise.all([bold.load(), reg.load()]);
    document.fonts.add(bold);
    document.fonts.add(reg);
    fontLoaded = true;
  } catch {
    // fallback to system fonts
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function overlayTextOnImage(
  imageBase64: string,
  copy: OverlayCopy,
  colors: OverlayColors
): Promise<string> {
  await ensureFont();

  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const w = canvas.width;
      const h = canvas.height;
      const isStory = h > w;
      const pad = w * 0.07;

      // gradient overlay — começa em 55% da altura
      const gradStart = h * 0.52;
      const grad = ctx.createLinearGradient(0, gradStart, 0, h);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.25, "rgba(0,0,0,0.72)");
      grad.addColorStop(1, "rgba(0,0,0,0.93)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, gradStart, w, h - gradStart);

      // tamanhos baseados na largura
      const headlineSize = isStory ? w * 0.105 : w * 0.088;
      const subtitleSize = headlineSize * 0.41;
      const handleSize = headlineSize * 0.29;

      // headline
      ctx.font = `900 ${headlineSize}px Inter, "Arial Black", Arial, sans-serif`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "left";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 12;

      const headlineLines = wrapText(ctx, copy.headline.toUpperCase(), w - pad * 2);
      const textBlockHeight =
        headlineLines.length * headlineSize * 1.15 +
        (copy.subtitle ? subtitleSize * 2.5 : 0);

      let y = h - textBlockHeight - pad * 2.2;

      for (const line of headlineLines) {
        ctx.fillText(line, pad, y);
        y += headlineSize * 1.15;
      }

      // linha accent
      ctx.shadowBlur = 0;
      ctx.fillStyle = colors.primary || "#22C55E";
      ctx.fillRect(pad, y, w * 0.08, headlineSize * 0.07);
      y += headlineSize * 0.28;

      // subtitle
      if (copy.subtitle) {
        ctx.font = `400 ${subtitleSize}px Inter, Arial, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.82)";
        const subLines = wrapText(ctx, copy.subtitle, w - pad * 2);
        for (const line of subLines) {
          ctx.fillText(line, pad, y);
          y += subtitleSize * 1.45;
        }
      }

      // handle
      ctx.font = `500 ${handleSize}px Inter, Arial, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(copy.handle, pad, h - pad * 0.75);

      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = reject;
    img.src = imageBase64;
  });
}
