"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getPosts, Post } from "@/lib/posts";
import { Button } from "@/components/ui/button";

export default function HistoricoPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) getPosts(user.uid).then((p) => { setPosts(p); setFetching(false); });
  }, [user]);

  function handleDownload(url: string, index: number) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `genara-post-${index + 1}.png`;
    a.target = "_blank";
    a.click();
  }

  if (loading || fetching) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push("/marcas")} className="text-2xl font-bold">
            <span className="text-white">gen</span>
            <span className="text-green-400">ara</span>
          </button>
          <Button onClick={() => router.push("/gerar")} className="bg-green-400 text-black hover:bg-green-300 font-semibold">
            + Novo post
          </Button>
        </div>

        <div>
          <h1 className="text-xl font-semibold text-white">Histórico</h1>
          <p className="text-zinc-500 text-sm mt-1">{posts.length} post{posts.length !== 1 ? "s" : ""} gerado{posts.length !== 1 ? "s" : ""}</p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <p className="text-zinc-400">Nenhum post ainda.</p>
            <Button onClick={() => router.push("/gerar")} className="bg-green-400 text-black hover:bg-green-300 font-semibold">
              Gerar primeiro post
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map((post, i) => (
              <div key={post.id} className="group relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
                <div className="aspect-[9/16] overflow-hidden">
                  <img src={post.imageUrl} alt={post.tema} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-white text-xs font-medium truncate">{post.brandName}</p>
                  <p className="text-zinc-500 text-xs truncate">{post.tema}</p>
                  <button
                    onClick={() => handleDownload(post.imageUrl, i)}
                    className="w-full mt-2 py-1.5 text-xs bg-green-400 text-black rounded-md font-semibold hover:bg-green-300 transition-colors"
                  >
                    Baixar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
