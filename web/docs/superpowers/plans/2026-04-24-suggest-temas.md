# Sugestão de Temas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar botão "Sugerir ideias" na página de gerar post que retorna 3-5 sugestões de tema baseadas no contexto da marca e no que o usuário digitou.

**Architecture:** Nova rota `/api/post/suggest` recebe `brand` + `tema` e chama Gemini 2.5 Flash para gerar sugestões em JSON. O frontend exibe um modal com chips clicáveis; ao clicar num chip, o campo `tema` é preenchido automaticamente.

**Tech Stack:** Next.js 15 App Router, Gemini 2.5 Flash (texto), Tailwind CSS, TypeScript

---

### Task 1: Criar rota `/api/post/suggest`

**Files:**
- Create: `src/app/api/post/suggest/route.ts`

- [ ] **Step 1: Criar o arquivo da rota**

```typescript
// src/app/api/post/suggest/route.ts
import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export async function POST(req: NextRequest) {
  const { brand, tema } = await req.json();

  if (!brand) {
    return NextResponse.json({ error: "Marca obrigatória." }, { status: 400 });
  }

  const context = tema?.trim()
    ? `O usuário começou a digitar: "${tema}". Gere 5 variações ou expansões desse tema.`
    : `O usuário não digitou nada. Gere 5 ideias de tema originais baseadas no contexto da marca.`;

  const prompt = `
Você é um especialista em marketing digital brasileiro.
Sugira exatamente 5 ideias de tema para um post de redes sociais para a marca abaixo.

Marca: ${brand.name}
Segmento: ${brand.segment}
Tom de voz: ${brand.tone}
Estilo visual: ${brand.visual_style}

${context}

Regras:
- Cada tema deve ser curto (máximo 8 palavras), direto e impactante
- Devem ser específicos para essa marca e segmento
- Em português do Brasil com acentuação correta
- Sem numeração, sem bullets, apenas o texto do tema

Retorne APENAS um JSON array com 5 strings, sem markdown:
["tema 1", "tema 2", "tema 3", "tema 4", "tema 5"]
`.trim();

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.find((p: { text?: string }) => p.text)?.text;

    if (!text) throw new Error("Sem resposta da IA");

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const suggestions: string[] = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    return NextResponse.json({ suggestions: suggestions.slice(0, 5) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Testar a rota via curl**

```bash
curl -s -X POST http://localhost:3002/api/post/suggest \
  -H "Content-Type: application/json" \
  -d '{"brand":{"name":"Padaria do Zé","segment":"Padaria artesanal, público local"},"tema":""}' \
  | python -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
```

Esperado: `{ "suggestions": ["tema 1", "tema 2", "tema 3", "tema 4", "tema 5"] }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/post/suggest/route.ts
git commit -m "feat: add /api/post/suggest route"
```

---

### Task 2: Adicionar modal de sugestões e botão em `gerar/page.tsx`

**Files:**
- Modify: `src/app/gerar/page.tsx`

- [ ] **Step 1: Adicionar estado do modal**

Dentro do componente `GerarContent`, após os estados existentes, adicionar:

```typescript
const [suggestions, setSuggestions] = useState<string[]>([]);
const [loadingSuggest, setLoadingSuggest] = useState(false);
const [showSuggest, setShowSuggest] = useState(false);
```

- [ ] **Step 2: Adicionar função `handleSuggest`**

Após a função `handleGenerate`, adicionar:

```typescript
async function handleSuggest() {
  if (!selectedBrand) return;
  setLoadingSuggest(true);
  setShowSuggest(true);
  setSuggestions([]);
  try {
    const resp = await fetch("/api/post/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: selectedBrand, tema }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    setSuggestions(data.suggestions);
  } catch {
    setSuggestions([]);
    setShowSuggest(false);
  } finally {
    setLoadingSuggest(false);
  }
}
```

- [ ] **Step 3: Substituir o bloco do campo "Tema do post"**

Localizar o bloco:
```tsx
{/* Tema */}
<div className="space-y-2">
  <Label>Tema do post</Label>
  <Input
    placeholder="Ex: promoção de verão"
    value={tema}
    onChange={(e) => setTema(e.target.value)}
    className="bg-zinc-900 border-zinc-800"
    onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
  />
</div>
```

Substituir por:
```tsx
{/* Tema */}
<div className="space-y-2">
  <Label>Tema do post</Label>
  <div className="flex gap-2">
    <Input
      placeholder="Ex: promoção de verão"
      value={tema}
      onChange={(e) => setTema(e.target.value)}
      className="bg-zinc-900 border-zinc-800 flex-1"
      onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
    />
    <button
      type="button"
      onClick={handleSuggest}
      disabled={!selectedBrandId || loadingSuggest}
      className="px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-white text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      title="Sugerir ideias"
    >
      {loadingSuggest ? (
        <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin inline-block" />
      ) : "💡 Ideias"}
    </button>
  </div>
</div>
```

- [ ] **Step 4: Adicionar modal de sugestões**

Antes do `return` final do componente `GerarContent`, adicionar:

```tsx
{/* Modal de sugestões */}
{showSuggest && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setShowSuggest(false)}>
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">
          Ideias para {selectedBrand?.name}
        </h2>
        <button onClick={() => setShowSuggest(false)} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
      </div>

      {loadingSuggest ? (
        <div className="flex items-center justify-center py-8">
          <span className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { setTema(s); setShowSuggest(false); }}
              className="text-left px-4 py-3 rounded-xl bg-zinc-800 hover:bg-green-400/10 hover:border-green-400 border border-zinc-700 text-zinc-200 hover:text-white text-sm transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {!loadingSuggest && suggestions.length > 0 && (
        <button
          onClick={handleSuggest}
          className="w-full text-center text-zinc-500 hover:text-zinc-300 text-sm py-1 transition-colors"
        >
          ↻ Gerar novas ideias
        </button>
      )}
    </div>
  </div>
)}
```

Colocar o modal **antes** do `return (` principal, dentro do componente `GerarContent`, logo antes do `if (loading) return (...)` — não, colocar dentro do JSX retornado, como último filho do `<div className="min-h-screen...">`.

- [ ] **Step 5: Commit**

```bash
git add src/app/gerar/page.tsx
git commit -m "feat: suggest topics modal with AI-generated ideas"
```

---

### Task 3: Teste manual completo

- [ ] **Abrir `/gerar` com uma marca cadastrada**
- [ ] **Sem digitar tema → clicar "💡 Ideias" → verificar que 5 sugestões aparecem baseadas na marca**
- [ ] **Digitar um tema parcial → clicar "💡 Ideias" → verificar sugestões relacionadas ao digitado**
- [ ] **Clicar numa sugestão → verificar que o campo tema é preenchido e o modal fecha**
- [ ] **Clicar "↻ Gerar novas ideias" → verificar que novas sugestões chegam**
- [ ] **Clicar fora do modal → verificar que fecha**
- [ ] **Com modal aberto → clicar "Gerar post" → verificar que funciona normalmente**
