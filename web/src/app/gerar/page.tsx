"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getBrands, Brand } from "@/lib/brands";
import { savePost } from "@/lib/posts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function GerarContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState(params.get("brandId") || "");
  const [tema, setTema] = useState("");
  const [formato, setFormato] = useState<"story" | "feed">("story");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) getBrands(user.uid).then(setBrands);
  }, [user]);

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);

  async function handleGenerate() {
    if (!selectedBrand || !tema) return;
    setGenerating(true);
    setError("");
    setImage(null);
    try {
      const resp = await fetch("/api/post/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: selectedBrand, tema, formato }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setImage(data.image);
    } catch {
      setError("Erro ao gerar imagem. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!user || !image || !selectedBrand) return;
    setSaving(true);
    try {
      await savePost(user.uid, {
        brandId: selectedBrandId,
        brandName: selectedBrand.name,
        tema,
        formato,
        imageUrl: "",
      }, image);
      router.push("/historico");
    } catch {
      setError("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image;
    a.download = `genara-${Date.now()}.png`;
    a.click();
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Navbar */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.push("/marcas")} className="text-2xl font-bold">
            <span className="text-white">gen</span>
            <span className="text-green-400">ara</span>
          </button>
          <Button variant="outline" size="sm" onClick={() => router.push("/historico")} className="border-zinc-800 text-zinc-400 hover:text-white">
            Histórico
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Painel esquerdo — controles */}
          <div className="space-y-6">
            <h1 className="text-xl font-semibold text-white">Gerar post</h1>

            {/* Seletor de marca */}
            <div className="space-y-2">
              <Label>Marca</Label>
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
              >
                <option value="">Selecionar marca...</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Tema */}
            <div className="space-y-2">
              <Label>Tema do post</Label>
              <Input
                placeholder="Ex: conta bloqueada no Facebook"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                className="bg-zinc-900 border-zinc-800"
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              />
            </div>

            {/* Formato */}
            <div className="space-y-2">
              <Label>Formato</Label>
              <div className="flex gap-3">
                {(["story", "feed"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormato(f)}
                    className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      formato === f
                        ? "border-green-400 bg-green-400/10 text-green-400"
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    {f === "story" ? "Story / Reels (9:16)" : "Feed (1:1)"}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedBrandId || !tema}
              className="w-full bg-green-400 text-black hover:bg-green-300 font-semibold h-12 text-base"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Gerando...
                </span>
              ) : "Gerar post →"}
            </Button>
          </div>

          {/* Painel direito — preview */}
          <div className="space-y-4">
            <div className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center ${formato === "story" ? "aspect-[9/16]" : "aspect-square"}`}>
              {image ? (
                <img src={image} alt="Post gerado" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center space-y-2 p-8">
                  {generating ? (
                    <>
                      <div className="w-10 h-10 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-zinc-500 text-sm">Gerando sua imagem...</p>
                    </>
                  ) : (
                    <p className="text-zinc-600 text-sm">O post aparece aqui</p>
                  )}
                </div>
              )}
            </div>

            {image && (
              <div className="flex gap-3">
                <Button onClick={handleDownload} className="flex-1 bg-green-400 text-black hover:bg-green-300 font-semibold">
                  Baixar PNG
                </Button>
                <Button onClick={handleGenerate} disabled={generating} variant="outline" className="flex-1 border-zinc-800 text-zinc-400 hover:text-white">
                  Gerar novamente
                </Button>
                <Button onClick={handleSave} disabled={saving} variant="outline" className="border-zinc-800 text-zinc-400 hover:text-white">
                  {saving ? "..." : "Salvar"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GerarPage() {
  return (
    <Suspense>
      <GerarContent />
    </Suspense>
  );
}
