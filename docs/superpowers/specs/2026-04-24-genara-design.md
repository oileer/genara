# Genara — Design Spec
**Data:** 2026-04-24  
**Status:** Aprovado

---

## Visão Geral

Genara é uma plataforma web que permite qualquer pessoa gerar posts para redes sociais com IA, sem precisar saber programação. A pessoa cadastra sua marca (ou de clientes), a IA extrai o contexto automaticamente do Instagram e site, e a partir daí gera imagens prontas para postar via Gemini.

---

## Usuário-alvo

Gestores de tráfego, agências digitais, empreendedores brasileiros. Pessoas que gerenciam múltiplas marcas e precisam de conteúdo visual rápido e consistente com a identidade de cada cliente.

---

## Arquitetura

```
Next.js 15 (App Router) — Vercel
    ↓
Firebase Auth — login Google + email/senha
    ↓
Firestore — usuários, marcas, histórico
    ↓
Firebase Storage — PNGs gerados
    ↓
Next.js API Routes
    ↓
Gemini API
  - gemini-2.0-flash → scraping de contexto + formulário guiado
  - gemini-3.1-flash-image-preview → geração de imagem
```

---

## Stack

| Camada | Ferramenta |
|--------|-----------|
| Frontend + API | Next.js 15 (App Router) |
| Deploy | Vercel |
| Auth | Firebase Auth |
| Banco | Firestore |
| Storage | Firebase Storage |
| IA — contexto | Gemini 2.0 Flash |
| IA — imagem | Gemini 3.1 Flash Image Preview |
| UI | Tailwind CSS + shadcn/ui |

---

## Telas e Fluxo

### 1. Auth
- `/login` — Login Google ou email/senha
- `/cadastro` — Nome, email, senha, WhatsApp (obrigatório)
- Após cadastro → redireciona para `/marcas`

### 2. Dashboard — Minhas Marcas (`/marcas`)
- Grid de marcas cadastradas pelo usuário
- Card por marca: cor primária como destaque, nome, handle, botão "Gerar post"
- Botão "Nova marca" → `/marcas/nova`
- Sem limite de marcas na versão free

### 3. Criar/Editar Marca (`/marcas/nova`, `/marcas/[id]/editar`)

Fluxo em 4 passos:

**Passo 1 — Dados de entrada**
- Nome da empresa
- @ do Instagram
- URL do site

**Passo 2 — IA analisa**
- Gemini raspa Instagram + site via Google Search grounding
- Extrai: segmento, público-alvo, cores, tom de voz, copy existente, produtos/serviços, estilo visual, o que evitar

**Passo 3 — Revisão guiada**
- Formulário campo por campo com o que a IA preencheu
- Usuário confirma ou edita cada item
- IA sugere melhorias inline conforme o usuário edita

**Passo 4 — Salvar**
- Salva no Firestore em `brands/{uid}/list/{brandId}`

### 4. Gerador de Post (`/gerar`)
- Dropdown para selecionar a marca
- Campo de texto: "Qual o tema do post?"
- Toggle de formato: Story (9:16) ou Feed (1:1)
- Botão "Gerar"
- Exibe imagem gerada
- Ações: Baixar PNG | Gerar novamente | Salvar no histórico

### 5. Histórico (`/historico`)
- Grid de posts gerados
- Filtro por marca e formato
- Cada card: miniatura, marca, data, botão baixar

---

## Firestore Schema

```
users/{uid}
  name: string
  email: string
  whatsapp: string
  createdAt: timestamp

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
  createdAt: timestamp
  updatedAt: timestamp

posts/{uid}/history/{postId}
  brandId: string
  brandName: string
  tema: string
  formato: "story" | "feed"
  imageUrl: string
  createdAt: timestamp
```

---

## API Routes

| Rota | Método | Função |
|------|--------|--------|
| `/api/brand/analyze` | POST | Recebe Instagram + site, retorna contexto extraído pela IA |
| `/api/post/generate` | POST | Recebe brand + tema + formato, retorna imagem gerada |

---

## Variáveis de Ambiente

```
GEMINI_API_KEY=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

## Design Visual

- Dark mode por padrão (alinhado com a estética da Full Contingência e do DESIGNER)
- Cor primária Genara: a definir (sugestão: verde elétrico ou roxo — diferente das marcas do Euller)
- shadcn/ui como base de componentes
- Tailwind para customizações

---

## Fora do escopo (v1)

- Planos pagos / paywall
- Geração de carrossel (múltiplos slides)
- Agendamento de posts
- Integração direta com Instagram API
