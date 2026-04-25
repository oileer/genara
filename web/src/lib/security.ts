import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "./firebase-admin";

// ============= AUTENTICAÇÃO =============

export interface AuthedRequest {
  uid: string;
  email?: string;
}

export async function requireAuth(req: NextRequest): Promise<AuthedRequest | NextResponse> {
  const auth = await verifyAuthToken(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return auth;
}

// ============= ANTI-SSRF: VALIDAÇÃO DE URLS =============

const BLOCKED_HOSTNAMES = [
  "localhost", "127.0.0.1", "0.0.0.0", "::1",
  "169.254.169.254", // AWS/GCP metadata
  "metadata.google.internal",
];

const BLOCKED_PROTOCOLS = ["file:", "ftp:", "gopher:", "data:", "javascript:"];

function isPrivateIp(host: string): boolean {
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 127.0.0.0/8
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [, a, b] = ipv4.map(Number);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

const ALLOWED_IMAGE_HOSTS = [
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
  "storage.cloud.google.com",
];

/**
 * Valida URL contra SSRF. Permite apenas http/https para domínios públicos.
 * @param url URL a validar
 * @param onlyImageHosts se true, restringe a hosts conhecidos do Firebase Storage
 */
export function validateExternalUrl(url: string, onlyImageHosts = false): boolean {
  try {
    const parsed = new URL(url);

    if (BLOCKED_PROTOCOLS.includes(parsed.protocol)) return false;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.includes(hostname)) return false;
    if (isPrivateIp(hostname)) return false;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;

    if (onlyImageHosts) {
      return ALLOWED_IMAGE_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
    }

    return true;
  } catch {
    return false;
  }
}

// ============= VALIDAÇÃO DE INPUT =============

export const LIMITS = {
  TEMA: 200,
  INSTRUCTION: 500,
  DIRECAO_VISUAL: 300,
  BRAND_FIELD: 500,
  EMAIL: 200,
  URL: 2048,
  MAX_REFERENCE_IMAGES: 8,
  MAX_APPROVED_EXAMPLES: 5,
};

export function sanitizeString(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLen).trim();
}

export function validateBrandPayload(brand: unknown): { ok: true; brand: Record<string, unknown> } | { ok: false; error: string } {
  if (!brand || typeof brand !== "object") return { ok: false, error: "Marca inválida" };
  const b = brand as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim()) return { ok: false, error: "Nome da marca obrigatório" };

  // Truncar campos grandes para evitar payload abuse
  return {
    ok: true,
    brand: {
      ...b,
      name: sanitizeString(b.name, LIMITS.BRAND_FIELD),
      handle: sanitizeString(b.handle, LIMITS.BRAND_FIELD),
      segment: sanitizeString(b.segment, LIMITS.BRAND_FIELD),
      tone: sanitizeString(b.tone, LIMITS.BRAND_FIELD),
      visual_style: sanitizeString(b.visual_style, LIMITS.BRAND_FIELD),
    },
  };
}

// ============= RATE LIMITING (in-memory) =============

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Limpa entradas expiradas a cada 5min
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) rateLimitStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, resetIn: windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, resetIn: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, resetIn: entry.resetAt - now };
}

export const RATE_LIMITS = {
  GENERATE: { max: 30, windowMs: 60 * 60 * 1000 }, // 30 gerações/hora
  EDIT: { max: 30, windowMs: 60 * 60 * 1000 },     // 30 edições/hora
  SUGGEST: { max: 60, windowMs: 60 * 60 * 1000 },  // 60 sugestões/hora
  ANALYZE: { max: 10, windowMs: 60 * 60 * 1000 },  // 10 análises de marca/hora
};

// ============= MENSAGENS DE ERRO SEGURAS =============

const GENERIC_ERROR_MAP: Record<string, string> = {
  default: "Erro ao processar requisição. Tente novamente.",
  rate_limit: "Muitas requisições. Tente novamente em alguns minutos.",
  invalid_input: "Dados inválidos.",
  unauthorized: "Não autorizado.",
  ssrf: "URL inválida.",
};

export function safeError(code: keyof typeof GENERIC_ERROR_MAP = "default", status = 500): NextResponse {
  return NextResponse.json({ error: GENERIC_ERROR_MAP[code] }, { status });
}
