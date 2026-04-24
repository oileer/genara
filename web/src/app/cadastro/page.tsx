"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUpWithEmail, signInWithGoogle } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", whatsapp: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.whatsapp) return setError("WhatsApp é obrigatório.");
    setLoading(true);
    setError("");
    try {
      await signUpWithEmail(form.email, form.password, form.name, form.whatsapp);
      router.push("/marcas");
    } catch {
      setError("Erro ao criar conta. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!form.whatsapp) return setError("Informe seu WhatsApp antes de continuar.");
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle(form.whatsapp);
      router.push("/marcas");
    } catch {
      setError("Erro ao entrar com Google.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-white">gen</span>
            <span className="text-green-400">ara</span>
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">Crie sua conta grátis</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input placeholder="Seu nome" value={form.name} onChange={(e) => update("name", e.target.value)} required className="bg-zinc-900 border-zinc-800" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="seu@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} required className="bg-zinc-900 border-zinc-800" />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => update("password", e.target.value)} required className="bg-zinc-900 border-zinc-800" />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp <span className="text-green-400">*</span></Label>
            <Input placeholder="+55 11 99999-9999" value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} required className="bg-zinc-900 border-zinc-800" />
            <p className="text-xs text-zinc-500">Usado para suporte e novidades</p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" className="w-full bg-green-400 text-black hover:bg-green-300 font-semibold" disabled={loading}>
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-black px-2 text-zinc-500">ou</span>
          </div>
        </div>

        <Button variant="outline" className="w-full border-zinc-800 bg-zinc-900 hover:bg-zinc-800" onClick={handleGoogle} disabled={loading}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Cadastrar com Google
        </Button>

        <p className="text-center text-sm text-zinc-500">
          Já tem conta?{" "}
          <Link href="/login" className="text-green-400 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
