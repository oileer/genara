"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createBrand, Brand } from "@/lib/brands";
import { authFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = ["Dados básicos", "Analisando...", "Revisar contexto", "Pronto!"];

export default function NovaMarcaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [inputs, setInputs] = useState({ name: "", instagram: "", site: "" });
  const [brand, setBrand] = useState<Omit<Brand, "id">>({
    name: "", handle: "", segment: "", tone: "", visual_style: "",
    colors: { background: "#0A0A0A", primary: "#FFFFFF", text: "#FFFFFF", secondary: "#888888" },
    copy_examples: { headline: "", subtitle: "", cta: "" },
    effects: [], dont: [],
  });

  function updateBrandField(field: string, value: string) {
    setBrand((b) => ({ ...b, [field]: value }));
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStep(1);
    try {
      const resp = await authFetch(user!, "/api/brand/analyze", {
        method: "POST",
        body: JSON.stringify(inputs),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setBrand(data);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao analisar a marca. Tente novamente.");
      setStep(0);
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <button onClick={() => router.push("/marcas")} className="text-zinc-500 text-sm hover:text-white mb-4 block">
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold text-white">Nova marca</h1>
          <p className="text-zinc-400 text-sm mt-1">Passo {Math.min(step + 1, 3)} de 3 — {STEPS[step]}</p>
        </div>

        {/* Step 0 — Dados básicos */}
        {step === 0 && (
          <form onSubmit={handleAnalyze} className="space-y-5">
            <div className="space-y-2">
              <Label>Nome da empresa</Label>
              <Input
                placeholder="Ex: Sua Empresa"
                value={inputs.name}
                onChange={(e) => setInputs((i) => ({ ...i, name: e.target.value }))}
                required className="bg-zinc-900 border-zinc-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram <span className="text-green-400">*</span></Label>
              <div className="flex">
                <span className="flex items-center px-3 bg-zinc-800 border border-r-0 border-zinc-700 rounded-l-md text-zinc-400 text-sm">@</span>
                <Input
                  placeholder="suaempresa"
                  value={inputs.instagram}
                  onChange={(e) => setInputs((i) => ({ ...i, instagram: e.target.value }))}
                  required className="bg-zinc-900 border-zinc-800 rounded-l-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Site <span className="text-zinc-500 text-xs">(opcional)</span></Label>
              <Input
                placeholder="https://suaempresa.com"
                value={inputs.site}
                onChange={(e) => setInputs((i) => ({ ...i, site: e.target.value }))}
                className="bg-zinc-900 border-zinc-800"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" className="w-full bg-green-400 text-black hover:bg-green-300 font-semibold">
              Analisar marca com IA →
            </Button>
          </form>
        )}

        {/* Step 1 — Loading */}
        {step === 1 && (
          <div className="text-center space-y-4 py-16">
            <div className="w-12 h-12 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-zinc-400">Analisando Instagram e site da marca...</p>
            <p className="text-zinc-600 text-sm">Isso leva alguns segundos</p>
          </div>
        )}

        {/* Step 2 — Revisão */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
              <p className="text-xs text-green-400 uppercase font-semibold">IA analisou sua marca</p>
              <p className="text-zinc-400 text-sm">Revise e ajuste os campos abaixo antes de salvar.</p>
            </div>

            {[
              { label: "Nome", field: "name", value: brand.name },
              { label: "Segmento / Público-alvo", field: "segment", value: brand.segment },
              { label: "Tom de voz", field: "tone", value: brand.tone },
              { label: "Estilo visual", field: "visual_style", value: brand.visual_style },
            ].map(({ label, field, value }) => (
              <div key={field} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  value={value}
                  onChange={(e) => updateBrandField(field, e.target.value)}
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label>Headline de exemplo</Label>
              <Input
                value={brand.copy_examples.headline}
                onChange={(e) => setBrand((b) => ({ ...b, copy_examples: { ...b.copy_examples, headline: e.target.value } }))}
                className="bg-zinc-900 border-zinc-800"
              />
            </div>

            <div className="space-y-2">
              <Label>CTA padrão</Label>
              <Input
                value={brand.copy_examples.cta}
                onChange={(e) => setBrand((b) => ({ ...b, copy_examples: { ...b.copy_examples, cta: e.target.value } }))}
                className="bg-zinc-900 border-zinc-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(brand.colors).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs capitalize">{key}</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={val} onChange={(e) => setBrand((b) => ({ ...b, colors: { ...b.colors, [key]: e.target.value } }))} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <Input value={val} onChange={(e) => setBrand((b) => ({ ...b, colors: { ...b.colors, [key]: e.target.value } }))} className="bg-zinc-900 border-zinc-800 text-sm h-8" />
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button onClick={handleSave} disabled={loading} className="w-full bg-green-400 text-black hover:bg-green-300 font-semibold">
              {loading ? "Salvando..." : "Salvar marca →"}
            </Button>
          </div>
        )}

        {/* Step 3 — Sucesso */}
        {step === 3 && (
          <div className="text-center space-y-4 py-16">
            <div className="w-12 h-12 bg-green-400 rounded-full flex items-center justify-center mx-auto text-black text-2xl font-bold">✓</div>
            <p className="text-white font-semibold">Marca salva com sucesso!</p>
            <p className="text-zinc-400 text-sm">Redirecionando...</p>
          </div>
        )}
      </div>
    </div>
  );
}
