"use client";

/**
 * Página protegida por senha — Calculadora de Contratos SSTI
 *
 * ─── App Router (Next.js 13+) ────────────────────────────────────────────────
 * Salvar em: src/app/preco/page.tsx
 * A rota ficará disponível em: rj.simplessolucao.com.br/preco
 *
 * ─── Pages Router (Next.js 12 ou anterior) ───────────────────────────────────
 * Salvar em: src/pages/preco.tsx  (ou pages/preco.tsx)
 * A rota ficará disponível em: rj.simplessolucao.com.br/preco
 *
 * ─── Senha ───────────────────────────────────────────────────────────────────
 * Altere a constante SENHA abaixo para a senha que desejar.
 * Esta proteção é client-side (adequada para uso interno).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { CalculadoraSSTI } from "@/components/CalculadoraSSTI";

// ⚠️ ALTERE A SENHA AQUI
const SENHA = "Simples@923";

export default function PrecosPage() {
  const [input, setInput] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [erro, setErro] = useState(false);

  const handleLogin = () => {
    if (input === SENHA) {
      setAutenticado(true);
      setErro(false);
    } else {
      setErro(true);
      setInput("");
    }
  };

  if (autenticado) {
    return <CalculadoraSSTI />;
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080f1e",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${erro ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 20,
        padding: "40px 36px",
        transition: "border-color 0.2s",
      }}>
        {/* Logo / título */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#4A90D9",
            marginBottom: 10,
          }}>
            Simples Solução TI
          </div>
          <div style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 22,
            fontWeight: 800,
            color: "#fff",
            marginBottom: 8,
          }}>
            Calculadora de Contratos
          </div>
          <div style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 13,
            color: "rgba(255,255,255,0.35)",
          }}>
            Área restrita — uso interno
          </div>
        </div>

        {/* Ícone cadeado */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(74,144,217,0.1)",
            border: "1px solid rgba(74,144,217,0.2)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="#4A90D9" strokeWidth="1.8"/>
              <path d="M7 11V7a5 5 0 0110 0v4" stroke="#4A90D9" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="12" cy="16" r="1.5" fill="#4A90D9"/>
            </svg>
          </div>
        </div>

        {/* Campo de senha */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.4)",
            display: "block",
            marginBottom: 8,
          }}>
            Senha de acesso
          </label>
          <input
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setErro(false); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="••••••••"
            autoFocus
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${erro ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.12)"}`,
              borderRadius: 10,
              color: "#fff",
              fontFamily: "'DM Mono', monospace",
              fontSize: 16,
              padding: "12px 16px",
              outline: "none",
              letterSpacing: "0.15em",
              transition: "border-color 0.2s",
            }}
          />
          {erro && (
            <div style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 12,
              color: "#f87171",
              marginTop: 8,
            }}>
              Senha incorreta. Tente novamente.
            </div>
          )}
        </div>

        {/* Botão */}
        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: 10,
            background: "#4A90D9",
            color: "#fff",
            fontFamily: "'Outfit', sans-serif",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            border: "none",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#3a7bc8")}
          onMouseLeave={e => (e.currentTarget.style.background = "#4A90D9")}
        >
          Acessar →
        </button>

        <div style={{
          textAlign: "center",
          fontFamily: "'Outfit', sans-serif",
          fontSize: 11,
          color: "rgba(255,255,255,0.2)",
          marginTop: 20,
        }}>
          Pressione Enter para confirmar
        </div>
      </div>
    </div>
  );
}
