"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { updateUserDoc } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!whatsapp.trim()) return setError("WhatsApp é obrigatório.");
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      await updateUserDoc(user.uid, { whatsapp: whatsapp.trim() });
      router.push("/marcas");
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-white">gen</span>
            <span className="text-green-400">ara</span>
          </h1>
          <p className="text-white font-semibold mt-4 text-lg">Quase lá!</p>
          <p className="text-zinc-400 mt-1 text-sm">Só precisamos do seu WhatsApp para suporte e novidades.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>WhatsApp <span className="text-green-400">*</span></Label>
            <Input
              placeholder="+55 11 99999-9999"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              className="bg-zinc-900 border-zinc-800"
              autoFocus
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button
            type="submit"
            disabled={saving || !whatsapp.trim()}
            className="w-full bg-green-400 text-black hover:bg-green-300 font-semibold h-12"
          >
            {saving ? "Salvando..." : "Continuar →"}
          </Button>
        </form>
      </div>
    </div>
  );
}
