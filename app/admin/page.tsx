"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface PropostaDB { id: number; created_at: string; numero: string; cliente: string; contato: string; telefone?: string; email: string; valor: number; status: string; status_envio: string; dados: any; }
interface TarefaDB { id: number; titulo: string; descricao: string; data_vencimento: string; status: string; usuario_email: string; lead_id?: number; proposta_id?: number; nome_referencia?: string; data_conclusao?: string; created_at: string; }
interface ContratoDB { id: number; proposta_id?: number; cliente_nome: string; servicos_inclusos?: string; valor_mensal: number; status: string; data_inicio: string; data_fim?: string; motivo_cancelamento?: string; created_at: string; }

export default function AdminPage() {
  const router = useRouter();

  // --- ESTADOS GERAIS ---
  const [session, setSession] = useState<any>(null);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const isAdmin = session?.user?.email === 'fabiano@simplessolucao.com.br';

  // --- ESTADOS DO CRM ---
  const [aba, setAba] = useState<"propostas" | "clientes" | "contratos" | "tarefas" | "leads">("propostas");
  const [propostas, setPropostas] = useState<PropostaDB[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<TarefaDB[]>([]);
  const [contratos, setContratos] = useState<ContratoDB[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroDias, setFiltroDias] = useState<number>(30);
  const [enviando, setEnviando] = useState<number | null>(null);

  // --- ESTADOS DE MODAIS ---
  const [modalTarefa, setModalTarefa] = useState(false);
  const [filtroStatusTarefa, setFiltroStatusTarefa] = useState("Todos");
  const [formTarefa, setFormTarefa] = useState<Partial<TarefaDB>>({ titulo: "", descricao: "", data_vencimento: "", status: "Pendente", usuario_email: "", nome_referencia: "" });

  const [modalContrato, setModalContrato] = useState(false);
  const [formContrato, setFormContrato] = useState<Partial<ContratoDB>>({ cliente_nome: "", valor_mensal: 0, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: "", motivo_cancelamento: "" });

  const [clienteDetalhe, setClienteDetalhe] = useState<any>(null);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ─── LÓGICA DO TEMA E SESSÃO ─────────────────────────────────────────────
  useEffect(() => {
    const temaSalvo = localStorage.getItem("tema_ssti");
    if (temaSalvo === "light" || temaSalvo === "dark") setTema(temaSalvo);
  }, []);

  const alternarTema = () => {
    const novoTema = tema === "dark" ? "light" : "dark";
    setTema(novoTema);
    localStorage.setItem("tema_ssti", novoTema);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/");
      else { setSession(session); setFormTarefa(prev => ({ ...prev, usuario_email: session.user.email })); setCarregandoAuth(false); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/"); else setSession(session);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/"); };

  // ─── CARREGAMENTO DE DADOS ────────────────────────────────────────────────
  useEffect(() => {
    if (session) {
      carregarDados();
      carregarContratos();
      carregarLeads();
      carregarTarefas();
    }
  }, [session, filtroDias]); // Recarrega quando o filtro de dias muda

  const carregarDados = async () => {
    setCarregando(true);
    const { data, error } = await supabase.from('propostas').select('*').order('created_at', { ascending: false });
    if (!error && data) setPropostas(data);
    setCarregando(false);
  };

  const carregarLeads = async () => {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!error && data) setLeads(data);
  };

  const carregarTarefas = async () => {
    let query = supabase.from('tarefas').select('*').order('data_vencimento', { ascending: true });
    if (!isAdmin) query = query.eq('usuario_email', session?.user?.email);
    const { data, error } = await query;
    if (!error && data) setTarefas(data);
  };

  const carregarContratos = async () => {
    const { data, error } = await supabase.from('contratos').select('*').order('created_at', { ascending: false });
    if (!error && data) setContratos(data);
  };

  // ─── LÓGICA DO MENU DE CLIENTES 360º ──────────────────────────────────────
  const clientesAgrupados = useMemo(() => {
    const mapa = new Map<string, any>();
    
    // Agrupa propostas
    propostas.forEach(p => {
      const key = p.cliente.trim().toUpperCase();
      if (!mapa.has(key)) mapa.set(key, { nome: p.cliente, email: p.email, contato: p.contato, telefone: p.telefone, propostas: [], contratos: [], tarefas: [] });
      mapa.get(key).propostas.push(p);
      if (p.email && !mapa.get(key).email) mapa.get(key).email = p.email;
      if (p.contato && !mapa.get(key).contato) mapa.get(key).contato = p.contato;
      if (p.telefone && !mapa.get(key).telefone) mapa.get(key).telefone = p.telefone;
    });

    // Agrupa contratos
    contratos.forEach(c => {
      const key = c.cliente_nome.trim().toUpperCase();
      if (!mapa.has(key)) mapa.set(key, { nome: c.cliente_nome, email: "", contato: "", telefone: "", propostas: [], contratos: [], tarefas: [] });
      mapa.get(key).contratos.push(c);
    });

    // Agrupa tarefas
    tarefas.forEach(t => {
      if (t.nome_referencia) {
        const chaves = Array.from(mapa.keys());
        const match = chaves.find(k => t.nome_referencia!.toUpperCase().includes(k));
        if (match) mapa.get(match).tarefas.push(t);
      }
    });

    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [propostas, contratos, tarefas]);

  // ─── AÇÕES DE PROPOSTAS ───────────────────────────────────────────────────
  const visualizarProposta = (prop: PropostaDB) => {
    const dataFormatada = new Date(prop.created_at).toLocaleDateString("pt-BR");
    const w = window.open("", "_blank")!;
    w.document.write(`<html><head><title>Proposta - ${prop.cliente}</title></head><body style="font-family: sans-serif; padding: 40px;"><h2>Proposta Simples Solução TI</h2><p>Empresa: ${prop.cliente}</p><p>Contato: ${prop.contato}</p><p>Valor: ${fmt(prop.valor)}</p></body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  const enviarWhatsApp = (prop: PropostaDB) => {
    const primeiroNome = prop.contato ? prop.contato.split(" ")[0] : "cliente";
    const texto = `Olá ${primeiroNome}, tudo bem?\n\nSou da Simples Solução TI. Conforme conversámos, estou a enviar a nossa proposta comercial (cód: ${prop.numero}) para o suporte e gestão de TI da *${prop.cliente}*, no valor de ${fmt(prop.valor)} mensais.\n\nQualquer dúvida, estou à total disposição!`;
    const link = `https://wa.me/${prop.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(texto)}`;
    window.open(link, '_blank');
  };

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
          html: `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;"><h2 style="color: #0a1628;">Proposta Comercial - Simples Solução TI</h2><p>Olá <strong>${prop.contato}</strong>,</p><p>É um prazer apresentar a nossa proposta de suporte técnico para a <strong>${prop.cliente}</strong>.</p><p>Conforme conversámos, segue o detalhamento dos nossos serviços com foco na evolução contínua e segurança do seu ambiente de TI.</p><p><strong>Valor Mensal Ofertado:</strong> ${fmt(prop.valor)}</p><br /><p>Atenciosamente,</p><p><strong>Equipe Comercial | Simples Solução TI</strong><br/>(21) 3529-7993 | www.simplessolucao.com.br</p></div>`,
          fileName: `Proposta_${prop.numero}.pdf`
        }),
      });
      if (response.ok) {
        alert("E-mail enviado com sucesso!");
        await supabase.from('propostas').update({ status_envio: 'enviado' }).eq('id', prop.id);
        carregarDados();
      } else alert("Falha ao enviar e-mail.");
    } catch (e) { alert("Erro de conexão."); } finally { setEnviando(null); }
  };

  const alterarStatus = async (id: number, novoStatus: string) => {
    await supabase.from('propostas').update({ status: novoStatus }).eq('id', id);
    setPropostas(prev => prev.map(p => p.id === id ? { ...p, status: novoStatus } : p));
  };

  const excluirProposta = async (id: number, clienteNome: string) => {
    if (confirm(`Tem certeza que deseja excluir permanentemente a proposta de ${clienteNome}?`)) {
      await supabase.from('propostas').delete().eq('id', id);
      setPropostas(prev => prev.filter(p => p.id !== id));
    }
  };

  // ─── AÇÕES DE CONTRATOS E TAREFAS ─────────────────────────────────────────
  const abrirNovoContrato = (prop?: PropostaDB) => {
    if (prop) setFormContrato({ proposta_id: prop.id, cliente_nome: prop.cliente, valor_mensal: prop.valor, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: `Contrato originado da Proposta ${prop.numero}`, motivo_cancelamento: "" });
    else setFormContrato({ cliente_nome: "", valor_mensal: 0, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: "", motivo_cancelamento: "" });
    setModalContrato(true);
  };

  const salvarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formContrato.status === 'Cancelado' && !formContrato.motivo_cancelamento?.trim()) return alert("Para cancelar o contrato, é obrigatório preencher o motivo do cancelamento.");
    const payload = { proposta_id: formContrato.proposta_id || null, cliente_nome: formContrato.cliente_nome, servicos_inclusos: formContrato.servicos_inclusos, valor_mensal: formContrato.valor_mensal, status: formContrato.status, data_inicio: formContrato.data_inicio, data_fim: formContrato.status === 'Cancelado' && !formContrato.data_fim ? new Date().toISOString().split('T')[0] : formContrato.data_fim || null, motivo_cancelamento: formContrato.status === 'Cancelado' ? formContrato.motivo_cancelamento : null, updated_at: new Date().toISOString() };
    if (formContrato.id) await supabase.from('contratos').update(payload).eq('id', formContrato.id);
    else await supabase.from('contratos').insert([payload]);
    setModalContrato(false); carregarContratos();
  };

  const editarContrato = (c: ContratoDB) => { setFormContrato({ ...c }); setModalContrato(true); };

  const abrirNovaTarefa = (referencia?: string, leadId?: number, propostaId?: number) => {
    setFormTarefa({ titulo: "", descricao: "", data_vencimento: "", status: "Pendente", usuario_email: session?.user?.email || "", nome_referencia: referencia || "", lead_id: leadId, proposta_id: propostaId });
    setModalTarefa(true);
  };

  const salvarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    let data_conclusao = formTarefa.data_conclusao;
    if (formTarefa.status === 'Concluído' && !data_conclusao) data_conclusao = new Date().toISOString(); else if (formTarefa.status !== 'Concluído') data_conclusao = undefined;
    const payload = { titulo: formTarefa.titulo, descricao: formTarefa.descricao, data_vencimento: new Date(formTarefa.data_vencimento as string).toISOString(), status: formTarefa.status, usuario_email: formTarefa.usuario_email, nome_referencia: formTarefa.nome_referencia, lead_id: formTarefa.lead_id || null, proposta_id: formTarefa.proposta_id || null, data_conclusao, updated_at: new Date().toISOString() };
    if (formTarefa.id) await supabase.from('tarefas').update(payload).eq('id', formTarefa.id); else await supabase.from('tarefas').insert([payload]);
    setModalTarefa(false); carregarTarefas();
  };

  const editarTarefa = (t: TarefaDB) => {
    const dataFormatada = new Date(t.data_vencimento).toISOString().slice(0, 16);
    setFormTarefa({ ...t, data_vencimento: dataFormatada });
    setModalTarefa(true);
  };

  const excluirTarefa = async (id: number) => {
    if (confirm("Deseja excluir esta tarefa?")) { await supabase.from('tarefas').delete().eq('id', id); carregarTarefas(); }
  };

  const alterarStatusTarefaRapido = async (id: number, novoStatus: string) => {
    const data_conclusao = novoStatus === 'Concluído' ? new Date().toISOString() : null;
    await supabase.from('tarefas').update({ status: novoStatus, data_conclusao, updated_at: new Date().toISOString() }).eq('id', id);
    carregarTarefas();
  };

  const enviarWhatsAppLead = (lead: any) => {
    window.open(`https://wa.me/${lead.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(`Olá ${lead.nome}, tudo bem? Sou da Simples Solução TI. Vi que demonstrou interesse na nossa solução de ${lead.produto} pelo site.`)}`, '_blank');
  };

  // ─── FILTROS E MÉTRICAS ───────────────────────────────────────────────────
  const limiteFiltro = new Date(); if (filtroDias > 0) limiteFiltro.setDate(limiteFiltro.getDate() - filtroDias);
  
  const propostasFiltradas = propostas.filter(p => filtroDias === 0 || new Date(p.created_at) >= limiteFiltro);
  const totalPropostas = propostasFiltradas.length;
  const propostasFechadas = propostasFiltradas.filter(p => p.status === 'fechada');
  const propostasPerdidas = propostasFiltradas.filter(p => p.status === 'perdida');
  
  const taxaConversao = totalPropostas > 0 ? (propostasFechadas.length / totalPropostas) * 100 : 0;
  const mrrTotalAtivo = contratos.filter(c => c.status === 'Ativo').reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  const getStatusRealTarefa = (t: TarefaDB) => {
    if (t.status === 'Concluído') return 'Concluído';
    if (new Date(t.data_vencimento) < new Date()) return 'Atrasado';
    return t.status;
  };

  const tarefasFiltradas = tarefas.filter(t => {
    if (filtroStatusTarefa !== "Todos") {
      const statusReal = getStatusRealTarefa(t);
      if (filtroStatusTarefa === "Atrasado" && statusReal !== "Atrasado") return false;
      if (filtroStatusTarefa !== "Atrasado" && statusReal !== filtroStatusTarefa) return false;
    } return true;
  });

  if (carregandoAuth) return <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#4A90D9", fontFamily: "sans-serif" }}>A validar sessão...</div>;

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
        
        .sidebar { width: 260px; background: var(--bg-sidebar); border-right: 1px solid var(--border-light); display: flex; flex-direction: column; position: fixed; top: 0; bottom: 0; left: 0; z-index: 10; }
        .main-content { flex: 1; margin-left: 260px; padding: 32px 40px; display: flex; flex-direction: column; min-height: 100vh; background: var(--bg-main); color: var(--text-primary); }
        
        .sidebar-logo { padding: 30px 24px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: center; }
        .nav-menu { padding: 24px 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; color: var(--text-secondary); font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; background: transparent; text-align: left; width: 100%; }
        .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .nav-item.active { background: rgba(74,144,217,0.1); color: #4A90D9; }
        
        .user-profile { padding: 20px 24px; border-top: 1px solid var(--border-light); background: var(--profile-bg); }
        .btn-logout { background: transparent; border: 1px solid rgba(248,113,113,0.3); color: #f87171; padding: 8px 0; border-radius: 8px; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; width: 100%; margin-top: 12px; transition: 0.2s; }
        .btn-logout:hover { background: rgba(248,113,113,0.1); }

        .grid-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .metric-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow-card); }
        .metric-title { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-secondary); }
        .metric-value { font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 800; color: var(--text-primary); }
        
        .table-wrapper { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-card); margin-bottom: 30px;}
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
        .badge-email { background: rgba(168,85,247,0.15); color: ${tema === 'dark' ? '#a855f7' : '#9333ea'}; border: 1px solid rgba(168,85,247,0.3); margin-top: 4px;}
        
        .btn-action { padding: 6px 12px; border-radius: 6px; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
        .btn-view { background: ${tema === 'dark' ? 'rgba(255,255,255,0.1)' : '#f1f5f9'}; color: var(--text-primary); border-color: ${tema === 'dark' ? 'rgba(255,255,255,0.2)' : '#cbd5e1'}; margin-right: 8px; margin-bottom: 6px; }
        .btn-view:hover { background: ${tema === 'dark' ? 'rgba(255,255,255,0.2)' : '#e2e8f0'}; }
        .btn-wpp { background: rgba(34,197,94,0.1); color: ${tema === 'dark' ? '#22c55e' : '#16a34a'}; border-color: rgba(34,197,94,0.2); margin-right: 8px; margin-bottom: 6px; }
        .btn-wpp:hover { background: rgba(34,197,94,0.2); }
        .btn-email { background: rgba(168,85,247,0.1); color: ${tema === 'dark' ? '#a855f7' : '#9333ea'}; border-color: rgba(168,85,247,0.2); margin-right: 8px; margin-bottom: 6px; }
        .btn-win { background: rgba(74,144,217,0.1); color: #4A90D9; border-color: rgba(74,144,217,0.2); margin-right: 8px; margin-bottom: 6px; }
        .btn-loss { background: rgba(156,163,175,0.1); color: ${tema === 'dark' ? '#9ca3af' : '#4b5563'}; border-color: rgba(156,163,175,0.2); margin-right: 8px; margin-bottom: 6px; }
        .btn-reopen { background: rgba(245,158,11,0.1); color: ${tema === 'dark' ? '#f59e0b' : '#d97706'}; border-color: rgba(245,158,11,0.2); margin-right: 8px; }
        .btn-delete { background: transparent; color: #f87171; }
        
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-content { background: var(--bg-sidebar); border: 1px solid var(--border-light); border-radius: 20px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
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
          <button className={`nav-item ${aba === 'propostas' ? 'active' : ''}`} onClick={() => setAba('propostas')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg> Dashboard / Pipeline
          </button>
          <button className={`nav-item ${aba === 'clientes' ? 'active' : ''}`} onClick={() => setAba('clientes')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> Carteira de Clientes
          </button>
          <button className={`nav-item ${aba === 'contratos' ? 'active' : ''}`} onClick={() => setAba('contratos')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Contratos (MRR)
          </button>
          <button className={`nav-item ${aba === 'tarefas' ? 'active' : ''}`} onClick={() => setAba('tarefas')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Gestão de Tarefas
          </button>
          <button className={`nav-item ${aba === 'leads' ? 'active' : ''}`} onClick={() => setAba('leads')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> Leads do Site
          </button>
          <button className="nav-item" style={{ marginTop: "16px", border: "1px dashed rgba(74,144,217,0.4)", color: "#4A90D9" }} onClick={() => router.push('/preco')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Nova Proposta
          </button>
        </nav>
        <div className="user-profile">
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "var(--text-secondary)" }}>Sessão ativa</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text-primary)", marginTop: 4, wordBreak: "break-all" }}>{session?.user?.email}</div>
          <button onClick={handleLogout} className="btn-logout">Encerrar Sessão</button>
        </div>
      </aside>

      {/* ÁREA CENTRAL */}
      <main className="main-content">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40, flexWrap: "wrap", gap: "20px" }}>
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              {aba === 'propostas' ? "Dashboard Comercial" : aba === 'clientes' ? "Carteira de Clientes 360º" : aba === 'leads' ? "Gestão de Leads" : aba === 'tarefas' ? "Minhas Tarefas" : "Contratos Recorrentes"}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {aba === 'propostas' && (
              <select value={filtroDias} onChange={e => setFiltroDias(Number(e.target.value))} style={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", color: "var(--text-primary)", padding: "10px 16px", borderRadius: "10px", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 600, outline: "none" }}>
                <option value={30}>Último Mês (30 dias)</option>
                <option value={90}>Últimos 3 Meses</option>
                <option value={365}>Último Ano</option>
                <option value={0}>Todo o Histórico</option>
              </select>
            )}
            {aba === 'tarefas' && (
              <>
                <select value={filtroStatusTarefa} onChange={e => setFiltroStatusTarefa(e.target.value)} style={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", color: "var(--text-primary)", padding: "10px 16px", borderRadius: "10px", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 600, outline: "none" }}>
                  <option value="Todos">Status: Todos</option>
                  <option value="Pendente">Pendentes</option>
                  <option value="Em andamento">Em andamento</option>
                  <option value="Atrasado">Atrasados</option>
                  <option value="Concluído">Concluídos</option>
                </select>
                <button onClick={() => abrirNovaTarefa()} style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "10px", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Nova Tarefa</button>
              </>
            )}
            {aba === 'contratos' && (
              <button onClick={() => abrirNovoContrato()} style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "10px", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Novo Contrato</button>
            )}
            <button onClick={alternarTema} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-medium)", padding: "10px 16px", borderRadius: "10px", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 13 }}>
              {tema === 'dark' ? '☀️ Claro' : '🌙 Escuro'}
            </button>
          </div>
        </header>

        {/* ─── ABA: DASHBOARD / PROPOSTAS ─── */}
        {aba === "propostas" && (
          <>
            <div className="grid-metrics">
              <div className="metric-card" style={{ borderLeft: "4px solid #4A90D9" }}>
                <div className="metric-title">MRR Ativo (Total da Empresa)</div>
                <div className="metric-value">{fmt(mrrTotalAtivo)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Taxa de Conversão</div>
                <div className="metric-value">{taxaConversao.toFixed(1)}%</div>
              </div>
            </div>
            
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Data / Ref</th><th>Empresa & Contacto</th><th>Mensalidade</th><th>Status</th><th style={{ textAlign: "right", minWidth: "350px" }}>Gestão e Ações</th></tr></thead>
                <tbody>
                  {propostasFiltradas.length === 0 ? (
                     <tr><td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Nenhuma proposta encontrada.</td></tr>
                  ) : (
                    propostasFiltradas.map(prop => (
                      <tr key={prop.id} style={{ opacity: prop.status === 'perdida' ? 0.6 : 1 }}>
                        <td>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{new Date(prop.created_at).toLocaleDateString('pt-BR')}</div>
                          <div style={{ fontSize: 11, color: "#4A90D9" }}>{prop.numero}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{prop.cliente}</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{prop.contato || "—"}</div>
                        </td>
                        <td style={{ fontWeight: 600, color: prop.status === 'fechada' ? '#22c55e' : prop.status === 'perdida' ? '#f87171' : 'var(--text-primary)' }}>
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
                        
                        {/* BOTÕES RESTAURADOS! */}
                        <td style={{ textAlign: "right" }}>
                          {prop.status === 'fechada' && (
                            <button className="btn-action btn-view" style={{ color: "#22c55e", borderColor: "rgba(34,197,94,0.3)" }} onClick={() => abrirNovoContrato(prop)}>+ Contrato</button>
                          )}
                          <button className="btn-action btn-view" onClick={() => abrirNovaTarefa(`Follow-up Proposta: ${prop.cliente}`, undefined, prop.id)}>+ Tarefa</button>
                          <button className="btn-action btn-view" onClick={() => visualizarProposta(prop)}>PDF</button>
                          <button className="btn-action btn-email" disabled={enviando === prop.id} onClick={() => enviarPorEmail(prop)}>
                            {enviando === prop.id ? "..." : "E-mail"}
                          </button>
                          <button className="btn-action btn-wpp" onClick={() => enviarWhatsApp(prop)}>Wpp</button>
                          
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── ABA: CARTEIRA DE CLIENTES 360º ─── */}
        {aba === "clientes" && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto Principal</th>
                  <th>Propostas</th>
                  <th>Contratos Ativos</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientesAgrupados.map((c: any) => {
                  const ativos = c.contratos.filter((ct:any) => ct.status === 'Ativo');
                  return (
                    <tr key={c.nome}>
                      <td><div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.nome}</div></td>
                      <td>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c.contato || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.email}</div>
                      </td>
                      <td><span className="badge-status badge-aberta">{c.propostas.length} Proposta(s)</span></td>
                      <td>
                        {ativos.length > 0 ? <span className="badge-status badge-concluido">{ativos.length} Contrato(s)</span> : <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Nenhum</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn-action btn-view" onClick={() => setClienteDetalhe(c)}>Ver Histórico Completo</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── ABA: CONTRATOS ─── */}
        {aba === "contratos" && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Início</th>
                  <th>Cliente</th>
                  <th>Valor Mensal (MRR)</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contratos.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Nenhum contrato registado.</td></tr>
                ) : (
                  contratos.map(c => (
                    <tr key={c.id} style={{ opacity: c.status === 'Cancelado' ? 0.5 : 1 }}>
                      <td>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{new Date(c.data_inicio).toLocaleDateString('pt-BR')}</div>
                        {c.data_fim && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Fim: {new Date(c.data_fim).toLocaleDateString('pt-BR')}</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.cliente_nome}</div>
                        {c.servicos_inclusos && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 300 }}>{c.servicos_inclusos}</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: c.status === 'Ativo' ? '#22c55e' : 'var(--text-primary)' }}>{fmt(c.valor_mensal)}</div>
                      </td>
                      <td>
                        <span className={`badge-status ${c.status === 'Ativo' ? 'badge-concluido' : c.status === 'Suspenso' ? 'badge-andamento' : 'badge-atrasado'}`}>{c.status}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn-action btn-view" onClick={() => editarContrato(c)}>Gerir Contrato</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

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
                {tarefasFiltradas.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Nenhuma tarefa.</td></tr>
                ) : (
                  tarefasFiltradas.map(t => {
                    const statusVisual = getStatusRealTarefa(t);
                    return (
                      <tr key={t.id} style={{ opacity: statusVisual === 'Concluído' ? 0.5 : 1 }}>
                        <td>
                          <div style={{ fontSize: 13, color: statusVisual === 'Atrasado' ? '#f87171' : 'var(--text-primary)', fontWeight: statusVisual === 'Atrasado' ? 700 : 400 }}>
                            {new Date(t.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.titulo}</div>
                        </td>
                        <td><div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{t.nome_referencia || "—"}</div></td>
                        <td><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.usuario_email.split('@')[0]}</div></td>
                        <td><span className={`badge-status badge-${statusVisual.toLowerCase().replace(' ', '')}`}>{statusVisual}</span></td>
                        <td style={{ textAlign: "right", minWidth: 200 }}>
                          {statusVisual !== 'Concluído' && (
                            <button className="btn-action btn-view" onClick={() => alterarStatusTarefaRapido(t.id, 'Concluído')} style={{ color: '#22c55e', borderColor: "rgba(34,197,94,0.3)" }}>✓ Concluir</button>
                          )}
                          <button className="btn-action btn-view" onClick={() => editarTarefa(t)}>Editar</button>
                          <button className="btn-action btn-delete" onClick={() => excluirTarefa(t.id)}>✕</button>
                        </td>
                      </tr>
                    );
                  })
                )}
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
                    <td><div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</div></td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{lead.empresa}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{lead.nome} • {lead.telefone}</div>
                    </td>
                    <td><span className="badge-status badge-aberta">{lead.produto} - {lead.plano}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn-action btn-view" onClick={() => abrirNovaTarefa(`Contato Lead: ${lead.empresa}`, lead.id, undefined)}>+ Tarefa</button>
                      <button className="btn-action btn-wpp" onClick={() => enviarWhatsAppLead(lead)}>Wpp</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>

      {/* ─── MODAL HISTÓRICO DE CLIENTE 360º ─── */}
      {clienteDetalhe && (
        <div className="modal-overlay" onClick={() => setClienteDetalhe(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, color: "var(--text-primary)", marginBottom: 8 }}>{clienteDetalhe.nome}</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>E-mail: {clienteDetalhe.email || 'Não informado'} <br/> Contato: {clienteDetalhe.contato || 'Não informado'}</p>

            <h3 style={{ fontSize: 14, color: "#4A90D9", marginBottom: 12, textTransform: "uppercase" }}>Contratos</h3>
            {clienteDetalhe.contratos.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Nenhum contrato.</p> : (
              <div style={{ marginBottom: 20, background: "var(--bg-main)", padding: 12, borderRadius: 10 }}>
                {clienteDetalhe.contratos.map((ct: any) => (
                  <div key={ct.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                    <span style={{ color: "var(--text-primary)", fontSize: 14 }}>{new Date(ct.data_inicio).toLocaleDateString('pt-BR')} - {ct.status}</span>
                    <span style={{ fontWeight: 600, color: ct.status === 'Ativo' ? '#22c55e' : 'var(--text-secondary)' }}>{fmt(ct.valor_mensal)}</span>
                  </div>
                ))}
              </div>
            )}

            <h3 style={{ fontSize: 14, color: "#4A90D9", marginBottom: 12, textTransform: "uppercase" }}>Propostas</h3>
            {clienteDetalhe.propostas.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Nenhuma proposta.</p> : (
              <div style={{ marginBottom: 20, background: "var(--bg-main)", padding: 12, borderRadius: 10 }}>
                {clienteDetalhe.propostas.map((p: any) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                    <span style={{ color: "var(--text-primary)", fontSize: 14 }}>{p.numero} ({p.status || 'aberta'})</span>
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{fmt(p.valor)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setClienteDetalhe(null)} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-medium)", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Fechar Relatório</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL TAREFA ─── */}
      {modalTarefa && (
        <div className="modal-overlay" onClick={() => setModalTarefa(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, color: "var(--text-primary)", marginBottom: 24, borderBottom: "1px solid var(--border-light)", paddingBottom: 16 }}>
              {formTarefa.id ? "Editar Tarefa" : "Nova Tarefa"}
            </h2>
            <form onSubmit={salvarTarefa}>
              <label className="label-modal">Título da Tarefa</label>
              <input required className="input-modal" value={formTarefa.titulo} onChange={e => setFormTarefa({...formTarefa, titulo: e.target.value})} placeholder="Ex: Ligar para confirmar..." />
              <label className="label-modal">Data e Hora de Vencimento</label>
              <input type="datetime-local" required className="input-modal" value={formTarefa.data_vencimento} onChange={e => setFormTarefa({...formTarefa, data_vencimento: e.target.value})} />
              <label className="label-modal">Descrição (Opcional)</label>
              <textarea className="input-modal" rows={3} value={formTarefa.descricao} onChange={e => setFormTarefa({...formTarefa, descricao: e.target.value})} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label-modal">Status</label>
                  <select className="input-modal" value={formTarefa.status} onChange={e => setFormTarefa({...formTarefa, status: e.target.value})}>
                    <option value="Pendente">Pendente</option><option value="Em andamento">Em andamento</option><option value="Concluído">Concluído</option>
                  </select>
                </div>
                <div>
                  <label className="label-modal">Responsável (E-mail)</label>
                  <input required type="email" className="input-modal" value={formTarefa.usuario_email} onChange={e => setFormTarefa({...formTarefa, usuario_email: e.target.value})} disabled={!isAdmin} style={{ opacity: !isAdmin ? 0.6 : 1 }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setModalTarefa(false)} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-medium)", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
                <button type="submit" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Gravar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL CONTRATO ─── */}
      {modalContrato && (
        <div className="modal-overlay" onClick={() => setModalContrato(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, color: "var(--text-primary)", marginBottom: 24, borderBottom: "1px solid var(--border-light)", paddingBottom: 16 }}>
              {formContrato.id ? "Gestão do Contrato" : "Novo Contrato"}
            </h2>
            <form onSubmit={salvarContrato}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label-modal">Nome do Cliente</label>
                  <input required className="input-modal" value={formContrato.cliente_nome} onChange={e => setFormContrato({...formContrato, cliente_nome: e.target.value})} disabled={!!formContrato.proposta_id} style={{ opacity: formContrato.proposta_id ? 0.6 : 1 }} />
                </div>
                <div>
                  <label className="label-modal">Valor Mensal (R$)</label>
                  <input type="number" step="0.01" required className="input-modal" value={formContrato.valor_mensal || ""} onChange={e => setFormContrato({...formContrato, valor_mensal: Number(e.target.value)})} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label-modal">Data Início</label>
                  <input type="date" required className="input-modal" value={formContrato.data_inicio} onChange={e => setFormContrato({...formContrato, data_inicio: e.target.value})} />
                </div>
                <div>
                  <label className="label-modal">Status do Contrato</label>
                  <select className="input-modal" value={formContrato.status} onChange={e => setFormContrato({...formContrato, status: e.target.value})}>
                    <option value="Ativo">Ativo</option><option value="Suspenso">Suspenso</option><option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <label className="label-modal">Serviços Inclusos / Observações</label>
              <textarea className="input-modal" rows={2} value={formContrato.servicos_inclusos} onChange={e => setFormContrato({...formContrato, servicos_inclusos: e.target.value})} />
              
              {formContrato.status === 'Cancelado' && (
                <>
                  <label className="label-modal" style={{ color: "#f87171" }}>Motivo do Cancelamento (Obrigatório)</label>
                  <textarea required className="input-modal" style={{ borderColor: "rgba(248,113,113,0.5)" }} rows={2} value={formContrato.motivo_cancelamento} onChange={e => setFormContrato({...formContrato, motivo_cancelamento: e.target.value})} placeholder="Escreva o motivo..." />
                </>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setModalContrato(false)} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-medium)", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
                <button type="submit" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Gravar Contrato</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
