"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getBrands, updateBrand, uploadReferenceImage, Brand } from "@/lib/brands";
import { createInvite, getBrandInvites, Invite } from "@/lib/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EditarMarcaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const brandId = params.id as string;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteLink, setInviteLink] = useState("");
  const [inviting, setInviting] = useState(false);
  const isOwner = brand?.ownerId === user?.uid || !brand?.ownerId;

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      getBrands(user.uid).then((brands) => {
        const found = brands.find((b) => b.id === brandId);
        if (found) {
          setBrand(found);
          if (found.ownerId === user.uid || !found.ownerId) {
            getBrandInvites(user.uid, brandId).then(setInvites).catch(() => {});
          }
        } else router.replace("/marcas");
      }).catch(() => router.replace("/marcas"));
    }
  }, [user, brandId, router]);

  async function handleSave() {
    if (!user || !brand) return;
    setSaving(true);
    setError("");
    try {
      const { id, createdAt, updatedAt, ...data } = brand;
      void id; void createdAt; void updatedAt;
      await updateBrand(user.uid, brandId, data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadReference(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !brand || !e.target.files?.length) return;
    setUploading(true);
    try {
      const files = Array.from(e.target.files).slice(0, 6);
      const urls = await Promise.all(
        files.map((f) => uploadReferenceImage(user.uid, brandId, f))
      );
      const updated = [...(brand.reference_images || []), ...urls].slice(-8);
      setBrand((b) => b ? { ...b, reference_images: updated } : b);
      await updateBrand(user.uid, brandId, { reference_images: updated });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Erro ao fazer upload: ${msg}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleCreateInvite() {
    if (!user || !brand || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const code = await createInvite(user.uid, user.displayName || user.email || "Usuário", brandId, brand.name, inviteEmail.trim());
      const link = `${window.location.origin}/convite/${code}`;
      setInviteLink(link);
      setInviteEmail("");
      getBrandInvites(user.uid, brandId).then(setInvites).catch(() => {});
    } catch {
      setError("Erro ao criar convite.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveReference(url: string) {
    if (!user || !brand) return;
    const updated = (brand.reference_images || []).filter((u) => u !== url);
    setBrand((b) => b ? { ...b, reference_images: updated } : b);
    await updateBrand(user.uid, brandId, { reference_images: updated });
  }

  if (loading || !brand) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-xl mx-auto space-y-8">

        <div>
          <button onClick={() => router.push("/marcas")} className="text-zinc-500 text-sm hover:text-white mb-4 block">
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold text-white">{brand.name}</h1>
          <p className="text-zinc-500 text-sm">@{brand.handle}</p>
        </div>

        {/* Campos básicos */}
        <div className="space-y-4">
          <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Identidade</h2>

          {[
            { label: "Nome", field: "name" as keyof Brand },
            { label: "Segmento / Público-alvo", field: "segment" as keyof Brand },
            { label: "Tom de voz", field: "tone" as keyof Brand },
            { label: "Estilo visual", field: "visual_style" as keyof Brand },
          ].map(({ label, field }) => (
            <div key={field} className="space-y-1.5">
              <Label>{label}</Label>
              <Input
                value={(brand[field] as string) || ""}
                onChange={(e) => setBrand((b) => b ? { ...b, [field]: e.target.value } : b)}
                className="bg-zinc-900 border-zinc-800"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            {Object.entries(brand.colors).map(([key, val]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs capitalize">{key}</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={val}
                    onChange={(e) => setBrand((b) => b ? { ...b, colors: { ...b.colors, [key]: e.target.value } } : b)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <Input value={val}
                    onChange={(e) => setBrand((b) => b ? { ...b, colors: { ...b.colors, [key]: e.target.value } } : b)}
                    className="bg-zinc-900 border-zinc-800 text-sm h-8"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Imagens de referência */}
        <div className="space-y-4">
          <div>
            <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Imagens de referência</h2>
            <p className="text-zinc-500 text-xs mt-1">Posts do seu Instagram ou imagens que representam o estilo da marca. A IA usa como contexto visual para gerar posts.</p>
          </div>

          {/* Grid de uploads existentes */}
          {(brand.reference_images || []).length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {(brand.reference_images || []).map((url) => (
                <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-zinc-800">
                  <img src={url} alt="referência" className="w-full h-full object-cover" />
                  <button
                    onClick={() => handleRemoveReference(url)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/80 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${
            uploading ? "border-zinc-700 opacity-50 cursor-wait" : "border-zinc-700 hover:border-green-400/50 hover:bg-green-400/5"
          }`}>
            {uploading ? (
              <>
                <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-zinc-400 text-sm">Fazendo upload...</span>
              </>
            ) : (
              <>
                <span className="text-2xl">📸</span>
                <span className="text-zinc-400 text-sm font-medium">Adicionar fotos de referência</span>
                <span className="text-zinc-600 text-xs">PNG, JPG — até 6 de uma vez · máx 8 no total</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUploadReference}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Colaboradores — só dono vê */}
        {isOwner && (
          <div className="space-y-4">
            <div>
              <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Colaboradores</h2>
              <p className="text-zinc-500 text-xs mt-1">Gere um link de convite para dar acesso a essa marca.</p>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Email do colaborador (opcional)"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="bg-zinc-900 border-zinc-800 flex-1 text-sm"
              />
              <Button onClick={handleCreateInvite} disabled={inviting} className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 whitespace-nowrap">
                {inviting ? "..." : "Gerar convite"}
              </Button>
            </div>

            {inviteLink && (
              <div className="bg-zinc-900 border border-green-400/30 rounded-lg p-3 space-y-2">
                <p className="text-green-400 text-xs font-semibold">Link gerado — compartilhe com o colaborador:</p>
                <div className="flex gap-2 items-center">
                  <p className="text-zinc-300 text-xs break-all flex-1">{inviteLink}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(inviteLink); }}
                    className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors whitespace-nowrap"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            )}

            {invites.length > 0 && (
              <div className="space-y-2">
                <p className="text-zinc-500 text-xs">Convites enviados:</p>
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-xs px-3 py-2 bg-zinc-900 rounded-lg border border-zinc-800">
                    <span className="text-zinc-400">{inv.email || "Sem email"}</span>
                    <span className={`px-2 py-0.5 rounded-full ${inv.status === "accepted" ? "bg-green-400/20 text-green-400" : "bg-zinc-700 text-zinc-400"}`}>
                      {inv.status === "accepted" ? "✓ Aceito" : "Pendente"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Button
          onClick={handleSave}
          disabled={saving}
          className={`w-full font-semibold h-12 ${saved ? "bg-green-400/20 text-green-400 border border-green-400/30" : "bg-green-400 text-black hover:bg-green-300"}`}
        >
          {saving ? "Salvando..." : saved ? "✓ Salvo!" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
