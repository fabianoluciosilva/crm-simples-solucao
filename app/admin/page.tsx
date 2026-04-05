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

interface TarefaDB {
  id: number;
  titulo: string;
  descricao: string;
  data_vencimento: string;
  status: string;
  usuario_email: string;
  lead_id?: number;
  proposta_id?: number;
  nome_referencia?: string;
  data_conclusao?: string;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();

  // --- ESTADOS GERAIS ---
  const [session, setSession] = useState<any>(null);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const isAdmin = session?.user?.email === 'fabiano@simplessolucao.com.br';

  // --- ESTADOS DO CRM ---
  const [aba, setAba] = useState<"propostas" | "leads" | "tarefas">("propostas");
  const [propostas, setPropostas] = useState<PropostaDB[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<TarefaDB[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroDias, setFiltroDias] = useState<number>(30);
  const [enviando, setEnviando] = useState<number | null>(null);

  // --- ESTADOS DA GESTÃO DE TAREFAS ---
  const [modalTarefa, setModalTarefa] = useState(false);
  const [filtroStatusTarefa, setFiltroStatusTarefa] = useState("Todos");
  const [formTarefa, setFormTarefa] = useState<Partial<TarefaDB>>({
    titulo: "", descricao: "", data_vencimento: "", status: "Pendente", usuario_email: "", nome_referencia: ""
  });

  // ─── LÓGICA DO TEMA (DARK/LIGHT MODE) ────────────────────────────────────
  useEffect(() => {
    const temaSalvo = localStorage.getItem("tema_ssti");
    if (temaSalvo === "light" || temaSalvo === "dark") setTema(temaSalvo);
  }, []);

  const alternarTema = () => {
    const novoTema = tema === "dark" ? "light" : "dark";
    setTema(novoTema);
    localStorage.setItem("tema_ssti", novoTema);
  };

  // ─── LÓGICA DE SESSÃO DO SUPABASE ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/");
      else {
        setSession(session);
        setFormTarefa(prev => ({ ...prev, usuario_email: session.user.email }));
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

  // ─── CARREGAMENTO DE DADOS ─────────────────────────────────────────
  useEffect(() => {
    if (session) {
      if (aba === "propostas") carregarDados();
      if (aba === "leads") carregarLeads();
      if (aba === "tarefas") carregarTarefas();
    }
  }, [session, aba, filtroDias]);

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

  const carregarTarefas = async () => {
    setCarregando(true);
    let query = supabase.from('tarefas').select('*').order('data_vencimento', { ascending: true });
    
    // Se não for o Fabiano, mostra só as tarefas do utilizador logado
    if (session?.user?.email !== 'fabiano@simplessolucao.com.br') {
      query = query.eq('usuario_email', session?.user?.email);
    }
    
    const { data, error } = await query;
    if (!error && data) setTarefas(data);
    setCarregando(false);
  };

  // ─── GESTÃO DE TAREFAS (LÓGICA) ─────────────────────────────────────────
  const abrirNovaTarefa = (referencia?: string, leadId?: number, propostaId?: number) => {
    setFormTarefa({
      titulo: "", descricao: "", data_vencimento: "", status: "Pendente", 
      usuario_email: session?.user?.email || "", nome_referencia: referencia || "",
      lead_id: leadId, proposta_id: propostaId
    });
    setModalTarefa(true);
  };

  const editarTarefa = (t: TarefaDB) => {
    // Formata a data para o input datetime-local (YYYY-MM-DDThh:mm)
    const dataFormatada = new Date(t.data_vencimento).toISOString().slice(0, 16);
    setFormTarefa({ ...t, data_vencimento: dataFormatada });
    setModalTarefa(true);
  };

  const salvarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    const isUpdate = !!formTarefa.id;
    
    // Regra: Se mudar para concluído agora, regista a data de conclusão
    let data_conclusao = formTarefa.data_conclusao;
    if (formTarefa.status === 'Concluído' && !data_conclusao) {
      data_conclusao = new Date().toISOString();
    } else if (formTarefa.status !== 'Concluído') {
      data_conclusao = undefined; // Limpa se for reaberta
    }

    const payload = {
      titulo: formTarefa.titulo,
      descricao: formTarefa.descricao,
      data_vencimento: new Date(formTarefa.data_vencimento as string).toISOString(),
      status: formTarefa.status,
      usuario_email: formTarefa.usuario_email,
      nome_referencia: formTarefa.nome_referencia,
      lead_id: formTarefa.lead_id || null,
      proposta_id: formTarefa.proposta_id || null,
      data_conclusao: data_conclusao,
      updated_at: new Date().toISOString()
    };

    if (isUpdate) {
      await supabase.from('tarefas').update(payload).eq('id', formTarefa.id);
    } else {
      await supabase.from('tarefas').insert([payload]);
    }
    
    setModalTarefa(false);
    carregarTarefas();
  };

  const excluirTarefa = async (id: number) => {
    if (confirm("Tem a certeza que deseja excluir esta tarefa?")) {
      await supabase.from('tarefas').delete().eq('id', id);
      carregarTarefas();
    }
  };

  const alterarStatusTarefaRapido = async (id: number, novoStatus: string) => {
    const data_conclusao = novoStatus === 'Concluído' ? new Date().toISOString() : null;
    await supabase.from('tarefas').update({ status: novoStatus, data_conclusao, updated_at: new Date().toISOString() }).eq('id', id);
    carregarTarefas();
  };

  // Inteligência de Status: Se passou da data e não concluiu, é Atrasado
  const getStatusRealTarefa = (t: TarefaDB) => {
    if (t.status === 'Concluído') return 'Concluído';
    const vencimento = new Date(t.data_vencimento);
    if (vencimento < new Date()) return 'Atrasado';
    return t.status;
  };

  const tarefasFiltradas = tarefas.filter(t => {
    if (filtroStatusTarefa !== "Todos") {
      const statusReal = getStatusRealTarefa(t);
      if (filtroStatusTarefa === "Atrasado" && statusReal !== "Atrasado") return false;
      if (filtroStatusTarefa !== "Atrasado" && statusReal !== filtroStatusTarefa) return false;
    }
    return true;
  });

  // ─── AÇÕES DE PROPOSTAS E LEADS (MANTIDAS) ────────────────────────────────
  const excluirProposta = async (id: number, clienteNome: string) => {
    if (confirm(`Tem a certeza que deseja excluir a proposta de ${clienteNome}?`)) {
      await supabase.from('propostas').delete().eq('id', id);
      setPropostas(prev => prev.filter(p => p.id !== id));
    }
  };

  const alterarStatus = async (id: number, novoStatus: string) => {
    await supabase.from('propostas').update({ status: novoStatus }).eq('id', id);
    setPropostas(prev => prev.map(p => p.id === id ? { ...p, status: novoStatus } : p));
  };

  const enviarPorEmail = async (prop: PropostaDB) => {
    if (!prop.email) return alert("Proposta sem e-mail registado.");
    if (!confirm(`Enviar proposta para ${prop.email}?`)) return;
    setEnviando(prop.id);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: prop.email,
          subject: `Proposta Comercial SSTI - ${prop.cliente}`,
          html: `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;"><h2 style="color: #0a1628;">Proposta Comercial - Simples Solução TI</h2><p>Olá <strong>${prop.contato}</strong>,</p><p>É um prazer apresentar a nossa proposta de suporte técnico para a <strong>${prop.cliente}</strong>.</p><p><strong>Valor Mensal Ofertado:</strong> ${fmt(prop.valor)}</p><br /><p>Atenciosamente,</p><p><strong>Equipa Comercial | Simples Solução TI</strong><br/>(21) 3529-7993 | www.simplessolucao.com.br</p></div>`,
          fileName: `Proposta_${prop.numero}.pdf`
        }),
      });
      if (response.ok) {
        alert("E-mail enviado!");
        await supabase.from('propostas').update({ status_envio: 'enviado' }).eq('id', prop.id);
        carregarDados();
      } else alert("Falha ao enviar e-mail.");
    } catch (e) { alert("Erro de conexão."); } finally { setEnviando(null); }
  };

  const visualizarProposta = (prop: PropostaDB) => {
    // Mantém a visualização PDF original
    const dataFormatada = new Date(prop.created_at).toLocaleDateString("pt-BR");
    const w = window.open("", "_blank")!;
    w.document.write(`<html><head><title>Proposta - ${prop.cliente}</title></head><body style="font-family: sans-serif; padding: 40px;"><h2>Proposta Simples Solução TI</h2><p>Cliente: ${prop.cliente}</p><p>Valor: ${fmt(prop.valor)}</p></body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  const propostasFiltradas = propostas.filter(p => {
    if (filtroDias === 0) return true; 
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - filtroDias);
    return new Date(p.created_at) >= dataLimite;
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (carregandoAuth) return <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#4A90D9", fontFamily: "sans-serif" }}>A validar sessão...</div>;

  // ─── ESTRUTURA DO DASHBOARD ───────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        
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
        body { background: var(--bg-main); color: var(--text-primary); transition: background 0.3s, color 0.3s; }
        
        .sidebar { width: 260px; background: var(--bg-sidebar); border-right: 1px solid var(--border-light); display: flex; flex-direction: column; position: fixed; top: 0; bottom: 0; left: 0; z-index: 10; transition: background 0.3s; }
        .main-content { flex: 1; margin-left: 260px; padding: 32px 40px; display: flex; flex-direction: column; min-height: 100vh; background: var(--bg-main); color: var(--text-primary); transition: background 0.3s; }
        
        .sidebar-logo { padding: 30px 24px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: center; }
        .nav-menu { padding: 24px 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; color: var(--text-secondary); font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; background: transparent; text-align: left; width: 100%; }
        .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .nav-item.active { background: rgba(74,144,217,0.1); color: #4A90D9; }
        
        .user-profile { padding: 20px 24px; border-top: 1px solid var(--border-light); background: var(--profile-bg); }
        .btn-logout { background: transparent; border: 1px solid rgba(248,113,113,0.3); color: #f87171; padding: 8px 0; border-radius: 8px; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; width: 100%; margin-top: 12px; transition: 0.2s; }
        .btn-logout:hover { background: rgba(248,113,113,0.1); }

        .grid-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .metric-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow-card); transition: all 0.3s; }
        .metric-title { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-secondary); }
        .metric-value { font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 800; color: var(--text-primary); }
        
        .table-wrapper { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-card); transition: all 0.3s; margin-bottom: 30px;}
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-secondary); padding: 16px 20px; border-bottom: 1px solid var(--border-light); background: var(--table-header); }
        td { font-family: 'Outfit', sans-serif; font-size: 14px; color: var(--text-primary); padding: 16px 20px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: var(--bg-hover); }
        
        .badge-status { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-family: 'Outfit', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .badge-aberta { background: rgba(74,144,217,0.15); color: #4A90D9; border: 1px solid rgba(74,144,217,0.3); }
        .badge-andamento { background: rgba(245,158,11,0.15); color: ${tema === 'dark' ? '#f59e0b' : '#d97706'}; border: 1px solid rgba(245,158,11,0.3); }
        .badge-concluido { background: rgba(34,197,94,0.15); color: ${tema === 'dark' ? '#22c55e' : '#16a34a'}; border: 1px solid rgba(34,197,94,0.3); }
        .badge-atrasado { background: rgba(248,113,113,0.15); color: ${tema === 'dark' ? '#f87171' : '#dc2626'}; border: 1px solid rgba(248,113,113,0.3); }
        
        .btn-action { padding: 6px 12px; border-radius: 6px; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
        .btn-view { background: ${tema === 'dark' ? 'rgba(255,255,255,0.1)' : '#f1f5f9'}; color: var(--text-primary); border-color: ${tema === 'dark' ? 'rgba(255,255,255,0.2)' : '#cbd5e1'}; margin-right: 8px; }
        .btn-view:hover { background: ${tema === 'dark' ? 'rgba(255,255,255,0.2)' : '#e2e8f0'}; }
        
        /* Modal Styles */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-content { background: var(--bg-sidebar); border: 1px solid var(--border-light); border-radius: 20px; width: 100%; max-width: 500px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
        .input-modal { width: 100%; background: var(--bg-main); border: 1px solid var(--border-medium); color: var(--text-primary); padding: 12px 16px; border-radius: 10px; font-family: 'Outfit', sans-serif; font-size: 14px; outline: none; margin-bottom: 16px; }
        .label-modal { display: block; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }

        @media(max-width: 900px) {
          .sidebar { width: 100%; position: relative; border-right: none; border-bottom: 1px solid var(--border-light); }
          .main-content { margin-left: 0; padding: 20px; }
        }
      `}</style>

      {/* MENU LATERAL */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={tema === 'dark' ? '/Logo-negativo.webp' : '/logo-ssti.webp'} alt="SSTI" style={{ maxHeight: "45px", objectFit: "contain" }} />
        </div>
        
        <nav className="nav-menu">
          <button className={`nav-item ${aba === 'tarefas' ? 'active' : ''}`} onClick={() => setAba('tarefas')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            Gestão de Tarefas
          </button>

          <button className={`nav-item ${aba === 'propostas' ? 'active' : ''}`} onClick={() => setAba('propostas')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            Pipeline de Vendas
          </button>
          
          <button className={`nav-item ${aba === 'leads' ? 'active' : ''}`} onClick={() => setAba('leads')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Leads Capturados
            {leads.length > 0 && <span style={{ marginLeft: "auto", background: "#4A90D9", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>{leads.length}</span>}
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
        
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40, flexWrap: "wrap", gap: "20px" }}>
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              {aba === 'propostas' ? "Visão Geral Comercial" : aba === 'leads' ? "Gestão de Leads" : "Minhas Tarefas"}
            </h1>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
              {aba === 'propostas' ? "Acompanhe as propostas." : aba === 'leads' ? "Potenciais clientes do site." : "Organize as suas rotinas e follow-ups."}
            </p>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {aba === 'tarefas' && (
              <>
                <select value={filtroStatusTarefa} onChange={e => setFiltroStatusTarefa(e.target.value)} style={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", color: "var(--text-primary)", padding: "10px 16px", borderRadius: "10px", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 600, outline: "none" }}>
                  <option value="Todos">Status: Todos</option>
                  <option value="Pendente">Pendentes</option>
                  <option value="Em andamento">Em andamento</option>
                  <option value="Atrasado">Atrasados</option>
                  <option value="Concluído">Concluídos</option>
                </select>
                <button onClick={() => abrirNovaTarefa()} style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "10px", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  + Nova Tarefa
                </button>
              </>
            )}

            <button onClick={alternarTema} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-medium)", padding: "10px 16px", borderRadius: "10px", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 13 }}>
              {tema === 'dark' ? '☀️ Claro' : '🌙 Escuro'}
            </button>
          </div>
        </header>

        {/* ─── ABA: TAREFAS ─── */}
        {aba === "tarefas" && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Prazo</th>
                  <th>Tarefa</th>
                  <th>Referência (Cliente)</th>
                  <th>Responsável</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tarefasFiltradas.length === 0 && !carregando && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Nenhuma tarefa encontrada.</td></tr>
                )}
                {tarefasFiltradas.map(t => {
                  const statusVisual = getStatusRealTarefa(t);
                  return (
                    <tr key={t.id} style={{ opacity: statusVisual === 'Concluído' ? 0.5 : 1 }}>
                      <td>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: statusVisual === 'Atrasado' ? '#f87171' : 'var(--text-primary)', fontWeight: statusVisual === 'Atrasado' ? 700 : 400 }}>
                          {new Date(t.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.titulo}</div>
                        {t.descricao && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 250 }}>{t.descricao}</div>}
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{t.nome_referencia || "—"}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.usuario_email.split('@')[0]}</div>
                      </td>
                      <td>
                        <span className={`badge-status badge-${statusVisual.toLowerCase().replace(' ', '')}`}>
                          {statusVisual}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {statusVisual !== 'Concluído' && (
                          <button className="btn-action btn-view" onClick={() => alterarStatusTarefaRapido(t.id, 'Concluído')} style={{ color: "#22c55e", borderColor: "rgba(34,197,94,0.3)" }}>✓ Concluir</button>
                        )}
                        <button className="btn-action btn-view" onClick={() => editarTarefa(t)}>Editar</button>
                        <button className="btn-action btn-delete" onClick={() => excluirTarefa(t.id)}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── ABA: PROPOSTAS ─── */}
        {aba === "propostas" && (
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
                {propostasFiltradas.map(prop => (
                  <tr key={prop.id}>
                    <td>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--text-secondary)" }}>{new Date(prop.created_at).toLocaleDateString('pt-BR')}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#4A90D9", marginTop: 2 }}>{prop.numero}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{prop.cliente}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{prop.contato || "—"}</div>
                    </td>
                    <td style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color: "var(--text-primary)" }}>{fmt(prop.valor)}</td>
                    <td>
                      <span className={`badge-status ${prop.status === 'fechada' ? 'badge-fechada' : prop.status === 'perdida' ? 'badge-perdida' : 'badge-aberta'}`}>
                        {prop.status === 'fechada' ? 'Ganha' : prop.status === 'perdida' ? 'Perdida' : 'Aberto'}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn-action btn-view" onClick={() => abrirNovaTarefa(`Follow-up Proposta: ${prop.cliente}`, undefined, prop.id)}>+ Tarefa</button>
                      <button className="btn-action btn-view" onClick={() => visualizarProposta(prop)}>PDF</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── ABA: LEADS ─── */}
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
                {leads.map(lead => (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--text-secondary)" }}>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{lead.empresa}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{lead.nome} • {lead.telefone}</div>
                    </td>
                    <td>
                      <span className="badge-status badge-aberta">{lead.produto}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn-action btn-view" onClick={() => abrirNovaTarefa(`Contato Lead: ${lead.empresa}`, lead.id, undefined)}>+ Tarefa</button>
                      <button className="btn-action btn-view" style={{ color: "#4A90D9", borderColor: "rgba(74,144,217,0.3)" }} onClick={() => enviarWhatsAppLead(lead)}>Wpp</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>

      {/* ─── MODAL NOVA TAREFA ─── */}
      {modalTarefa && (
        <div className="modal-overlay" onClick={() => setModalTarefa(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, color: "var(--text-primary)", marginBottom: 24, borderBottom: "1px solid var(--border-light)", paddingBottom: 16 }}>
              {formTarefa.id ? "Editar Tarefa" : "Nova Tarefa"}
            </h2>
            
            <form onSubmit={salvarTarefa}>
              <label className="label-modal">Título da Tarefa</label>
              <input required className="input-modal" value={formTarefa.titulo} onChange={e => setFormTarefa({...formTarefa, titulo: e.target.value})} placeholder="Ex: Ligar para confirmar recebimento..." />
              
              <label className="label-modal">Data e Hora de Vencimento</label>
              <input type="datetime-local" required className="input-modal" value={formTarefa.data_vencimento} onChange={e => setFormTarefa({...formTarefa, data_vencimento: e.target.value})} />
              
              <label className="label-modal">Descrição (Opcional)</label>
              <textarea className="input-modal" rows={3} value={formTarefa.descricao} onChange={e => setFormTarefa({...formTarefa, descricao: e.target.value})} placeholder="Detalhes do que precisa ser feito..." />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label-modal">Status</label>
                  <select className="input-modal" value={formTarefa.status} onChange={e => setFormTarefa({...formTarefa, status: e.target.value})}>
                    <option value="Pendente">Pendente</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Concluído">Concluído</option>
                  </select>
                </div>
                <div>
                  <label className="label-modal">Responsável (E-mail)</label>
                  <input required type="email" className="input-modal" value={formTarefa.usuario_email} onChange={e => setFormTarefa({...formTarefa, usuario_email: e.target.value})} disabled={!isAdmin} style={{ opacity: !isAdmin ? 0.6 : 1, cursor: !isAdmin ? 'not-allowed' : 'text' }} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setModalTarefa(false)} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-medium)", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>Cancelar</button>
                <button type="submit" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>Gravar Tarefa</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
