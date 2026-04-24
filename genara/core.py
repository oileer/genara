import os
import sys
import base64
import json
import argparse
from pathlib import Path
from datetime import datetime
import requests

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent"
OUTPUT_DIR = Path("output")

def load_brand(brand_path: str) -> dict:
    with open(brand_path, encoding="utf-8") as f:
        return json.load(f)

def build_prompt(brand: dict, tema: str, formato: str) -> str:
    nome = brand["name"]
    segmento = brand["segment"]
    cor_primaria = brand["colors"]["primary"]
    cor_fundo = brand["colors"]["background"]
    cor_texto = brand["colors"]["text"]
    tom = brand["tone"]
    estilo = brand["visual_style"]
    exemplo_headline = brand.get("copy_examples", {}).get("headline", "")
    exemplo_cta = brand.get("copy_examples", {}).get("cta", "")

    ratio = "9:16" if formato == "story" else "1:1"
    orientacao = "vertical poster 9:16" if formato == "story" else "square post 1:1"

    prompt = f"""
Dark cinematic photo-realistic {orientacao} marketing image for Brazilian social media.

Brand: {nome} — {segmento}
Visual style: {estilo}
Tone: {tom}

Topic: {tema}

Color rules:
- Background: {cor_fundo} (dominant, deep dark)
- Primary accent: {cor_primaria} (neon glow, highlights)
- Text color: {cor_texto}

Composition:
- One powerful central visual element related to the topic
- Atmospheric effects: neon glow, dark fog, cinematic lighting
- Bold headline text at the bottom in Portuguese with correct accents
- Subtitle text below headline
- Brand handle at bottom corner: @{brand.get("handle", nome.lower().replace(" ", ""))}

Text on image:
- Headline (large, bold, uppercase): inspired by this example: "{exemplo_headline}"
- Adapt the headline to match the topic: "{tema}"
- Subtitle (smaller, gray): short supporting sentence
- All text must have correct Portuguese accents (ã, ê, ç, ó, etc.)
- No invented text, no placeholder text, no lorem ipsum

Style rules:
- Ultra high contrast
- Cinematic, dramatic lighting
- Performance marketing aesthetic
- Photo-realistic quality
- No watermarks, no borders
""".strip()

    return prompt

def gerar(brand_path: str, tema: str, formato: str = "story", api_key: str = None, nome_arquivo: str = None):
    api_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Erro: defina GEMINI_API_KEY no ambiente ou passe via --api-key")
        sys.exit(1)

    brand = load_brand(brand_path)
    prompt = build_prompt(brand, tema, formato)

    print(f"Gerando post para {brand['name']} — tema: {tema}")

    resp = requests.post(
        f"{API_URL}?key={api_key}",
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}
        }
    )

    if resp.status_code != 200:
        print(f"Erro: {resp.status_code} — {resp.text}")
        sys.exit(1)

    parts = resp.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])

    for part in parts:
        if "inlineData" in part:
            img_data = base64.b64decode(part["inlineData"]["data"])
            OUTPUT_DIR.mkdir(exist_ok=True)
            nome = nome_arquivo or f"{brand['name'].lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            if not nome.endswith(".png"):
                nome += ".png"
            output_path = OUTPUT_DIR / nome
            output_path.write_bytes(img_data)
            print(f"Salvo: {output_path}")
            return output_path

    print("Nenhuma imagem retornada.")
    return None

def main():
    parser = argparse.ArgumentParser(
        prog="genara",
        description="Genara — gerador de posts com IA para marcas brasileiras"
    )
    parser.add_argument("--brand", required=True, help="Caminho para o arquivo brand.json")
    parser.add_argument("--tema", required=True, help="Tema do post (ex: 'conta bloqueada no Facebook')")
    parser.add_argument("--formato", choices=["story", "feed"], default="story", help="Formato: story (9:16) ou feed (1:1)")
    parser.add_argument("--api-key", help="Gemini API Key (ou defina GEMINI_API_KEY no ambiente)")
    parser.add_argument("--output", help="Nome do arquivo de saída (sem extensão)")
    args = parser.parse_args()

    gerar(args.brand, args.tema, args.formato, args.api_key, args.output)

if __name__ == "__main__":
    main()
