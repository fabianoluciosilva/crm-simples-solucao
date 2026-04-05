"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [logando, setLogando] = useState(false);

  // 1. Verifica se a Equipe já está logada
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Se já estiver logado, manda direto para o CRM
        router.push("/admin");
      } else {
        setCarregando(false);
      }
    });
  }, [router]);

  // 2. Função de Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogando(true);
    setErro("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro("Credenciais inválidas. Tente novamente.");
      setLogando(false);
    } else {
      // Login com sucesso, vai para o CRM
      router.push("/admin");
    }
  };

  if (carregando) {
    return <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#4A90D9", fontFamily: "'Outfit', sans-serif" }}>A carregar ambiente seguro...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        
        /* Efeitos visuais de fundo para dar um ar mais "tech" */
        .glow-bg {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(74,144,217,0.1) 0%, rgba(8,15,30,0) 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 0;
          pointer-events: none;
        }
      `}</style>

      <div className="glow-bg"></div>

      <div style={{ width: "100%", maxWidth: 420, background: "rgba(255,255,255,0.03)", border: `1px solid ${erro ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 24, padding: "48px 40px", zIndex: 1, backdropFilter: "blur(10px)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
        
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          {/* LOGO OFICIAL NEGATIVA DA SIMPLES SOLUÇÃO TI */}
          <img 
            src="/Logo-negativo.webp" 
            alt="Simples Solução TI" 
            style={{ maxHeight: "80px", objectFit: "contain", marginBottom: "20px" }} 
          />

          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 8px 0" }}>CRM Comercial</h1>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0 }}>Acesso Restrito</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>E-mail Corporativo</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="exemplo@simplessolucao.com.br" 
              required
              style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 15, padding: "14px 16px", outline: "none", transition: "border-color 0.2s" }} 
              onFocus={e => e.target.style.borderColor = "rgba(74,144,217,0.5)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
          </div>
          
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Senha de Acesso</label>
            <input 
              type="password" 
              value={senha} 
              onChange={e => setSenha(e.target.value)} 
              placeholder="••••••••" 
              required
              style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: 15, padding: "14px 16px", outline: "none", transition: "border-color 0.2s", letterSpacing: "0.1em" }} 
              onFocus={e => e.target.style.borderColor = "rgba(74,144,217,0.5)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
          </div>
          
          {erro && (
            <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13, marginBottom: 20, textAlign: "center", fontFamily: "'Outfit', sans-serif" }}>
              {erro}
            </div>
          )}

          <button 
            type="submit" 
            disabled={logando} 
            style={{ width: "100%", padding: "16px", borderRadius: 12, background: "#4A90D9", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", border: "none", cursor: logando ? "not-allowed" : "pointer", opacity: logando ? 0.7 : 1, transition: "background 0.2s, transform 0.1s" }}
            onMouseOver={e => !logando && (e.currentTarget.style.background = "#3a7bc8")}
            onMouseOut={e => !logando && (e.currentTarget.style.background = "#4A90D9")}
            onMouseDown={e => !logando && (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={e => !logando && (e.currentTarget.style.transform = "scale(1)")}
          >
            {logando ? "A validar credenciais..." : "Entrar no Sistema"}
          </button>
        </form>
        
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
            &copy; {new Date().getFullYear()} Simples Solução TI.<br/>Sistema de uso restrito.
          </p>
        </div>

      </div>
    </div>
  );
}
