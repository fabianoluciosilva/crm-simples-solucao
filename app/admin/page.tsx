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
  const carregarTudo = async () => {
    if (!session) return;
    setCarregando(true);
    const [p, l, t, c] = await Promise.all([
      supabase.from('propostas').select('*').order('created_at', { ascending: false }),
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('tarefas').select('*').order('data_vencimento', { ascending: true }),
      supabase.from('contratos').select('*').order('created_at', { ascending: false })
    ]);
    if (p.data) setPropostas(p.data);
    if (l.data) setLeads(l.data);
    if (c.data) setContratos(c.data);
    if (t.data) {
      setTarefas(isAdmin ? t.data : t.data.filter(x => x.usuario_email === session.user.email));
    }
    setCarregando(false);
  };

  useEffect(() => { carregarTudo(); }, [session, filtroDias]);

  // ─── AUTOMAÇÃO IMEDIATA: CRIAR FOLLOW-UP AUTOMÁTICO ──────────────────────
  const dispararAutomacaoFollowUp = async (prop: PropostaDB) => {
    try {
      // 1. Tentar registar no log (A chave única no DB impede duplicados)
      const { error: logError } = await supabase.from('automacoes_log').insert([{
        tipo_regra: 'PROPOSTA_ENVIADA_FOLLOWUP',
        referencia_id: prop.id,
        tabela_referencia: 'propostas',
        acao_executada: 'Tarefa de Follow-up Criada'
      }]);

      if (logError) return; // Se já existir, sai para não duplicar a tarefa

      // 2. Criar a Tarefa para daqui a 3 dias
      const dataVenc = new Date();
      dataVenc.setDate(dataVenc.getDate() + 3);
      dataVenc.setHours(10, 0, 0, 0); // Define para as 10h da manhã

      await supabase.from('tarefas').insert([{
        titulo: `📞 Follow-up: ${prop.cliente}`,
        descricao: `Automação: Validar retorno da proposta ${prop.numero}.`,
        data_vencimento: dataVenc.toISOString(),
        status: 'Pendente',
        usuario_email: session.user.email,
        nome_referencia: prop.cliente,
        proposta_id: prop.id
      }]);

      console.log("Automação executada: Follow-up criado.");
    } catch (e) {
      console.error("Falha na automação:", e);
    }
  };

  // ─── AÇÕES DE PROPOSTAS ───────────────────────────────────────────────────
  const enviarPorEmail = async (prop: PropostaDB) => {
    if (!prop.email) return alert("E-mail não registado.");
    if (!confirm(`Enviar proposta para ${prop.email}?`)) return;
    setEnviando(prop.id);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: prop.email,
          subject: `Proposta Comercial SSTI - ${prop.cliente}`,
          html: `<div style="font-family:sans-serif;color:#333;"><h2>Proposta Comercial - SSTI</h2><p>Olá <strong>${prop.contato}</strong>, segue a proposta para a <strong>${prop.cliente}</strong>.</p><p>Valor: ${fmt(prop.valor)}</p></div>`,
          fileName: `Proposta_${prop.numero}.pdf`
        }),
      });

      if (response.ok) {
        // ATUALIZA STATUS
        await supabase.from('propostas').update({ status_envio: 'enviado' }).eq('id', prop.id);
        
        // EXECUTA AUTOMAÇÃO IMEDIATA
        await dispararAutomacaoFollowUp(prop);
        
        alert("E-mail enviado e Follow-up agendado automaticamente!");
        carregarTudo();
      } else alert("Falha ao enviar e-mail.");
    } catch (e) { alert("Erro de conexão."); } finally { setEnviando(null); }
  };

  const visualizarProposta = (prop: PropostaDB) => {
    const w = window.open("", "_blank")!;
    w.document.write(`<html><body style="font-family:sans-serif;padding:40px;"><h2>Proposta Simples Solução TI</h2><hr/><p>Cliente: ${prop.cliente}</p><p>Valor Mensal: ${fmt(prop.valor)}</p></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const enviarWhatsApp = (prop: PropostaDB) => {
    const texto = `Olá, envio a nossa proposta (cód: ${prop.numero}) no valor de ${fmt(prop.valor)} mensais.`;
    window.open(`https://wa.me/${prop.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  // ─── OUTRAS FUNÇÕES (LEADS, CONTRATOS, TAREFAS) ───────────────────────────
  const alterarStatus = async (id: number, novoStatus: string) => { await supabase.from('propostas').update({ status: novoStatus }).eq('id', id); carregarTudo(); };
  const excluirProposta = async (id: number, nome: string) => { if (confirm(`Excluir ${nome}?`)) { await supabase.from('propostas').delete().eq('id', id); carregarTudo(); }};

  const salvarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formContrato.status === 'Cancelado' && !formContrato.motivo_cancelamento) return alert("Motivo obrigatório.");
    const payload = { ...formContrato, updated_at: new Date().toISOString() };
    if (formContrato.id) await supabase.from('contratos').update(payload).eq('id', formContrato.id);
    else await supabase.from('contratos').insert([payload]);
    setModalContrato(false); carregarTudo();
  };

  const salvarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formTarefa, updated_at: new Date().toISOString() };
    if (formTarefa.id) await supabase.from('tarefas').update(payload).eq('id', formTarefa.id);
    else await supabase.from('tarefas').insert([payload]);
    setModalTarefa(false); carregarTudo();
  };

  // ─── CÁLCULOS DO DASHBOARD ────────────────────────────────────────────────
  const limiteFiltro = new Date(); if (filtroDias > 0) limiteFiltro.setDate(limiteFiltro.getDate() - filtroDias);
  const pFiltradas = propostas.filter(p => filtroDias === 0 || new Date(p.created_at) >= limiteFiltro);
  const mrrAtivo = contratos.filter(c => c.status === 'Ativo').reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  // ─── AGRUPAMENTO CLIENTES 360º ───────────────────────────────────────────
  const clientesAgrupados = useMemo(() => {
    const mapa = new Map<string, any>();
    propostas.forEach(p => {
      const key = p.cliente.trim().toUpperCase();
      if (!mapa.has(key)) mapa.set(key, { nome: p.cliente, email: p.email, contato: p.contato, propostas: [], contratos: [], tarefas: [] });
      mapa.get(key).propostas.push(p);
    });
    contratos.forEach(c => {
      const key = c.cliente_nome.trim().toUpperCase();
      if (!mapa.has(key)) mapa.set(key, { nome: c.cliente_nome, propostas: [], contratos: [], tarefas: [] });
      mapa.get(key).contratos.push(c);
    });
    tarefas.forEach(t => {
      if (t.nome_referencia) {
        const key = t.nome_referencia.trim().toUpperCase();
        if (mapa.has(key)) mapa.get(key).tarefas.push(t);
      }
    });
    return Array.from(mapa.values()).sort((a,b) => a.nome.localeCompare(b.nome));
  }, [propostas, contratos, tarefas]);

  if (carregandoAuth) return <div style={{minHeight:"100vh",background:"#080f1e",display:"flex",alignItems:"center",justifyContent:"center",color:"#4A90D9"}}>A validar sessão...</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <style>{`:root{--bg-main:${tema==='dark'?'#080f1e':'#f4f7f9'};--bg-sidebar:${tema==='dark'?'#050a14':'#ffffff'};--bg-card:${tema==='dark'?'rgba(255,255,255,0.02)':'#ffffff'};--text-primary:${tema==='dark'?'#ffffff':'#0f172a'};--text-secondary:${tema==='dark'?'rgba(255,255,255,0.5)':'#64748b'};--border-light:${tema==='dark'?'rgba(255,255,255,0.05)':'#e2e8f0'}} *{box-sizing:border-box;margin:0;padding:0} body{background:var(--bg-main);color:var(--text-primary);font-family:'Outfit',sans-serif}.sidebar{width:260px;background:var(--bg-sidebar);border-right:1px solid var(--border-light);position:fixed;top:0;bottom:0;left:0;display:flex;flex-direction:column;z-index:10}.main-content{flex:1;margin-left:260px;padding:40px}.nav-menu{padding:20px;flex:1;display:flex;flex-direction:column;gap:8px}.nav-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;color:var(--text-secondary);cursor:pointer;border:none;background:transparent;font-weight:600;width:100%;text-align:left}.nav-item.active{background:rgba(74,144,217,0.1);color:#4A90D9}.grid-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:40px}.metric-card{background:var(--bg-card);border:1px solid var(--border-light);border-radius:16px;padding:24px}.table-wrapper{background:var(--bg-card);border:1px solid var(--border-light);border-radius:16px;overflow:hidden}table{width:100%;border-collapse:collapse}th{background:rgba(0,0,0,0.1);padding:16px;font-size:12px;text-transform:uppercase;color:var(--text-secondary);text-align:left}td{padding:16px;border-bottom:1px solid var(--border-light);font-size:14px}.badge-status{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase}.btn-action{padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--border-light);background:rgba(255,255,255,0.05);color:var(--text-primary);margin-right:4px;margin-bottom:4px}.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100}.modal-content{background:var(--bg-sidebar);padding:30px;border-radius:20px;width:100%;max-width:500px}`}</style>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div style={{padding:"30px",textAlign:"center"}}><img src={tema==='dark'?'/Logo-negativo.webp':'/logo-ssti.webp'} style={{maxHeight:"40px"}}/></div>
        <nav className="nav-menu">
          <button className={`nav-item ${aba==='propostas'?'active':''}`} onClick={()=>setAba('propostas')}>📊 Dashboard / Pipeline</button>
          <button className={`nav-item ${aba==='clientes'?'active':''}`} onClick={()=>setAba('clientes')}>👥 Clientes 360º</button>
          <button className={`nav-item ${aba==='contratos'?'active':''}`} onClick={()=>setAba('contratos')}>📄 Contratos (MRR)</button>
          <button className={`nav-item ${aba==='tarefas'?'active':''}`} onClick={()=>setAba('tarefas')}>✅ Tarefas</button>
          <button className={`nav-item ${aba==='leads'?'active':''}`} onClick={()=>setAba('leads')}>🎯 Leads do Site</button>
          <button className="nav-item" style={{color:"#4A90D9",marginTop:"20px",border:"1px dashed #4A90D9"}} onClick={()=>router.push('/preco')}>+ Nova Proposta</button>
        </nav>
        <div style={{padding:"20px",borderTop:"1px solid var(--border-light)"}}>
           <div style={{fontSize:"12px",color:"var(--text-secondary)"}}>{session?.user?.email}</div>
           <button onClick={handleLogout} style={{color:"#f87171",background:"none",border:"none",cursor:"pointer",fontSize:"12px",marginTop:"8px"}}>Sair</button>
        </div>
      </aside>

      <main className="main-content">
        <header style={{display:"flex",justifyContent:"space-between",marginBottom:"40px"}}>
          <h1 style={{fontSize:"24px"}}>{aba.toUpperCase()}</h1>
          <div style={{display:"flex",gap:"10px"}}>
            <button onClick={alternarTema} className="btn-action">{tema==='dark'?'☀️ Claro':'🌙 Escuro'}</button>
            {aba === 'propostas' && (
              <select value={filtroDias} onChange={e=>setFiltroDias(Number(e.target.value))} style={{background:"var(--bg-card)",color:"var(--text-primary)",border:"1px solid var(--border-light)",borderRadius:"8px",padding:"0 10px"}}>
                <option value={30}>30 dias</option><option value={0}>Sempre</option>
              </select>
            )}
          </div>
        </header>

        {/* DASHBOARD */}
        {aba === 'propostas' && (
          <>
            <div className="grid-metrics">
              <div className="metric-card"><div style={{fontSize:"12px",color:"var(--text-secondary)"}}>MRR ATIVO</div><div style={{fontSize:"24px",fontWeight:800}}>{fmt(mrrAtivo)}</div></div>
              <div className="metric-card"><div style={{fontSize:"12px",color:"var(--text-secondary)"}}>CONVERSÃO</div><div style={{fontSize:"24px",fontWeight:800}}>{taxaConversao.toFixed(1)}%</div></div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {pFiltradas.map(p => (
                    <tr key={p.id}>
                      <td>{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                      <td><strong>{p.cliente}</strong><br/><small>{p.contato}</small></td>
                      <td>{fmt(p.valor)}</td>
                      <td><span className="badge-status" style={{background:p.status==='fechada'?'#22c55e22':'#f59e0b22',color:p.status==='fechada'?'#22c55e':'#f59e0b'}}>{p.status||'aberta'}</span></td>
                      <td>
                        <button className="btn-action" onClick={()=>visualizarProposta(p)}>PDF</button>
                        <button className="btn-action" onClick={()=>enviarWhatsApp(p)}>Wpp</button>
                        <button className="btn-action" disabled={enviando===p.id} onClick={()=>enviarPorEmail(p)}>{enviando===p.id?'...':'E-mail'}</button>
                        {p.status !== 'fechada' && <button className="btn-action" style={{color:"#22c55e"}} onClick={()=>alterarStatus(p.id,'fechada')}>Ganhou</button>}
                        <button className="btn-action" style={{color:"#f87171"}} onClick={()=>excluirProposta(p.id,p.cliente)}>X</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* CLIENTES 360º */}
        {aba === 'clientes' && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Nome da Empresa</th><th>Contato</th><th>Propostas</th><th>Contratos</th><th>Ação</th></tr></thead>
              <tbody>
                {clientesAgrupados.map(c => (
                  <tr key={c.nome}>
                    <td><strong>{c.nome}</strong></td>
                    <td>{c.contato}<br/><small>{c.email}</small></td>
                    <td>{c.propostas.length}</td>
                    <td>{c.contratos.filter((x:any)=>x.status==='Ativo').length} Ativos</td>
                    <td><button className="btn-action" onClick={()=>setClienteDetalhe(c)}>Ver Histórico</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAREFAS */}
        {aba === 'tarefas' && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Prazo</th><th>Tarefa</th><th>Cliente</th><th>Status</th><th>Ação</th></tr></thead>
              <tbody>
                {tarefas.map(t => (
                  <tr key={t.id} style={{opacity:t.status==='Concluído'?0.5:1}}>
                    <td>{new Date(t.data_vencimento).toLocaleDateString('pt-BR')}</td>
                    <td><strong>{t.titulo}</strong></td>
                    <td>{t.nome_referencia}</td>
                    <td>{t.status}</td>
                    <td>{t.status !== 'Concluído' && <button className="btn-action" onClick={()=>alterarStatusTarefaRapido(t.id,'Concluído')}>✓</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* LEADS */}
        {aba === 'leads' && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Data</th><th>Empresa</th><th>Interesse</th><th>Ação</th></tr></thead>
              <tbody>
                {leads.map(l => (
                  <tr key={l.id}>
                    <td>{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                    <td><strong>{l.empresa}</strong><br/>{l.nome}</td>
                    <td>{l.produto}</td>
                    <td><button className="btn-action" onClick={()=>enviarWhatsAppLead(l)}>Chamar Wpp</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* MODAL DETALHE CLIENTE 360º */}
      {clienteDetalhe && (
        <div className="modal-overlay" onClick={()=>setClienteDetalhe(null)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <h2>{clienteDetalhe.nome}</h2>
            <hr style={{margin:"15px 0", opacity:0.1}}/>
            <h4>PROPOSTAS</h4>
            {clienteDetalhe.propostas.map((p:any)=><div key={p.id} style={{fontSize:"13px",padding:"5px 0"}}>{p.numero} - {fmt(p.valor)} ({p.status})</div>)}
            <h4 style={{marginTop:"15px"}}>CONTRATOS</h4>
            {clienteDetalhe.contratos.map((c:any)=><div key={c.id} style={{fontSize:"13px",padding:"5px 0"}}>{fmt(c.valor_mensal)} - {c.status}</div>)}
            <button className="btn-action" style={{marginTop:"20px",width:"100%"}} onClick={()=>setClienteDetalhe(null)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
