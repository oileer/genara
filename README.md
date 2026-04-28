# Genara

Plataforma web para geração de posts e carrosséis de Instagram com IA, voltada para marcas brasileiras.

O usuário cadastra a identidade visual da sua marca (cores, tom de voz, estilo), digita um tema e o Genara gera o post pronto — Story, Feed ou Carrossel — usando o modelo de imagem do Google Gemini.

**Demo:** [genara.vercel.app](https://genara.vercel.app)

---

## Funcionalidades

- **Post único** — gera Story (9:16), Feed (1:1) ou os dois formatos ao mesmo tempo
- **Carrossel** — gera de 3 a 5 slides com roteiro e identidade visual consistentes
- **Ideias com IA** — sugere temas de post baseados no perfil da marca
- **Editar com IA** — refina qualquer imagem gerada com uma instrução em texto
- **Histórico** — salva todos os posts gerados por marca
- **Aprovação** — marque os melhores posts para a IA aprender com eles nas próximas gerações
- **Autenticação** — login com e-mail/senha ou Google (Firebase Auth)
- **Multi-marca** — gerencie quantas marcas quiser na mesma conta
- **Convites** — sistema de onboarding por código de convite

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 15 + React + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui |
| Auth | Firebase Authentication |
| Banco | Firestore (Firebase) |
| Storage | Firebase Storage |
| IA | Google Gemini (geração e edição de imagens) |
| Deploy | Vercel |

---

## Como rodar localmente

### Pré-requisitos

- Node.js 18+
- Conta no [Firebase](https://console.firebase.google.com) (grátis)
- API Key do [Google AI Studio](https://aistudio.google.com) (grátis)

### Instalação

```bash
git clone https://github.com/oileer/genara.git
cd genara/web
npm install
```

### Variáveis de ambiente

Crie o arquivo `web/.env.local` com base no `.env.example`:

```bash
cp .env.example .env.local
```

Preencha com suas chaves:

```env
# Firebase — pegue no console do seu projeto Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Google AI Studio — aistudio.google.com (grátis)
GEMINI_API_KEY=
```

### Rodar

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

---

## Estrutura do projeto

```
genara/
├── genara/              # CLI Python (geração local, sem interface)
│   ├── core.py          # lógica de geração via Gemini API
│   └── brands/          # exemplos de brand.json
├── web/                 # aplicação Next.js (interface web)
│   ├── src/
│   │   ├── app/         # rotas (App Router)
│   │   │   ├── gerar/       # página principal de geração
│   │   │   ├── marcas/      # CRUD de marcas
│   │   │   ├── historico/   # histórico de posts
│   │   │   ├── login/       # autenticação
│   │   │   ├── cadastro/    # cadastro de usuário
│   │   │   └── api/         # API routes (chamadas ao Gemini)
│   │   ├── lib/         # Firebase, auth, Firestore helpers
│   │   └── context/     # AuthContext (estado global do usuário)
│   └── .env.example     # variáveis necessárias (sem valores reais)
└── setup.py             # instalação do CLI Python
```

---

## Como funciona a geração

1. O usuário seleciona uma marca cadastrada (com cores, tom de voz, exemplos de copy)
2. Digita o tema do post
3. O sistema monta um prompt detalhado combinando a identidade visual da marca com o tema
4. O prompt é enviado para o Gemini com `responseModalities: ["TEXT", "IMAGE"]`
5. O Gemini retorna a imagem gerada em base64
6. A imagem é exibida na tela e salva no histórico

Para carrosséis, o sistema gera primeiro o roteiro (sequência de headlines por slide) e depois gera cada slide em paralelo mantendo consistência visual.

---

## CLI (uso local sem interface)

```bash
pip install -e .
genara --brand genara/brands/examples/full_contingencia.json --tema "conta bloqueada" --formato story
```

---

## Licença

MIT — use, modifique e distribua livremente.

---

Feito por [@oileer](https://github.com/oileer)
