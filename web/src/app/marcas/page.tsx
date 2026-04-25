"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getBrands, deleteBrand, Brand } from "@/lib/brands";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function MarcasPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      getBrands(user.uid).then((b) => { setBrands(b); setFetching(false); });
    }
  }, [user]);

  async function handleDelete(brandId: string) {
    if (!user || !confirm("Remover essa marca?")) return;
    await deleteBrand(user.uid, brandId);
    setBrands((b) => b.filter((br) => br.id !== brandId));
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Navbar */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            <span className="text-white">gen</span>
            <span className="text-green-400">ara</span>
          </h1>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push("/historico")} className="border-zinc-800 text-zinc-400 hover:text-white">
              Histórico
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => { await logout(); router.push("/login"); }} className="text-zinc-500 hover:text-white">
              Sair
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Minhas marcas</h2>
            <p className="text-zinc-500 text-sm mt-1">{brands.length} marca{brands.length !== 1 ? "s" : ""} cadastrada{brands.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={() => router.push("/marcas/nova")} className="bg-green-400 text-black hover:bg-green-300 font-semibold">
            + Nova marca
          </Button>
        </div>

        {/* Grid */}
        {brands.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="text-5xl">🏷️</div>
            <p className="text-zinc-400">Nenhuma marca ainda.</p>
            <Button onClick={() => router.push("/marcas/nova")} className="bg-green-400 text-black hover:bg-green-300 font-semibold">
              Cadastrar primeira marca
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.map((brand) => (
              <div key={brand.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex-shrink-0" style={{ backgroundColor: brand.colors.primary }} />
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{brand.name}</p>
                    <p className="text-zinc-500 text-xs truncate">@{brand.handle}</p>
                  </div>
                </div>
                <p className="text-zinc-400 text-sm line-clamp-2">{brand.segment}</p>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-green-400 text-black hover:bg-green-300 font-semibold text-sm h-9"
                    onClick={() => router.push(`/gerar?brandId=${brand.id}`)}
                  >
                    Gerar post
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 h-9"
                    onClick={() => router.push(`/marcas/${brand.id}`)}
                  >
                    ✎
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400 h-9"
                    onClick={() => handleDelete(brand.id!)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
