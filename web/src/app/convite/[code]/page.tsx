"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getInviteByCode, acceptInvite, Invite } from "@/lib/invites";
import { Button } from "@/components/ui/button";

export default function ConvitePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [invite, setInvite] = useState<Invite | null>(null);
  const [fetching, setFetching] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?redirect=/convite/${code}`);
  }, [user, loading, code, router]);

  useEffect(() => {
    if (!user) return;
    getInviteByCode(code)
      .then((inv) => {
        if (!inv) setError("Convite inválido ou já utilizado.");
        else if (inv.ownerId === user.uid) setError("Você não pode aceitar seu próprio convite.");
        else setInvite(inv);
      })
      .catch(() => setError("Erro ao buscar convite."))
      .finally(() => setFetching(false));
  }, [user, code]);

  async function handleAccept() {
    if (!invite?.id || !user) return;
    setAccepting(true);
    try {
      await acceptInvite(invite.id, invite, user.uid);
      setDone(true);
      setTimeout(() => router.push("/marcas"), 2000);
    } catch {
      setError("Erro ao aceitar convite.");
    } finally {
      setAccepting(false);
    }
  }

  if (loading || fetching) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-bold">
          <span className="text-white">gen</span>
          <span className="text-green-400">ara</span>
        </h1>

        {done ? (
          <div className="space-y-2">
            <p className="text-2xl">✓</p>
            <p className="text-white font-semibold">Acesso concedido!</p>
            <p className="text-zinc-400 text-sm">Redirecionando para suas marcas...</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <p className="text-red-400">{error}</p>
            <Button onClick={() => router.push("/marcas")} variant="outline" className="border-zinc-800 text-zinc-400">
              Ir para marcas
            </Button>
          </div>
        ) : invite ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <div className="space-y-1">
              <p className="text-zinc-400 text-sm">Você foi convidado por</p>
              <p className="text-white font-semibold">{invite.ownerName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-400 text-sm">para colaborar na marca</p>
              <p className="text-green-400 font-bold text-xl">{invite.brandName}</p>
            </div>
            <p className="text-zinc-500 text-xs">Você poderá ver e editar essa marca na sua conta.</p>
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full bg-green-400 text-black hover:bg-green-300 font-semibold h-12"
            >
              {accepting ? "Aceitando..." : "Aceitar convite →"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
