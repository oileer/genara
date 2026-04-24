# Genara

**Gerador de posts com IA para marcas brasileiras.**

Você passa o contexto da marca e o tema — Genara gera o post pronto pra postar. Grátis, open source, sem dependência de ferramentas pagas.

## Como funciona

```bash
genara --brand brands/full_contingencia.json --tema "conta bloqueada no Facebook" --formato story
```

Genara lê o `brand.json` da sua marca, monta o prompt com identidade visual e tom de voz, e gera a imagem via Gemini API (Google AI Studio — grátis).

## Instalação

```bash
git clone https://github.com/oileer/genara.git
cd genara
pip install -e .
```

## Configuração

1. Pegue sua API key gratuita em [aistudio.google.com](https://aistudio.google.com)
2. Crie um arquivo `.env`:

```bash
GEMINI_API_KEY=sua_chave_aqui
```

Ou passe direto no comando:

```bash
genara --brand brands/minha_marca.json --tema "lançamento de produto" --api-key SUA_KEY
```

## Criando sua marca

Copie o template e preencha:

```bash
cp genara/brands/examples/brand_template.json genara/brands/minha_marca.json
```

Campos do `brand.json`:

```json
{
  "name": "Nome da Empresa",
  "handle": "handle_instagram",
  "segment": "descrição do segmento e público-alvo",
  "tone": "como a marca fala",
  "visual_style": "descrição do estilo visual",
  "colors": {
    "background": "#000000",
    "primary": "#FFFFFF",
    "text": "#FFFFFF",
    "secondary": "#888888"
  },
  "copy_examples": {
    "headline": "exemplo de headline",
    "subtitle": "exemplo de subtítulo",
    "cta": "chamada para ação"
  }
}
```

## Formatos

| Flag | Formato | Dimensão |
|------|---------|----------|
| `--formato story` | Stories / Reels | 9:16 |
| `--formato feed` | Feed quadrado | 1:1 |

## Exemplos

```bash
# Story para tráfego pago
genara --brand brands/examples/full_contingencia.json --tema "BM com limite alto disponível" --formato story

# Feed para agência de sites
genara --brand brands/minha_agencia.json --tema "site pronto em 7 dias" --formato feed
```

## Requisitos

- Python 3.9+
- Conta Google AI Studio (grátis)
- `pip install requests`

## Roadmap

- [ ] Geração de carrossel (múltiplos slides)
- [ ] Modo batch (vários temas de uma vez)
- [ ] Interface web
- [ ] Suporte a outros modelos (GPT-4o, Claude)

## Licença

MIT — use, modifique e distribua livremente.

---

Feito com ♥ por [@oileer](https://github.com/oileer)
