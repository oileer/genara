"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getBrands, Brand } from "@/lib/brands";
import { getHistory, HistoryPost } from "@/lib/history";
import { Button } from "@/components/ui/button";

function HistoricoContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState(params.get("brandId") || "");
  const [posts, setPosts] = useState<HistoryPost[]>([]);
  const [fetching, setFetching] = useState(false);
  const [editModal, setEditModal] = useState<{ post: HistoryPost } | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) getBrands(user.uid).then(setBrands);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    getHistory(user.uid, selectedBrandId || undefined, 60)
      .then(setPosts)
      .finally(() => setFetching(false));
  }, [user, selectedBrandId]);

  async function handleEdit() {
    if (!editModal || !editInstruction.trim()) return;
    setEditing(true);
    try {
      const resp = await fetch("/api/post/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: editModal.post.imageUrl, instruction: editInstruction }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setPosts((prev) => prev.map((p) =>
        p.id === editModal.post.id ? { ...p, imageUrl: data.image } : p
      ));
      setEditModal(null);
      setEditInstruction("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao editar.");
    } finally {
      setEditing(false);
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-10">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Navbar */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.push("/marcas")} className="text-2xl font-bold">
            <span className="text-white">gen</span>
            <span className="text-green-400">ara</span>
          </button>
          <div className="flex gap-3">
            <Button onClick={() => router.push("/gerar")} className="bg-green-400 text-black hover:bg-green-300 font-semibold text-sm h-9">
              + Gerar post
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/marcas")} className="border-zinc-800 text-zinc-400 hover:text-white">
              ← Marcas
            </Button>
          </div>
        </div>

        {/* Header + filtro */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Histórico</h2>
            <p className="text-zinc-500 text-sm mt-1">{posts.length} post{posts.length !== 1 ? "s" : ""}</p>
          </div>
          <select
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
          >
            <option value="">Todas as marcas</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Grid */}
        {fetching ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="text-5xl">🖼️</div>
            <p className="text-zinc-400">Nenhum post gerado ainda.</p>
            <Button onClick={() => router.push("/gerar")} className="bg-green-400 text-black hover:bg-green-300 font-semibold">
              Gerar primeiro post
            </Button>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="break-inside-avoid rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 group relative">
                <img
                  src={post.imageUrl}
                  alt={post.copy.headline}
                  className="w-full object-cover"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-1">
                  <p className="text-white text-xs font-bold line-clamp-2">{post.copy.headline}</p>
                  {post.copy.subtitle && <p className="text-zinc-300 text-xs line-clamp-1">{post.copy.subtitle}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-zinc-500 text-xs">{post.brandName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${post.approved ? "bg-green-400 text-black font-semibold" : "bg-zinc-700 text-zinc-300"}`}>
                      {post.approved ? "✓ Aprovado" : post.tipo}
                    </span>
                    <span className="text-zinc-600 text-xs">{post.formato}</span>
                  </div>
                </div>
                {post.approved && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-green-400 rounded-full flex items-center justify-center text-black text-xs font-bold shadow">✓</div>
                )}
                <a
                  href={post.imageUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="absolute top-2 left-2 w-7 h-7 bg-black/60 rounded-full items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                >
                  ↓
                </a>
                <button
                  onClick={() => { setEditModal({ post }); setEditInstruction(""); }}
                  className="absolute bottom-2 right-2 w-7 h-7 bg-black/60 hover:bg-green-400/80 rounded-full items-center justify-center text-white hover:text-black text-xs opacity-0 group-hover:opacity-100 transition-all hidden group-hover:flex"
                  title="Editar com IA"
                >
                  ✎
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de edição */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={() => !editing && setEditModal(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Editar com IA</h2>
              <button onClick={() => !editing && setEditModal(null)} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className={`mx-auto rounded-lg overflow-hidden bg-zinc-800 ${
              editModal.post.formato === "story"
                ? "w-48 aspect-[9/16]"
                : "w-full aspect-square"
            }`}>
              <img src={editModal.post.imageUrl} alt="preview" className="w-full h-full object-cover" />
            </div>
            <div className="space-y-2">
              <p className="text-zinc-400 text-xs">Descreva o que quer mudar na imagem:</p>
              <textarea
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                placeholder="Ex: mude o fundo para vermelho, troque o objeto por um ícone do Facebook, deixe o texto maior..."
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-green-400 resize-none"
              />
            </div>
            <button
              onClick={handleEdit}
              disabled={editing || !editInstruction.trim()}
              className="w-full py-3 bg-green-400 hover:bg-green-300 text-black font-semibold rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {editing ? (
                <><span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> Editando...</>
              ) : "Aplicar edição →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoricoPage() {
  return (
    <Suspense>
      <HistoricoContent />
    </Suspense>
  );
}
