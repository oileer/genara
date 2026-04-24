# Logo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir upload de logo no Passo 1 de criação de marca, usar a imagem para extrair identidade visual via Gemini Vision, e persistir a logo no Firebase Storage com acesso restrito ao dono.

**Architecture:** O frontend converte a logo para base64 e envia junto à requisição de análise. A rota `/api/brand/analyze` passa a imagem ao Gemini como `inlineData` (multimodal). Ao salvar a marca, o frontend faz upload da logo para Firebase Storage em `logos/{uid}/{brandId}.{ext}` e salva a URL no Firestore.

**Tech Stack:** Next.js 15 App Router, Firebase Storage (`getStorage`, `ref`, `uploadBytes`, `getDownloadURL`), Gemini 2.5 Flash (multimodal), TypeScript, Tailwind CSS

---

### Task 1: Adicionar `logo_url` ao tipo Brand e à função `createBrand`

**Files:**
- Modify: `src/lib/brands.ts`

- [ ] **Step 1: Adicionar `logo_url` à interface `Brand` e criar função de upload**

Substituir o conteúdo completo de `src/lib/brands.ts` por:

```typescript
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

export interface Brand {
  id?: string;
  name: string;
  handle: string;
  segment: string;
  tone: string;
  visual_style: string;
  colors: { background: string; primary: string; text: string; secondary: string };
  copy_examples: { headline: string; subtitle: string; cta: string };
  effects: string[];
  dont: string[];
  logo_url: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function uploadBrandLogo(
  uid: string,
  brandId: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const storageRef = ref(storage, `logos/${uid}/${brandId}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function getBrands(uid: string): Promise<Brand[]> {
  const snap = await getDocs(collection(db, "brands", uid, "list"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Brand));
}

export async function createBrand(uid: string, brand: Omit<Brand, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "brands", uid, "list"), {
    ...brand,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBrand(uid: string, brandId: string, brand: Partial<Brand>) {
  await updateDoc(doc(db, "brands", uid, "list", brandId), {
    ...brand,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBrand(uid: string, brandId: string) {
  await deleteDoc(doc(db, "brands", uid, "list", brandId));
}
```

- [ ] **Step 2: Commit**

```bash
git -C "C:\Users\eulle\1-Projetos\Genara\web" add src/lib/brands.ts
git -C "C:\Users\eulle\1-Projetos\Genara\web" commit -m "feat: add logo_url to Brand type and uploadBrandLogo function"
```

---

### Task 2: Atualizar `/api/brand/analyze` para aceitar logo via Gemini Vision

**Files:**
- Modify: `src/app/api/brand/analyze/route.ts`

- [ ] **Step 1: Atualizar a rota para receber `logoBase64` e `logoMimeType`**

Substituir o conteúdo completo de `src/app/api/brand/analyze/route.ts` por:

```typescript
import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

async function extractColorsFromSite(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      signal: AbortSignal.timeout(6000),
    });
    const html = await res.text();

    const cssChunks: string[] = [];
    const styleTags = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    for (const m of styleTags) cssChunks.push(m[1]);
    const inlineStyles = html.matchAll(/style="([^"]+)"/gi);
    for (const m of inlineStyles) cssChunks.push(m[1]);

    const linkTags = html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi);
    const base = new URL(url);
    for (const m of linkTags) {
      try {
        const cssUrl = new URL(m[1], base).toString();
        const cssRes = await fetch(cssUrl, { signal: AbortSignal.timeout(4000) });
        cssChunks.push(await cssRes.text());
      } catch { /* ignora CSS externo que falhar */ }
    }

    const allCss = cssChunks.join("\n");
    const hexColors = [...allCss.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)].map(m => m[0]);
    const rgbColors = [...allCss.matchAll(/rgba?\([^)]+\)/g)].map(m => m[0]);

    const freq: Record<string, number> = {};
    for (const c of [...hexColors, ...rgbColors]) {
      freq[c] = (freq[c] || 0) + 1;
    }

    const top = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([color, count]) => `${color} (${count}x)`)
      .join(", ");

    return top || "nenhuma cor extraída";
  } catch {
    return "não foi possível acessar o site";
  }
}

export async function POST(req: NextRequest) {
  const { name, instagram, site, logoBase64, logoMimeType } = await req.json();

  if (!name || !instagram) {
    return NextResponse.json({ error: "Nome e Instagram são obrigatórios." }, { status: 400 });
  }

  const siteColors = site ? await extractColorsFromSite(site) : "site não informado";
  const hasLogo = !!logoBase64 && !!logoMimeType;

  const colorInstructions = hasLogo
    ? `Uma logo da marca foi fornecida como imagem. USE A LOGO como fonte primária para extrair as cores exatas (background, primary, text, secondary). Identifique as cores predominantes diretamente da imagem.`
    : `CORES REAIS EXTRAÍDAS DO CSS DO SITE (use estas como base para o campo "colors"):\n${siteColors}`;

  const prompt = `
Você é um especialista em branding e marketing digital brasileiro.
Analise a marca "${name}" com base nas informações abaixo e extraia o máximo de contexto possível.

Instagram: @${instagram}
Site: ${site || "não informado"}

${colorInstructions}

Retorne um JSON com EXATAMENTE esta estrutura (sem markdown, apenas JSON puro):
{
  "name": "${name}",
  "handle": "${instagram}",
  "segment": "descrição do segmento e público-alvo em português",
  "tone": "como a marca fala — tom de voz em português",
  "visual_style": "descrição do estilo visual em português",
  "colors": {
    "background": "#hex da cor de fundo predominante",
    "primary": "#hex da cor principal/destaque",
    "text": "#hex da cor do texto",
    "secondary": "#hex da cor secundária"
  },
  "copy_examples": {
    "headline": "exemplo de headline forte para essa marca em português",
    "subtitle": "exemplo de subtítulo em português",
    "cta": "chamada para ação padrão da marca em português"
  },
  "effects": [
    "efeito visual 1 que combina com a marca",
    "efeito visual 2",
    "efeito visual 3"
  ],
  "dont": [
    "o que nunca fazer visualmente",
    "o que nunca fazer no texto"
  ]
}

Use Google Search para buscar informações reais sobre @${instagram} e ${site || name}.
Seja específico e preciso. Tudo em português do Brasil com acentuação correta.
`.trim();

  const imagePart = hasLogo
    ? { inlineData: { mimeType: logoMimeType, data: logoBase64 } }
    : null;

  const parts = imagePart
    ? [imagePart, { text: prompt }]
    : [{ text: prompt }];

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          tools: [{ googleSearch: {} }],
        }),
      }
    );

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${resp.status} ${errData?.error?.message || resp.statusText}`);
    }

    const data = await resp.json();
    const responseParts = data?.candidates?.[0]?.content?.parts || [];
    const text = responseParts.find((p: { text?: string }) => p.text)?.text;

    if (!text) throw new Error(`Sem resposta da IA. Status: ${resp.status}. Data: ${JSON.stringify(data).slice(0, 500)}`);

    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    const brand = JSON.parse(jsonStr);
    return NextResponse.json(brand);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[brand/analyze]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Testar sem logo (comportamento atual deve continuar)**

```bash
curl -s -X POST http://localhost:3002/api/brand/analyze \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","instagram":"teste","site":""}' \
  | python -c "import sys,json; d=json.load(sys.stdin); print('OK' if 'colors' in d else 'ERRO: ' + str(d))"
```

Esperado: `OK`

- [ ] **Step 3: Commit**

```bash
git -C "C:\Users\eulle\1-Projetos\Genara\web" add src/app/api/brand/analyze/route.ts
git -C "C:\Users\eulle\1-Projetos\Genara\web" commit -m "feat: support logo image in brand analysis via Gemini Vision"
```

---

### Task 3: Adicionar upload de logo no Passo 1 de `marcas/nova/page.tsx`

**Files:**
- Modify: `src/app/marcas/nova/page.tsx`

Contexto do arquivo atual: o Passo 1 tem um `<form onSubmit={handleAnalyze}>` com campos Nome, Instagram e Site. O Passo 4 chama `createBrand(user.uid, brand)`.

- [ ] **Step 1: Adicionar imports necessários no topo**

Localizar:
```typescript
import { createBrand, Brand } from "@/lib/brands";
```

Substituir por:
```typescript
import { createBrand, uploadBrandLogo, Brand } from "@/lib/brands";
```

- [ ] **Step 2: Adicionar estado do arquivo de logo**

Localizar:
```typescript
  const [inputs, setInputs] = useState({ name: "", instagram: "", site: "" });
```

Adicionar após essa linha:
```typescript
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
```

- [ ] **Step 3: Adicionar estado inicial de `logo_url` na marca**

Localizar:
```typescript
  const [brand, setBrand] = useState<Omit<Brand, "id">>({
    name: "", handle: "", segment: "", tone: "", visual_style: "",
    colors: { background: "#0A0A0A", primary: "#FFFFFF", text: "#FFFFFF", secondary: "#888888" },
    copy_examples: { headline: "", subtitle: "", cta: "" },
    effects: [], dont: [],
  });
```

Substituir por:
```typescript
  const [brand, setBrand] = useState<Omit<Brand, "id">>({
    name: "", handle: "", segment: "", tone: "", visual_style: "",
    colors: { background: "#0A0A0A", primary: "#FFFFFF", text: "#FFFFFF", secondary: "#888888" },
    copy_examples: { headline: "", subtitle: "", cta: "" },
    effects: [], dont: [],
    logo_url: null,
  });
```

- [ ] **Step 4: Adicionar função `handleLogoChange`**

Localizar:
```typescript
  async function handleAnalyze(e: React.FormEvent) {
```

Adicionar antes dessa função:
```typescript
  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    } else {
      setLogoPreview(null);
    }
  }

  function handleLogoRemove() {
    setLogoFile(null);
    setLogoPreview(null);
  }

```

- [ ] **Step 5: Atualizar `handleAnalyze` para enviar logo como base64**

Localizar:
```typescript
    try {
      const resp = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
```

Substituir por:
```typescript
    try {
      let logoBase64: string | null = null;
      let logoMimeType: string | null = null;
      if (logoFile) {
        const buffer = await logoFile.arrayBuffer();
        logoBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        logoMimeType = logoFile.type || "image/png";
      }

      const resp = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...inputs, logoBase64, logoMimeType }),
      });
```

- [ ] **Step 6: Atualizar `handleSave` para fazer upload da logo antes de salvar**

Localizar:
```typescript
  async function handleSave() {
    if (!user) return;
    setLoading(true);
    try {
      await createBrand(user.uid, brand);
      setStep(3);
      setTimeout(() => router.push("/marcas"), 1500);
    } catch {
      setError("Erro ao salvar a marca.");
    } finally {
      setLoading(false);
    }
  }
```

Substituir por:
```typescript
  async function handleSave() {
    if (!user) return;
    setLoading(true);
    try {
      const brandId = await createBrand(user.uid, { ...brand, logo_url: null });
      if (logoFile) {
        const logoUrl = await uploadBrandLogo(user.uid, brandId, logoFile);
        await import("@/lib/brands").then(({ updateBrand }) =>
          updateBrand(user.uid, brandId, { logo_url: logoUrl })
        );
      }
      setStep(3);
      setTimeout(() => router.push("/marcas"), 1500);
    } catch {
      setError("Erro ao salvar a marca.");
    } finally {
      setLoading(false);
    }
  }
```

- [ ] **Step 7: Adicionar campo de upload no JSX do Passo 0**

Localizar:
```tsx
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" className="w-full bg-green-400 text-black hover:bg-green-300 font-semibold">
              Analisar marca com IA →
            </Button>
```

Adicionar antes de `{error && ...}`:
```tsx
            {/* Logo */}
            <div className="space-y-2">
              <Label>
                Logo <span className="text-zinc-500 text-xs">(opcional — PNG sem fundo recomendado)</span>
              </Label>
              {logoPreview ? (
                <div className="flex items-center gap-3">
                  <img src={logoPreview} alt="Logo preview" className="w-16 h-16 object-contain rounded-lg bg-zinc-800 p-1" />
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    className="text-zinc-500 hover:text-red-400 text-sm transition-colors"
                  >
                    × Remover
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-500 transition-colors">
                  <span className="text-zinc-500 text-sm">Clique para enviar</span>
                  <span className="text-zinc-600 text-xs mt-1">PNG, JPG ou SVG</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

```

- [ ] **Step 8: Commit**

```bash
git -C "C:\Users\eulle\1-Projetos\Genara\web" add src/app/marcas/nova/page.tsx
git -C "C:\Users\eulle\1-Projetos\Genara\web" commit -m "feat: logo upload in new brand flow"
```

---

### Task 4: Configurar Firebase Storage Rules

**Files:**
- Create: `firestore.storage.rules` (documentação local — as regras são aplicadas via Firebase Console)

- [ ] **Step 1: Criar arquivo de referência das regras**

Criar `C:\Users\eulle\1-Projetos\Genara\web\storage.rules` com:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /logos/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- [ ] **Step 2: Aplicar as regras no Firebase Console**

1. Acessar https://console.firebase.google.com/project/genara-9fbac/storage/rules
2. Substituir as regras existentes pelo conteúdo do arquivo `storage.rules`
3. Clicar em "Publicar"

- [ ] **Step 3: Commit do arquivo de referência**

```bash
git -C "C:\Users\eulle\1-Projetos\Genara\web" add storage.rules
git -C "C:\Users\eulle\1-Projetos\Genara\web" commit -m "chore: add Firebase Storage security rules"
```

---

### Task 5: Teste manual completo

- [ ] **Criar uma nova marca COM logo:**
  1. Ir em `/marcas/nova`
  2. Preencher nome, Instagram (site opcional)
  3. Fazer upload de um PNG com logo
  4. Verificar preview da logo aparece
  5. Clicar "Analisar marca com IA →"
  6. Verificar que as cores retornadas refletem a logo (não o CSS)
  7. Salvar a marca
  8. Verificar no Firebase Console → Storage → `logos/{uid}/` que o arquivo existe
  9. Verificar no Firestore que `logo_url` foi salvo e não é null

- [ ] **Criar uma nova marca SEM logo:**
  1. Preencher nome e Instagram sem fazer upload
  2. Analisar → comportamento igual ao atual (cores do CSS)
  3. Salvar → `logo_url: null` no Firestore

- [ ] **Remover logo após upload:**
  1. Fazer upload de logo
  2. Clicar "× Remover"
  3. Preview some, campo volta ao estado inicial
  4. Analisar sem logo → funciona normalmente
