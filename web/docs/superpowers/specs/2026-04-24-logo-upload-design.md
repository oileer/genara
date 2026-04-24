# Logo Upload — Design Spec
**Data:** 2026-04-24
**Status:** Aprovado

---

## Visão Geral

Adicionar upload de logo no Passo 1 de criação de marca. A logo é enviada ao Gemini Vision para extrair identidade visual real (cores, estilo, tipografia). Após salvar a marca, a logo é persistida no Firebase Storage com acesso restrito ao dono, e a URL fica salva no Firestore para uso futuro nos posts.

---

## Fluxo

### Passo 1 — Dados básicos (atualizado)
- Campo de upload de logo abaixo do campo Site
- Aceita PNG, JPG, SVG — hint textual recomenda "PNG sem fundo"
- Ao selecionar arquivo: exibe preview (miniatura 64×64) + botão X para remover
- Campo opcional — sem logo o fluxo continua igual ao atual

### Análise da IA (`/api/brand/analyze`) — atualizado
- Se logo enviada: frontend converte para base64, envia no body como `{ name, instagram, site, logoBase64, logoMimeType }`
- Gemini recebe a imagem como `inlineData` junto ao prompt textual (multimodal)
- Prompt instrui: "Analise esta logo para extrair cores exatas, estilo visual e tipografia"
- Se sem logo: comportamento atual mantido (CSS scraping + contexto textual)

### Passo 4 — Salvar marca (atualizado)
- Se logo presente: faz upload para Firebase Storage **antes** de salvar no Firestore
- Path: `logos/{uid}/{brandId}.{ext}` — onde ext vem do MIME type
- `getDownloadURL` retorna URL autenticada
- Firestore salva `logo_url: string` (ou `null` se sem logo)

---

## Segurança

Firebase Storage Rules:
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
- Apenas o dono (`uid`) pode ler e escrever sua pasta
- URLs geradas por `getDownloadURL` exigem token de autenticação válido
- Logos de outros usuários são inacessíveis mesmo com URL

---

## Schema Firestore atualizado

```
brands/{uid}/list/{brandId}
  name: string
  handle: string
  segment: string
  tone: string
  visual_style: string
  colors: { background, primary, text, secondary }
  copy_examples: { headline, subtitle, cta }
  effects: string[]
  dont: string[]
  logo_url: string | null   ← NOVO
  createdAt: timestamp
  updatedAt: timestamp
```

---

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/app/marcas/nova/page.tsx` | Campo de upload + preview + lógica base64 + upload Storage |
| `src/app/api/brand/analyze/route.ts` | Receber logoBase64, passar ao Gemini como inlineData |
| `src/lib/brands.ts` | Adicionar `logo_url` ao tipo `Brand` e à função `createBrand` |
| `firestore.rules` ou Firebase Console | Adicionar regra Storage acima |

---

## Fora do escopo (v1)

- Crop/resize da logo no browser
- Múltiplas logos por marca
- Substituição de logo após criação da marca
