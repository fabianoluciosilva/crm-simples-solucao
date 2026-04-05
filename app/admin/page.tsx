"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface PropostaDB {
  id: number;
  created_at: string;
  numero: string;
  cliente: string;
  contato: string;
  telefone?: string;
  email: string;
  valor: number;
  status: string;
  status_envio: string;
  dados: any;
}

export default function AdminPage() {
  // --- ESTADOS DE AUTENTICAÇÃO ---
  const [session, setSession] = useState<any>(null);
  const [emailLogin, setEmailLogin] = useState("");
  const [senhaLogin, setSenhaLogin] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  const [carregandoAuth, setCarregandoAuth] = useState(true);

  // --- ESTADOS DO CRM ---
  const [aba, setAba] = useState<"propostas" | "leads">("propostas");
  const [propostas, setPropostas] = useState<PropostaDB[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroDias, setFiltroDias] = useState<number>(30);
  const [enviando, setEnviando] = useState<number | null>(null);

  // ─── LÓGICA DE SESSÃO DO SUPABASE ──────────────────────────────────────────
  useEffect(() => {
    // Verifica se já tem uma sessão ativa ao abrir a página
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCarregandoAuth(false);
    });

    // Fica "ouvindo" se o usuário deslogar ou logar em outra aba
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregandoAuth(true);
    setErroLogin("");

    const { error } = await supabase.auth.signInWithPassword({
      email: emailLogin,
      password: senhaLogin,
    });

    if (error) {
      setErroLogin("E-mail ou senha incorretos.");
    }
    setCarregandoAuth(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ─── CARREGAMENTO DE DADOS DO CRM ─────────────────────────────────────────
  useEffect(() => {
    if (session) {
      if (aba === "propostas") carregarDados();
      if (aba === "leads") carregarLeads();
    }
  }, [session, aba]);

  const carregarDados = async () => {
    setCarregando(true);
    const { data, error } = await supabase.from('propostas').select('*').order('created_at', { ascending: false });
    if (!error && data) setPropostas(data);
    setCarregando(false);
  };

  const carregarLeads = async () => {
    setCarregando(true);
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!error && data) setLeads(data);
    setCarregando(false);
  };

  // ─── AÇÕES DA TABELA ──────────────────────────────────────────────────────
  const excluirProposta = async (id: number, clienteNome: string) => {
    if (confirm(`Tem a certeza que deseja excluir a proposta de ${clienteNome}?`)) {
      const { error } = await supabase.from('propostas').delete().eq('id', id);
      if (!error) setPropostas(prev => prev.filter(p => p.id !== id));
    }
  };

  const alterarStatus = async (id: number, novoStatus: string) => {
    const { error } = await supabase.from('propostas').update({ status: novoStatus }).eq('id', id);
    if (!error) setPropostas(prev => prev.map(p => p.id === id ? { ...p, status: novoStatus } : p));
  };

  const enviarWhatsApp = (prop: PropostaDB) => {
    const primeiroNome = prop.contato ? prop.contato.split(" ")[0] : "cliente";
    const texto = `Olá ${primeiroNome}, tudo bem?\n\nSou da equipe comercial da Simples Solução TI. Conforme conversamos, estou a enviar em anexo a nossa proposta (cód: ${prop.numero}) para o suporte da *${prop.cliente}*, no valor mensal de ${fmt(prop.valor)}.\n\nQualquer dúvida, estou à disposição!`;
    const link = `https://wa.me/${prop.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(texto)}`;
    window.open(link, '_blank');
  };

  const enviarWhatsAppLead = (lead: any) => {
    const msg = `Olá ${lead.nome}, tudo bem? Sou da Simples Solução TI. Vi que você se interessou pela nossa solução de ${lead.produto} pelo nosso site. Podemos conversar um pouco sobre o ambiente da ${lead.empresa}?`;
    window.open(`https://wa.me/${lead.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const enviarPorEmail = async (prop: PropostaDB) => {
    if (!prop.email) return alert("Proposta sem e-mail cadastrado.");
    if (!confirm(`Enviar proposta para ${prop.email}?`)) return;

    setEnviando(prop.id);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: prop.email,
          subject: `Proposta Comercial SSTI - ${prop.cliente}`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
              <h2 style="color: #0a1628;">Proposta Comercial - Simples Solução TI</h2>
              <p>Olá <strong>${prop.contato}</strong>,</p>
              <p>É um prazer apresentar nossa proposta de suporte técnico para a <strong>${prop.cliente}</strong>.</p>
              <p>Valor Ofertado: <strong>${fmt(prop.valor)}</strong></p>
              <br />
              <p>Atenciosamente,</p>
              <p><strong>Equipe Comercial | Simples Solução TI</strong><br/>(21) 3529-7993 | www.simplessolucao.com.br</p>
            </div>
          `,
          fileName: `Proposta_${prop.numero}.pdf`
        }),
      });

      if (response.ok) {
        alert("E-mail enviado!");
        await supabase.from('propostas').update({ status_envio: 'enviado' }).eq('id', prop.id);
        carregarDados();
      } else alert("Falha ao enviar e-mail.");
    } catch (error) { alert("Erro de conexão."); } 
    finally { setEnviando(null); }
  };

  const visualizarProposta = (prop: PropostaDB) => {
    // Manter o mesmo código robusto de visualização que você já possui
    const dataFormatada = new Date(prop.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' });
    const origin = window.location.origin;
    const w = window.open("", "_blank")!;
    
    // ... Aqui o código do seu template PDF HTML ...
    w.document.write(`
      <html><head><title>Proposta - ${prop.cliente}</title></head><body>
      <h1>Proposta: ${prop.cliente} - ${fmt(prop.valor)}</h1>
      <p>O template visualizador será renderizado aqui.</p>
      </body></html>
    `);
    w.document.close();
  };

  const propostasFiltradas = propostas.filter(p => {
    if (filtroDias === 0) return true; 
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - filtroDias);
    return new Date(p.created_at) >= dataLimite;
  });

  const totalPropostas = propostasFiltradas.length;
  const propostasFechadas = propostasFiltradas.filter(p => p.status === 'fechada');
  const taxaConversao = totalPropostas > 0 ? (propostasFechadas.length / totalPropostas) * 100 : 0;
  const volumeFinanceiro = propostasFiltradas.reduce((acc, p) => acc + (p.valor || 0), 0);
  const receitaFechada = propostasFechadas.reduce((acc, p) => acc + (p.valor || 0), 0);
  const ticketMedio = totalPropostas > 0 ? volumeFinanceiro / totalPropostas : 0;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ─── TELA DE LOGIN (COM SUPABASE) ──────────────────────────────────────────
  if (carregandoAuth) {
    return <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#4A90D9", fontFamily: "sans-serif" }}>Carregando Acesso...</div>;
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap'); * { box-sizing: border-box; }`}</style>
        <div style={{ width: "100%", maxWidth: 400, background: "rgba(255,255,255,0.04)", border: `1px solid ${erroLogin ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 20, padding: "40px 36px", transition: "border-color 0.2s" }}>
          
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4A90D9", marginBottom: 10 }}>Simples Solução TI</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Portal do Colaborador</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Acesso Exclusivo à Equipe Comercial</div>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <input 
                type="email" 
                value={emailLogin} 
                onChange={e => setEmailLogin(e.target.value)} 
                placeholder="Seu E-mail Corporativo" 
                required
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 14, padding: "12px 16px", outline: "none" }} 
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <input 
                type="password" 
                value={senhaLogin} 
                onChange={e => setSenhaLogin(e.target.value)} 
                placeholder="Senha" 
                required
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: 14, padding: "12px 16px", outline: "none", letterSpacing: "0.15em" }} 
              />
            </div>
            
            {erroLogin && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 16, textAlign: "center", fontFamily: "'Outfit', sans-serif" }}>{erroLogin}</div>}

            <button type="submit" disabled={carregandoAuth} style={{ width: "100%", padding: "13px", borderRadius: 10, background: "#4A90D9", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", border: "none", cursor: carregandoAuth ? "not-allowed" : "pointer", opacity: carregandoAuth ? 0.7 : 1 }}>
              {carregandoAuth ? "Autenticando..." : "Fazer Login"}
            </button>
          </form>

        </div>
      </div>
    );
  }

  // ─── TELA DO PAINEL CRM (LOGADO) ──────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#080f1e", color: "#fff", paddingBottom: 60 }}>
      {/* ... (Todo o seu estilo CSS do Painel Admin permanece igual aqui) ... */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        .tabs { display: flex; gap: 24px; margin-top: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .tab-btn { background: transparent; border: none; padding: 12px 0; color: rgba(255,255,255,0.4); font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; border-bottom: 2px solid transparent; }
        .tab-btn.active { color: #4A90D9; border-bottom-color: #4A90D9; }
        /* Adicionei esta classe para o botão de Logout */
        .btn-logout { background: transparent; border: 1px solid rgba(248,113,113,0.3); color: #f87171; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; margin-left: 16px; transition: 0.2s; }
        .btn-logout:hover { background: rgba(248,113,113,0.1); }
      `}</style>

      {/* HEADER ATUALIZADO COM INFO DO USUÁRIO LOGADO E LOGOUT */}
      <div style={{ paddingTop: "20px" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4A90D9", marginBottom: 4 }}>Gestão Comercial</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>Painel de Oportunidades</div>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ textAlign: "right", marginRight: "16px", display: "none" /* Podemos exibir isso depois em telas grandes */ }}>
               <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Logado como:</span><br/>
               <strong style={{ fontSize: "13px" }}>{session.user.email}</strong>
            </div>
            <button onClick={() => window.location.href = '/preco'} style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              + Nova Proposta
            </button>
            <button onClick={handleLogout} className="btn-logout">Sair</button>
          </div>
        </div>
      </div>

      {/* ... (O restante da sua renderização: Abas, Métricas e Tabela permanecem EXATAMENTE iguais) ... */}
      <div className="container">
        <div className="tabs">
          <button className={`tab-btn ${aba === 'propostas' ? 'active' : ''}`} onClick={() => setAba('propostas')}>Propostas Enviadas</button>
          <button className={`tab-btn ${aba === 'leads' ? 'active' : ''}`} onClick={() => setAba('leads')}>Leads do Site</button>
        </div>
        
        <div style={{ padding: "40px 0", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
           (A Tabela e as Métricas do CRM continuam aqui)
        </div>
      </div>
    </div>
  );
}
