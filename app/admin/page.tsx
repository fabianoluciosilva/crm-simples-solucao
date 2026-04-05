"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  // --- ESTADOS GERAIS ---
  const [session, setSession] = useState<any>(null);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [tema, setTema] = useState<"dark" | "light">("dark");

  // --- ESTADOS DO CRM ---
  const [aba, setAba] = useState<"propostas" | "leads">("propostas");
  const [propostas, setPropostas] = useState<PropostaDB[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroDias, setFiltroDias] = useState<number>(30);
  const [enviando, setEnviando] = useState<number | null>(null);

  // ─── LÓGICA DO TEMA (DARK/LIGHT MODE) ────────────────────────────────────
  useEffect(() => {
    const temaSalvo = localStorage.getItem("tema_ssti");
    if (temaSalvo === "light" || temaSalvo === "dark") {
      setTema(temaSalvo);
    }
  }, []);

  const alternarTema = () => {
    const novoTema = tema === "dark" ? "light" : "dark";
    setTema(novoTema);
    localStorage.setItem("tema_ssti", novoTema);
  };

  // ─── LÓGICA DE SESSÃO DO SUPABASE ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/");
      } else {
        setSession(session);
        setCarregandoAuth(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/");
      else setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // ─── CARREGAMENTO DE DADOS DO CRM ─────────────────────────────────────────
  useEffect(() => {
    if (session) {
      if (aba === "propostas") carregarDados();
      if (aba === "leads") carregarLeads();
    }
  }, [session, aba, filtroDias]);

  const carregarDados = async () => {
    setCarregando(true);
    const { data, error } = await supabase.from('propostas').select('*').order('created_at', { ascending: false });
    if (!error && data) setPropostas(data);
    else console.error("Erro ao carregar propostas:", error);
    setCarregando(false);
  };

  const carregarLeads = async () => {
    setCarregando(true);
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!error && data) setLeads(data);
    else console.error("Erro ao carregar leads:", error);
    setCarregando(false);
  };

  // ─── AÇÕES DA TABELA ──────────────────────────────────────────────────────
  const excluirProposta = async (id: number, clienteNome: string) => {
    if (confirm(`Tem a certeza que deseja excluir permanentemente a proposta de ${clienteNome}?`)) {
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
    const texto = `Olá ${primeiroNome}, tudo bem?\n\nSou da Simples Solução TI. Conforme conversámos, estou a enviar a nossa proposta comercial (cód: ${prop.numero}) para o suporte e gestão de TI da *${prop.cliente}*, no valor de ${fmt(prop.valor)} mensais.\n\nQualquer dúvida, estou à total disposição!`;
    const link = `https://wa.me/${prop.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(texto)}`;
    window.open(link, '_blank');
  };

  const enviarWhatsAppLead = (lead: any) => {
    const msg = `Olá ${lead.nome}, tudo bem? Sou da Simples Solução TI. Vi que demonstrou interesse na nossa solução de ${lead.produto} pelo nosso site. Podemos conversar um pouco sobre o ambiente da ${lead.empresa}?`;
    window.open(`https://wa.me/${lead.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ─── DISPARO DE E-MAIL ─────────────────────────────────────────────
  const enviarPorEmail = async (prop: PropostaDB) => {
    if (!prop.email) return alert("Esta proposta não possui o e-mail do cliente registado.");
    if (!confirm(`Confirmar envio de proposta para ${prop.email}?`)) return;

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
              <p>É um prazer apresentar a nossa proposta de suporte técnico para a <strong>${prop.cliente}</strong>.</p>
              <p>Conforme conversámos, segue o detalhamento dos nossos serviços com foco na evolução contínua e segurança do seu ambiente de TI.</p>
              <p><strong>Valor Mensal Ofertado:</strong> ${fmt(prop.valor)}</p>
              <br />
              <p>Atenciosamente,</p>
              <p><strong>Equipa Comercial | Simples Solução TI</strong><br/>(21) 3529-7993 | www.simplessolucao.com.br</p>
            </div>
          `,
          fileName: `Proposta_${prop.numero}.pdf`
        }),
      });

      if (response.ok) {
        alert("E-mail enviado com sucesso!");
        await supabase.from('propostas').update({ status_envio: 'enviado' }).eq('id', prop.id);
        carregarDados();
      } else {
        alert("Falha ao enviar e-mail. Verifique a API.");
      }
    } catch (error) {
      alert("Erro na conexão com o servidor de e-mail.");
    } finally {
      setEnviando(null);
    }
  };

  // ─── VISUALIZAR PDF ───────────────────────────────────────────────────────
  const visualizarProposta = (prop: PropostaDB) => {
    const dataFormatada = new Date(prop.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' });
    const nomeCliente = prop.cliente || "Empresa Não Identificada";
    const nomeContato = prop.contato || "Cliente";
    const obs = prop.dados?.obs || "";
    const origin = window.location.origin;

    const w = window.open("", "_blank")!;
    w.document.write(`
      <html><head><title>Proposta Comercial - ${nomeCliente}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');
        body { font-family: 'Montserrat', Arial, sans-serif; color: #333; padding: 0; margin: 0; font-size: 14px; line-height: 1.6; }
        .page { max-width: 800px; margin: 0 auto; padding: 40px; }
        h1 { color: #0a1628; font-size: 26px; border-bottom: 2px solid #4A90D9; padding-bottom: 10px; }
        h2 { color: #4A90D9; font-size: 20px; margin-top: 40px; margin-bottom: 15px; }
        h3 { color: #0a1628; font-size: 16px; margin-top: 25px; }
        p { margin-bottom: 15px; text-align: justify; }
        ul { margin-bottom: 20px; }
        li { margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; font-size: 14px; }
        th { background: #0a1628; color: #fff; padding: 12px; text-align: left; }
        td { padding: 10px 12px; border-bottom: 1px solid #ddd; }
        .row-total td { font-size: 18px; font-weight: bold; background: #f8f9fa; border-top: 2px solid #0a1628; border-bottom: 2px solid #0a1628; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 50px; }
        .info-doc { text-align: right; font-size: 12px; color: #666; }
        .assinatura { margin-top: 60px; font-weight: bold; }
        .assinatura-dados { font-weight: normal; font-size: 13px; color: #555; }
        .logos { display: flex; gap: 30px; flex-wrap: wrap; margin-top: 15px; align-items: center; }
        .logos img { max-height: 50px; max-width: 140px; object-fit: contain; filter: grayscale(100%); transition: filter 0.3s; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page-break { page-break-before: always; } .logos img { filter: grayscale(0%); } }
      </style></head><body>
      
      <div class="page">
        <div class="header">
          <div><h2 style="margin: 0; color: #0a1628;">Simples Solução TI</h2></div>
          <div class="info-doc"><strong>Proposta:</strong> ${prop.numero}<br><strong>Data:</strong> ${dataFormatada}<br><strong>Empresa:</strong> ${nomeCliente}</div>
        </div>
        <h1>PROPOSTA DE SUPORTE TÉCNICO</h1>
        <p>Rio de Janeiro, ${dataFormatada}</p>
        <p>Prezada(o) <strong>${nomeContato}</strong>,</p>
        <p>Agradecemos a oportunidade de apresentar a nossa empresa e discutir possíveis caminhos para o futuro da <strong>${nomeCliente}</strong>.</p>
        <p>Este documento tem como objetivo definir o escopo de trabalho a ser empregado na prestação de serviço de suporte de informática à <strong>${nomeCliente}</strong>. Esse serviço tem o objetivo de auxiliar o ambiente de TI da empresa para uma evolução contínua, minimizando problemas e possíveis riscos existentes.</p>
        <div class="assinatura">Equipa Comercial<br><span class="assinatura-dados">Simples Solução TI<br>(21) 3529-7993<br>www.simplessolucao.com.br</span></div>
        <div class="page-break"></div>
        <h2>A Empresa</h2>
        <p>A Simples Solução TI é uma integradora de tecnologia que oferece soluções de apoio à área de TI dos seus clientes.</p>
        <ul><li>Suporte a Desktops, plataforma Microsoft, Linux, Mac e servidores Windows;</li><li>Suporte para deteção de problemas com Hardware, computadores, impressoras e nobreaks;</li></ul>
        <div class="page-break"></div>
        <h2>Proposta Comercial</h2>
        <table>
          <tr><th>Descrição do Serviço</th><th style="text-align: right; width: 200px;">Valor Mensal</th></tr>
          <tr class="row-total"><td style="padding: 20px 12px;">Manutenção TI</td><td style="text-align: right; color: #4A90D9; padding: 20px 12px;">${fmt(prop.valor)}</td></tr>
        </table>
        ${obs ? `<h3>Observações</h3><p style="background: #f8f9fa; padding: 15px; border-left: 4px solid #4A90D9;">${obs.replace(/\n/g, '<br>')}</p>` : ""}
      </div>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => { w.document.title = `Proposta_${nomeCliente.replace(/\s+/g, '_')}_${prop.numero}`; w.print(); }, 500);
  };

  // ─── LÓGICA DE FILTRAGEM TEMPORAL ─────────────────────────────────────────
  const propostasFiltradas = propostas.filter(p => {
    if (filtroDias === 0) return true; 
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - filtroDias);
    return new Date(p.created_at) >= dataLimite;
  });

  const totalPropostas = propostasFiltradas.length;
  const propostasFechadas = propostasFiltradas.filter(p => p.status === 'fechada');
  const propostasPerdidas = propostasFiltradas.filter(p => p.status === 'perdida');
  const taxaConversao = totalPropostas > 0 ? (propostasFechadas.length / totalPropostas) * 100 : 0;
  const volumeFinanceiro = propostasFiltradas.reduce((acc, p) => acc + (p.valor || 0), 0);
  const receitaFechada = propostasFechadas.reduce((acc, p) => acc + (p.valor || 0), 0);
  const ticketMedio = totalPropostas > 0 ? volumeFinanceiro / totalPropostas : 0;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (carregandoAuth) {
    return <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#4A90D9", fontFamily: "sans-serif" }}>A validar sessão...</div>;
  }

  // ─── ESTRUTURA DO DASHBOARD (CSS DINÂMICO BASEADO NO TEMA) ───────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        
        /* Variáveis Dinâmicas de Tema */
        :root {
          --bg-main: ${tema === 'dark' ? '#080f1e' : '#f4f7f9'};
          --bg-sidebar: ${tema === 'dark' ? '#050a14' : '#ffffff'};
          --bg-card: ${tema === 'dark' ? 'rgba(255,255,255,0.02)' : '#ffffff'};
          --bg-hover: ${tema === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc'};
          --text-primary: ${tema === 'dark' ? '#ffffff' : '#0f172a'};
          --text-secondary: ${tema === 'dark' ? 'rgba(255,255,255,0.5)' : '#64748b'};
          --text-tertiary: ${tema === 'dark' ? 'rgba(255,255,255,0.3)' : '#94a3b8'};
          --border-light: ${tema === 'dark' ? 'rgba(255,255,255,0.05)' : '#e2e8f0'};
          --border-medium: ${tema === 'dark' ? 'rgba(255,255,255,0.1)' : '#cbd5e1'};
          --table-header: ${tema === 'dark' ? 'rgba(0,0,0,0.2)' : '#f8fafc'};
          --profile-bg: ${tema === 'dark' ? 'rgba(0,0,0,0.2)' : '#f8fafc'};
          --shadow-card: ${tema === 'dark' ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)'};
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        /* Layout Principal */
        body { background: var(--bg-main); color: var(--text-primary); transition: background 0.3s, color 0.3s; }
        .sidebar { width: 260px; background: var(--bg-sidebar); border-right: 1px solid var(--border-light); display: flex; flex-direction: column; position: fixed; top: 0; bottom: 0; left: 0; z-index: 10; transition: background 0.3s; }
        .main-content { flex: 1; margin-left: 260px; padding: 32px 40px; display: flex; flex-direction: column; min-height: 100vh; background: var(--bg-main); color: var(--text-primary); transition: background 0.3s; }
        
        /* Menu Lateral */
        .sidebar-logo { padding: 30px 24px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: center; }
        .nav-menu { padding: 24px 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; color: var(--text-secondary); font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; background: transparent; text-align: left; width: 100%; }
        .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .nav-item.active { background: rgba(74,144,217,0.1); color: #4A90D9; }
        
        .user-profile { padding: 20px 24px; border-top: 1px solid var(--border-light); background: var(--profile-bg); }
        .btn-logout { background: transparent; border: 1px solid rgba(248,113,113,0.3); color: #f87171; padding: 8px 0; border-radius: 8px; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; width: 100%; margin-top: 12px; transition: 0.2s; }
        .btn-logout:hover { background: rgba(248,113,113,0.1); }

        /* Cards e Tabelas */
        .grid-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .metric-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow-card); transition: all 0.3s; }
        .metric-title { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-secondary); }
        .metric-value { font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 800; color: var(--text-primary); }
        .metric-value.highlight { color: #4A90D9; }
        .metric-value.success { color: #22c55e; }
        
        .table-wrapper { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-card); transition: all 0.3s; }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-secondary); padding: 16px 20px; border-bottom: 1px solid var(--border-light); background: var(--table-header); }
        td { font-family: 'Outfit', sans-serif; font-size: 14px; color: var(--text-primary); padding: 16px 20px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: var(--bg-hover); }
        
        /* Badges e Botões */
        .badge-status { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-family: 'Outfit', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .badge-aberta { background: rgba(245,158,11,0.15); color: ${tema === 'dark' ? '#f59e0b' : '#d97706'}; border: 1px solid rgba(245,158,11,0.3); }
        .badge-fechada { background: rgba(34,197,94,0.15); color: ${tema === 'dark' ? '#22c55e' : '#16a34a'}; border: 1px solid rgba(34,197,94,0.3); }
        .badge-perdida { background: rgba(156,163,175,0.15); color: ${tema === 'dark' ? '#9ca3af' : '#4b5563'}; border: 1px solid rgba(156,163,175,0.3); }
        .badge-email { background: rgba(168,85,247,0.15); color: ${tema === 'dark' ? '#a855f7' : '#9333ea'}; border: 1px solid rgba(168,85,247,0.3); margin-top: 4px;}
        
        .btn-action { padding: 6px 12px; border-radius: 6px; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
        .btn-view { background: ${tema === 'dark' ? 'rgba(255,255,255,0.1)' : '#f1f5f9'}; color: var(--text-primary); border-color: ${tema === 'dark' ? 'rgba(255,255,255,0.2)' : '#cbd5e1'}; margin-right: 8px; }
        .btn-view:hover { background: ${tema === 'dark' ? 'rgba(255,255,255,0.2)' : '#e2e8f0'}; }
        .btn-wpp { background: rgba(34,197,94,0.1); color: ${tema === 'dark' ? '#22c55e' : '#16a34a'}; border-color: rgba(34,197,94,0.2); margin-right: 8px; }
        .btn-wpp:hover { background: rgba(34,197,94,0.2); }
        .btn-email { background: rgba(168,85,247,0.1); color: ${tema === 'dark' ? '#a855f7' : '#9333ea'}; border-color: rgba(168,85,247,0.2); margin-right: 8px; }
        .btn-email:hover { background: rgba(168,85,247,0.2); }
        .btn-email:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-win { background: rgba(74,144,217,0.1); color: #4A90D9; border-color: rgba(74,144,217,0.2); margin-right: 8px; }
        .btn-win:hover { background: rgba(74,144,217,0.2); }
        .btn-loss { background: rgba(156,163,175,0.1); color: ${tema === 'dark' ? '#9ca3af' : '#4b5563'}; border-color: rgba(156,163,175,0.2); margin-right: 8px; }
        .btn-loss:hover { background: rgba(156,163,175,0.2); }
        .btn-reopen { background: rgba(245,158,11,0.1); color: ${tema === 'dark' ? '#f59e0b' : '#d97706'}; border-color: rgba(245,158,11,0.2); margin-right: 8px; }
        .btn-reopen:hover { background: rgba(245,158,11,0.2); }
        .btn-delete { background: transparent; color: #f87171; }
        
        /* Mobile adjustment */
        @media(max-width: 900px) {
          .sidebar { width: 100%; position: relative; border-right: none; border-bottom: 1px solid var(--border-light); }
          .main-content { margin-left: 0; padding: 20px; }
        }
      `}</style>

      {/* MENU LATERAL (SIDEBAR) */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          {/* Lógica da Logo baseada no Tema */}
          <img 
            src={tema === 'dark' ? '/Logo-negativo.webp' : '/logo-ssti.webp'} 
            alt="SSTI" 
            style={{ maxHeight: "45px", objectFit: "contain", transition: "all 0.3s" }} 
          />
        </div>
        
        <nav className="nav-menu">
          <button className={`nav-item ${aba === 'propostas' ? 'active' : ''}`} onClick={() => setAba('propostas')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            Pipeline de Vendas
          </button>
          
          <button className={`nav-item ${aba === 'leads' ? 'active' : ''}`} onClick={() => setAba('leads')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Leads Capturados
            {leads.length > 0 && (
              <span style={{ marginLeft: "auto", background: "#4A90D9", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>{leads.length}</span>
            )}
          </button>

          <button className="nav-item" style={{ marginTop: "16px", border: "1px dashed rgba(74,144,217,0.4)", color: "#4A90D9" }} onClick={() => router.push('/preco')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nova Proposta
          </button>
        </nav>

        <div className="user-profile">
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "var(--text-secondary)" }}>Sessão ativa</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text-primary)", marginTop: 4, wordBreak: "break-all" }}>{session?.user?.email}</div>
          <button onClick={handleLogout} className="btn-logout">Encerrar Sessão</button>
        </div>
      </aside>

      {/* ÁREA CENTRAL DE CONTEÚDO */}
      <main className="main-content">
        
        {/* HEADER DA PÁGINA */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40, flexWrap: "wrap", gap: "20px" }}>
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              {aba === 'propostas' ? "Visão Geral Comercial" : "Gestão de Leads"}
            </h1>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
              {aba === 'propostas' ? "Acompanhe as suas métricas e propostas enviadas." : "Potenciais clientes que chegaram através do site."}
            </p>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            
            {/* BOTÃO DE MUDAR TEMA */}
            <button 
              onClick={alternarTema} 
              style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-medium)", padding: "10px 16px", borderRadius: "10px", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s" }}
            >
              {tema === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
            </button>

            {aba === 'propostas' && (
              <select 
                value={filtroDias} 
                onChange={e => setFiltroDias(Number(e.target.value))}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", color: "var(--text-primary)", padding: "10px 16px", borderRadius: "10px", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 600, outline: "none", cursor: "pointer", transition: "all 0.2s" }}
              >
                <option value={30}>Último Mês (30 dias)</option>
                <option value={90}>Últimos 3 Meses</option>
                <option value={365}>Último Ano</option>
                <option value={0}>Todo o Histórico</option>
              </select>
            )}
          </div>
        </header>

        {/* CONTEÚDO PROPOSTAS */}
        {aba === "propostas" && (
          <>
            <div className="grid-metrics">
              <div className="metric-card">
                <div className="metric-title">Propostas Criadas</div>
                <div className="metric-value">{carregando ? "-" : totalPropostas} <span style={{fontSize: 14, color: "var(--text-secondary)", fontWeight: 400}}>| {fmt(volumeFinanceiro)}</span></div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Taxa de Conversão</div>
                <div className="metric-value highlight">{carregando ? "-" : taxaConversao.toFixed(1)}%</div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Negócios Fechados</div>
                <div className="metric-value success">{carregando ? "-" : propostasFechadas.length} <span style={{fontSize: 14, color: "var(--text-secondary)", fontWeight: 400}}>| {fmt(receitaFechada)}</span></div>
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data / Ref</th>
                    <th>Empresa & Contacto</th>
                    <th>Mensalidade</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Gestão</th>
                  </tr>
                </thead>
                <tbody>
                  {propostasFiltradas.length === 0 && !carregando && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Nenhuma proposta encontrada.</td></tr>
                  )}
                  {propostasFiltradas.map(prop => (
                    <tr key={prop.id} style={{ opacity: prop.status === 'perdida' ? 0.6 : 1 }}>
                      <td>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--text-secondary)" }}>{new Date(prop.created_at).toLocaleDateString('pt-BR')}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#4A90D9", marginTop: 2 }}>{prop.numero}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{prop.cliente}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{prop.contato || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{prop.email || "Sem e-mail"}</div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color: prop.status === 'fechada' ? '#22c55e' : prop.status === 'perdida' ? '#9ca3af' : 'var(--text-primary)' }}>
                        {fmt(prop.valor)}
                      </td>
                      <td>
                        <div>
                          <span className={`badge-status ${prop.status === 'fechada' ? 'badge-fechada' : prop.status === 'perdida' ? 'badge-perdida' : 'badge-aberta'}`}>
                            {prop.status === 'fechada' ? 'Ganha' : prop.status === 'perdida' ? 'Perdida' : 'Aberto'}
                          </span>
                        </div>
                        {prop.status_envio === 'enviado' && (
                          <div style={{ marginTop: 4 }}><span className="badge-status badge-email">Enviado</span></div>
                        )}
                      </td>
                      <td style={{ textAlign: "right", minWidth: 320 }}>
                        <button className="btn-action btn-view" onClick={() => visualizarProposta(prop)}>PDF</button>
                        <button className="btn-action btn-wpp" onClick={() => enviarWhatsApp(prop)}>Wpp</button>
                        <button className="btn-action btn-email" disabled={enviando === prop.id} onClick={() => enviarPorEmail(prop)}>
                          {enviando === prop.id ? "..." : "E-mail"}
                        </button>
                        
                        {(!prop.status || prop.status === 'aberta') ? (
                          <>
                            <button className="btn-action btn-win" onClick={() => alterarStatus(prop.id, 'fechada')}>Ganho</button>
                            <button className="btn-action btn-loss" onClick={() => alterarStatus(prop.id, 'perdida')}>Perdido</button>
                          </>
                        ) : (
                          <button className="btn-action btn-reopen" onClick={() => alterarStatus(prop.id, 'aberta')}>Reabrir</button>
                        )}
                        <button className="btn-action btn-delete" onClick={() => excluirProposta(prop.id, prop.cliente)}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* CONTEÚDO LEADS */}
        {aba === "leads" && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lead / Empresa</th>
                  <th>Solução de Interesse</th>
                  <th style={{ textAlign: "right" }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 && !carregando && (
                  <tr><td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Nenhum lead capturado.</td></tr>
                )}
                {leads.map(lead => (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--text-secondary)" }}>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{lead.empresa}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{lead.nome} • {lead.telefone}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{lead.email}</div>
                    </td>
                    <td>
                      <span className="badge-status badge-aberta" style={{ background: "rgba(74,144,217,0.15)", color: "#4A90D9", borderColor: "rgba(74,144,217,0.3)" }}>
                        {lead.produto} - {lead.plano}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn-action btn-wpp" onClick={() => enviarWhatsAppLead(lead)}>Chamar no WhatsApp</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </div>
  );
}
