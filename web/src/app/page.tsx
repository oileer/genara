"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? "/marcas" : "/login");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-3xl font-bold">
          <span className="text-white">gen</span>
          <span className="text-green-400">ara</span>
        </h1>
      </div>
    </div>
  );
}
