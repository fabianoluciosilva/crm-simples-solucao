"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CalculadoraSSTI } from "@/components/CalculadoraSSTI";

export default function PrecoPage() {
  const [session, setSession] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // Busca a sessão que foi salva no navegador ao fazer login no Admin
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCarregando(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Tela de carregamento rápida enquanto o Supabase confere o token
  if (carregando) {
    return (
      <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#4A90D9", fontFamily: "'Outfit', sans-serif" }}>
        Validando acesso...
      </div>
    );
  }

  // Se tentar acessar a calculadora direto pelo link sem estar logado, manda para o painel de login
  if (!session) {
    if (typeof window !== "undefined") {
      window.location.href = '/admin';
    }
    return <div style={{ minHeight: "100vh", background: "#080f1e" }}></div>;
  }

  // Se estiver logado, exibe a calculadora normalmente
  return <CalculadoraSSTI />;
}
