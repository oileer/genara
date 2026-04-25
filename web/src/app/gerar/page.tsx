"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getBrands, Brand } from "@/lib/brands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { overlayTextOnImage, OverlayCopy } from "@/lib/canvas-overlay";
import {
  saveApprovedPost,
  getApprovedPostsForBrand,
  fetchImageAsBase64,
  ApprovedPost,
} from "@/lib/approved-posts";

type Tipo = "post" | "carrossel";
type Formato = "story" | "feed" | "ambos";

interface GeneratedImage {
  label: string;
  src: string;
  aspect: "9/16" | "1/1";
  copy: OverlayCopy;
  approved: boolean;
  saving: boolean;
}

function GerarContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState(params.get("brandId") || "");
  const [tema, setTema] = useState("");
  const [tipo, setTipo] = useState<Tipo>("post");
  const [formato, setFormato] = useState<Formato>("story");
  const [numSlides, setNumSlides] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) getBrands(user.uid).then(setBrands);
  }, [user]);

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);

  async function buildApprovedExamples(): Promise<ApprovedPost[]> {
    if (!user || !selectedBrandId) return [];
    return getApprovedPostsForBrand(user.uid, selectedBrandId, 2);
  }

  async function applyOverlay(src: string, copy: OverlayCopy): Promise<string> {
    try {
      return await overlayTextOnImage(src, copy, {
        primary: selectedBrand?.colors?.primary || "#22C55E",
        text: selectedBrand?.colors?.text || "#FFFFFF",
      });
    } catch {
      return src; // fallback: imagem sem overlay se canvas falhar
    }
  }

  async function handleGenerate() {
    if (!selectedBrand || !tema) return;
    setGenerating(true);
    setError("");
    setImages([]);

    try {
      const approvedExamples = await buildApprovedExamples();

      if (tipo === "post") {
        const resp = await fetch("/api/post/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand: selectedBrand, tema, formato, approvedExamples }),
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        const copy: OverlayCopy = {
          headline: data.copy.headline,
          subtitle: data.copy.subtitle,
          cta: data.copy.cta,
          handle: `@${selectedBrand.handle}`,
        };

        if (formato === "ambos") {
          const [storySrc, feedSrc] = await Promise.all([
            applyOverlay(data.images.story, copy),
            applyOverlay(data.images.feed, copy),
          ]);
          setImages([
            { label: "Story (9:16)", src: storySrc, aspect: "9/16", copy, approved: false, saving: false },
            { label: "Feed (1:1)", src: feedSrc, aspect: "1/1", copy, approved: false, saving: false },
          ]);
        } else {
          const finalSrc = await applyOverlay(data.image, copy);
          setImages([{
            label: formato === "story" ? "Story (9:16)" : "Feed (1:1)",
            src: finalSrc,
            aspect: formato === "story" ? "9/16" : "1/1",
            copy,
            approved: false,
            saving: false,
          }]);
        }
      } else {
        const resp = await fetch("/api/post/generate-carousel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand: selectedBrand, tema, formato, numSlides, approvedExamples }),
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        const result: GeneratedImage[] = [];
        await Promise.all(
          (data.slides as { story?: string; feed?: string; copy: { headline: string; subtitle: string; cta: string } }[]).map(
            async (slide, i) => {
              const copy: OverlayCopy = {
                headline: slide.copy.headline,
                subtitle: slide.copy.subtitle,
                cta: slide.copy.cta || "",
                handle: `@${selectedBrand.handle}`,
              };
              if (slide.story) {
                const src = await applyOverlay(slide.story, copy);
                result[i * (formato === "ambos" ? 2 : 1)] = {
                  label: `Slide ${i + 1}${formato === "ambos" ? " — Story" : ""}`,
                  src, aspect: "9/16", copy, approved: false, saving: false,
                };
              }
              if (slide.feed) {
                const src = await applyOverlay(slide.feed, copy);
                const idx = formato === "ambos" ? i * 2 + 1 : i;
                result[idx] = {
                  label: `Slide ${i + 1}${formato === "ambos" ? " — Feed" : ""}`,
                  src, aspect: "1/1", copy, approved: false, saving: false,
                };
              }
            }
          )
        );
        setImages(result.filter(Boolean));
      }
    } catch {
      setError("Erro ao gerar. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(index: number) {
    if (!user || !selectedBrand || !selectedBrandId) return;
    const img = images[index];
    if (img.approved || img.saving) return;

    setImages((prev) =>
      prev.map((im, i) => (i === index ? { ...im, saving: true } : im))
    );

    try {
      await saveApprovedPost(
        user.uid,
        {
          brandId: selectedBrandId,
          brandName: selectedBrand.name,
          tema,
          formato: img.aspect === "9/16" ? "story" : "feed",
          tipo,
          copy: { headline: img.copy.headline, subtitle: img.copy.subtitle, cta: img.copy.cta },
        },
        img.src
      );
      setImages((prev) =>
        prev.map((im, i) => (i === index ? { ...im, approved: true, saving: false } : im))
      );
    } catch {
      setImages((prev) =>
        prev.map((im, i) => (i === index ? { ...im, saving: false } : im))
      );
    }
  }

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
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch {
      setSuggestions([]);
      setShowSuggest(false);
    } finally {
      setLoadingSuggest(false);
    }
  }

  function handleDownload(src: string, label: string) {
    const a = document.createElement("a");
    a.href = src;
    a.download = `genara-${label.replace(/[\s/()—]/g, "-")}-${Date.now()}.png`;
    a.click();
  }

  function handleDownloadAll() {
    images.forEach((img, i) => {
      setTimeout(() => handleDownload(img.src, img.label), i * 400);
    });
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isMulti = images.length > 1;
  const loadingMsg = tipo === "carrossel"
    ? `Gerando roteiro + ${numSlides} slides${formato === "ambos" ? " × 2 formatos" : ""}... (~1 min)`
    : formato === "ambos" ? "Gerando Story e Feed..." : "Gerando...";

  return (
    <div className="min-h-screen bg-black px-4 py-10">
      <div className="max-w-6xl mx-auto space-y-8">

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* Painel esquerdo */}
          <div className="space-y-5">

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="flex gap-2">
                {(["post", "carrossel"] as Tipo[]).map((t) => (
                  <button key={t} onClick={() => setTipo(t)}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      tipo === t ? "border-green-400 bg-green-400/10 text-green-400" : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    {t === "post" ? "Post único" : "Carrossel"}
                  </button>
                ))}
              </div>
            </div>

            {/* Marca */}
            <div className="space-y-2">
              <Label>Marca</Label>
              <select value={selectedBrandId} onChange={(e) => setSelectedBrandId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
              >
                <option value="">Selecionar marca...</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

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
                <button type="button" onClick={handleSuggest}
                  disabled={!selectedBrandId || loadingSuggest}
                  className="px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-white text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {loadingSuggest
                    ? <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin inline-block" />
                    : "💡 Ideias"}
                </button>
              </div>
            </div>

            {/* Formato */}
            <div className="space-y-2">
              <Label>Formato</Label>
              <div className="flex gap-2">
                {([
                  { value: "story", label: "Story (9:16)" },
                  { value: "feed", label: "Feed (1:1)" },
                  { value: "ambos", label: "Ambos" },
                ] as { value: Formato; label: string }[]).map((f) => (
                  <button key={f.value} onClick={() => setFormato(f.value)}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      formato === f.value ? "border-green-400 bg-green-400/10 text-green-400" : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Slides (só carrossel) */}
            {tipo === "carrossel" && (
              <div className="space-y-2">
                <Label>Slides: <span className="text-green-400 font-semibold">{numSlides}</span></Label>
                <input type="range" min={3} max={5} value={numSlides}
                  onChange={(e) => setNumSlides(Number(e.target.value))}
                  className="w-full accent-green-400"
                />
                <div className="flex justify-between text-zinc-600 text-xs"><span>3</span><span>4</span><span>5</span></div>
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button onClick={handleGenerate} disabled={generating || !selectedBrandId || !tema}
              className="w-full bg-green-400 text-black hover:bg-green-300 font-semibold h-12 text-base"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Gerando...
                </span>
              ) : tipo === "carrossel" ? `Gerar carrossel (${numSlides} slides) →` : "Gerar post →"}
            </Button>
          </div>

          {/* Painel direito */}
          <div className="space-y-4">
            {generating ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm text-center px-4">{loadingMsg}</p>
              </div>
            ) : images.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center justify-center py-20 gap-2">
                <p className="text-zinc-600 text-sm">Os posts aparecem aqui</p>
                <p className="text-zinc-700 text-xs">Aprove os melhores para a IA aprender com eles ✓</p>
              </div>
            ) : (
              <>
                <div className={`grid gap-3 ${isMulti ? "grid-cols-2" : "grid-cols-1"}`}>
                  {images.map((img, i) => (
                    <div key={i} className="space-y-2">
                      <p className="text-zinc-500 text-xs">{img.label}</p>
                      <div className={`relative overflow-hidden rounded-lg bg-zinc-900 ${img.aspect === "9/16" ? "aspect-[9/16]" : "aspect-square"}`}>
                        <img src={img.src} alt={img.label} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleDownload(img.src, img.label)}
                          className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md transition-colors"
                        >
                          ↓ Baixar
                        </button>
                        <button
                          onClick={() => handleApprove(i)}
                          disabled={img.approved || img.saving}
                          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                            img.approved
                              ? "bg-green-400/20 text-green-400 cursor-default"
                              : img.saving
                              ? "bg-zinc-800 text-zinc-600 cursor-wait"
                              : "bg-zinc-800 hover:bg-green-400/10 hover:text-green-400 text-zinc-500 border border-zinc-700 hover:border-green-400/50"
                          }`}
                          title={img.approved ? "Aprovado — IA vai aprender com este post" : "Aprovar — ensinar a IA"}
                        >
                          {img.saving ? "..." : img.approved ? "✓ Aprovado" : "👍"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  {isMulti && (
                    <Button onClick={handleDownloadAll} className="flex-1 bg-green-400 text-black hover:bg-green-300 font-semibold">
                      ↓ Baixar todos ({images.length})
                    </Button>
                  )}
                  <Button onClick={handleGenerate} disabled={generating} variant="outline"
                    className={`border-zinc-800 text-zinc-400 hover:text-white ${isMulti ? "" : "flex-1"}`}
                  >
                    ↻ Gerar novamente
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de sugestões */}
      {showSuggest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setShowSuggest(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Ideias para {selectedBrand?.name}</h2>
              <button onClick={() => setShowSuggest(false)} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
            </div>
            {loadingSuggest ? (
              <div className="flex items-center justify-center py-8">
                <span className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button key={`${i}-${s}`} onClick={() => { setTema(s); setShowSuggest(false); }}
                    className="text-left px-4 py-3 rounded-xl bg-zinc-800 hover:bg-green-400/10 hover:border-green-400 border border-zinc-700 text-zinc-200 hover:text-white text-sm transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {!loadingSuggest && suggestions.length > 0 && (
              <button onClick={handleSuggest} className="w-full text-center text-zinc-500 hover:text-zinc-300 text-sm py-1 transition-colors">
                ↻ Gerar novas ideias
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GerarPage() {
  return (
    <Suspense><GerarContent /></Suspense>
  );
}
