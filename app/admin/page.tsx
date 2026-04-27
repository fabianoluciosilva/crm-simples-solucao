"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── COMPONENTES E VISTAS ───────────────────────────────────────────────────
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { DashboardView } from "@/components/views/DashboardView";
import { RelatoriosView } from "@/components/views/RelatoriosView";
import { PropostasView } from "@/components/views/PropostasView";
import { ClientesView } from "@/components/views/ClientesView";
import { ContratosView } from "@/components/views/ContratosView";
import { TarefasView } from "@/components/views/TarefasView";
import { TemplatesView } from "@/components/views/TemplatesView";
import { UsuariosView } from "@/components/views/UsuariosView";

// ─── MODAIS ─────────────────────────────────────────────────────────────────
import { ModalTarefa } from "@/components/modals/ModalTarefa";
import { ModalClienteForm } from "@/components/modals/ModalClienteForm";
import { ModalContrato } from "@/components/modals/ModalContrato";
import { ModalTemplate } from "@/components/modals/ModalTemplate";
import { ModalUsuario } from "@/components/modals/ModalUsuario";
import { ModalEditarValor } from "@/components/modals/ModalEditarValor";
import { ModalEnvio } from "@/components/modals/ModalEnvio";
import { ModalFichaCliente } from "@/components/modals/ModalFichaCliente";
import { ModalComunicado } from "@/components/modals/ModalComunicado";

import { fmt, formatarWhatsApp, calcDiasAtraso } from "@/utils/crmLogic";

type AbaType = "dashboard" | "propostas" | "clientes" | "contratos" | "tarefas" | "templates" | "usuarios" | "relatorios";

export default function AdminPage() {
  const router = useRouter();
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const [aba, setAba] = useState<AbaType>("dashboard");
  const [perfilAtivo, setPerfilAtivo] = useState<any>({ email: '', perfil: 'Comercial', filial: 'Matriz' });
  const [session, setSession] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: string } | null>(null);

  // --- ESTADOS DE DADOS ---
  const [propostas, setPropostas] = useState<any[]>([]);
  const [clientesBase, setClientesBase] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [interacoes, setInteracoes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);

  // --- ESTADOS DE FILTROS E BUSCA ---
  const [buscaCliente, setBuscaCliente] = useState("");
  const [filtroTipoCliente, setFiltroTipoCliente] = useState("Todos");
  const [mostrarDesativados, setMostrarDesativados] = useState(false);
  const [filtroStatusTarefa, setFiltroStatusTarefa] = useState("Todos");

  // --- ESTADOS DE MODAIS ---
  const [clienteDetalhe, setClienteDetalhe] = useState<any>(null);
  const [modalTarefa, setModalTarefa] = useState(false);
  const [modalClienteForm, setModalClienteForm] = useState(false);
  const [modalContrato, setModalContrato] = useState(false);
  const [modalTemplate, setModalTemplate] = useState(false);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [modalComunicado, setModalComunicado] = useState(false);
  const [modalEditarValor, setModalEditarValor] = useState<any>({ ativo: false, prop: null, novoValor: '' });
  const [modalEnvioProposta, setModalEnvioProposta] = useState<any>({ ativo: false, tipo: 'Email', prop: null, numeroWpp: '' });

  // --- FORMULÁRIOS DE MODAIS ---
  const [formTarefa, setFormTarefa] = useState<any>({});
  const [formInteracao, setFormInteracao] = useState({ tipo: 'Nota', descricao: '' });
  const [formCliente, setFormCliente] = useState<any>({});
  const [formContrato, setFormContrato] = useState<any>({});
  const [formTemplate, setFormTemplate] = useState<any>({ nome: "", tipo: "WhatsApp", conteudo: "" });
  const [formUsuario, setFormUsuario] = useState<any>({ email: "", perfil: "Comercial", filial: "Matriz" });
  const [formComunicado, setFormComunicado] = useState<any>({ publico: "Todos", assunto: "", mensagem: "" });

  const isAdmin = perfilAtivo.perfil === 'Admin';
  const isComercial = perfilAtivo.perfil === 'Comercial' || isAdmin;

  const showToast = useCallback((msg: string, tipo: string = 'sucesso') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const carregarTudo = useCallback(async () => {
    setCarregando(true);
    try {
      const [p, c, co, t, i, tp, u] = await Promise.all([
        supabase.from('propostas').select('*').order('created_at', { ascending: false }),
        supabase.from('clientes').select('*').order('nome', { ascending: true }),
        supabase.from('contratos').select('*').order('created_at', { ascending: false }),
        supabase.from('tarefas').select('*').order('data_vencimento', { ascending: true }),
        supabase.from('interacoes').select('*').order('created_at', { ascending: false }),
        supabase.from('templates').select('*').order('created_at', { ascending: false }),
        supabase.from('perfis').select('*').order('email', { ascending: true })
      ]);
      setPropostas(p.data || []);
      setClientesBase(c.data || []);
      setContratos(co.data || []);
      setTarefas(t.data || []);
      setInteracoes(i.data || []);
      setTemplates(tp.data || []);
      setUsuarios(u.data || []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("tema_ssti") || "dark";
    setTema(t as any);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      setSession(session);
      supabase.from('perfis').select('*').eq('email', session.user.email).single().then(({ data }) => {
        if (data) setPerfilAtivo(data);
        carregarTudo();
      });
    });
  }, [router, carregarTudo]);

  // ─── LÓGICA DE NEGÓCIO E BUSCAS ───────────────────────────────────────────
  const clientesAgrupados = useMemo(() => {
    const mapa = new Map();
    clientesBase.forEach(c => mapa.set(c.id, { ...c, propostas: [], interacoes: [] }));
    
    propostas.forEach(p => {
      const cli = Array.from(mapa.values()).find(c => c.id === p.cliente_id || c.nome.toUpperCase() === p.cliente.toUpperCase());
      if (cli) cli.propostas.push(p);
    });
    
    interacoes.forEach(i => {
      const cli = Array.from(mapa.values()).find(c => c.id === i.cliente_id || c.nome.toUpperCase() === i.cliente_nome.toUpperCase());
      if (cli) cli.interacoes.push(i);
    });
    
    let lista = Array.from(mapa.values());
    
    // Aplicação dos Filtros da Tela de Clientes (Pesquisa Restaurada)
    if (!mostrarDesativados) lista = lista.filter(c => c.ativo !== false);
    if (filtroTipoCliente !== "Todos") lista = lista.filter(c => c.tipo === filtroTipoCliente);
    if (buscaCliente) {
      const b = buscaCliente.toLowerCase();
      lista = lista.filter(c => c.nome?.toLowerCase().includes(b) || c.email?.toLowerCase().includes(b));
    }
    
    return lista;
  }, [clientesBase, propostas, interacoes, mostrarDesativados, filtroTipoCliente, buscaCliente]);

  const alertasCount = useMemo(() => {
    const leadsGelados = propostas.filter(p => {
      if (p.status === 'fechada' || p.status === 'perdida') return false;
      const cli = clientesAgrupados.find(c => c.id === p.cliente_id || c.nome.toUpperCase() === p.cliente.toUpperCase());
      const dataRef = cli?.interacoes?.[0] ? new Date(cli.interacoes[0].created_at) : new Date(p.created_at);
      return Math.floor((Date.now() - dataRef.getTime()) / (1000 * 60 * 60 * 24)) >= 7;
    }).length;
    const tarefasAtrasadas = tarefas.filter(t => t.status !== 'Concluído' && calcDiasAtraso(t.data_vencimento) > 0).length;
    return leadsGelados + tarefasAtrasadas;
  }, [propostas, tarefas, clientesAgrupados]);

  const mrrAtivo = useMemo(() => contratos.filter(c => c.status === 'Ativo').reduce((acc, c) => acc + Number(c.valor_mensal), 0), [contratos]);
  const propostasFechadas = useMemo(() => propostas.filter(p => p.status === 'fechada'), [propostas]);
  const taxaConversao = propostas.length > 0 ? (propostasFechadas.length / propostas.length) * 100 : 0;
  const ticketMedio = propostasFechadas.length > 0 ? (propostasFechadas.reduce((a, b) => a + (b.valor || 0), 0) / propostasFechadas.length) : 0;

  const dadosMotivosPerda = useMemo(() => {
    const obj = propostas.filter(p => p.status === 'perdida').reduce((acc: any, p) => {
      const m = p.motivo_perda || "Não informado";
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(obj).map(([name, value]) => ({ name, value }));
  }, [propostas]);

  const dadosPipelineMensal = useMemo(() => {
    const meses: Record<string, any> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      meses[key] = { ganhas: 0, perdidas: 0, abertas: 0 };
    }
    propostas.forEach(p => {
      const d = new Date(p.created_at);
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      if (meses[key]) {
        if (p.status === 'fechada') meses[key].ganhas++;
        else if (p.status === 'perdida') meses[key].perdidas++;
        else meses[key].abertas++;
      }
    });
    return Object.entries(meses).map(([name, v]) => ({ name, ...v }));
  }, [propostas]);

  const diasSemInteracao = useCallback((prop: any) => {
    const cli = clientesAgrupados.find(c => c.id === prop.cliente_id || c.nome.toUpperCase() === prop.cliente.toUpperCase());
    if (!cli || cli.interacoes.length === 0) return Math.abs(calcDiasAtraso(prop.created_at));
    return Math.floor((Date.now() - new Date(cli.interacoes[0].created_at).getTime()) / (1000 * 60 * 60 * 24));
  }, [clientesAgrupados]);

  // ─── FUNÇÕES DE INTERFACE ───────────────────────────────────────────────────
  const abrirModalEnvio = (prop: any, tipo: any) => setModalEnvioProposta({ ativo: true, tipo, prop, numeroWpp: formatarWhatsApp(prop.telefone || "") });
  const abrirNotasDaProposta = (prop: any) => {
    const cli = clientesAgrupados.find(c => c.id === prop.cliente_id || c.nome.toUpperCase() === prop.cliente.toUpperCase());
    setClienteDetalhe(cli || { nome: prop.cliente, propostas: [prop], interacoes: [] });
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <style>{`
        :root { 
          --bg-main: ${tema === 'dark' ? '#080f1e' : '#f4f7f9'}; 
          --bg-sidebar: ${tema === 'dark' ? '#050a14' : '#ffffff'}; 
          --border-light: ${tema === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}; 
          --text-primary: ${tema === 'dark' ? '#ffffff' : '#0f172a'}; 
          --text-secondary: ${tema === 'dark' ? 'rgba(255,255,255,0.5)' : '#64748b'}; 
        }
        body { background: var(--bg-main); color: var(--text-primary); }
        .sidebar { width: 260px; position: fixed; top: 0; bottom: 0; left: 0; background: var(--bg-sidebar); border-right: 1px solid var(--border-light); z-index: 100; scrollbar-width: none; overflow-y: auto; }
        .sidebar::-webkit-scrollbar { display: none; }
        .nav-menu { padding: 20px; display: flex; flex-direction: column; gap: 8px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; color: var(--text-secondary); cursor: pointer; border: none; background: transparent; font-weight: 600; font-size: 14px; text-align: left; transition: all 0.2s; width: 100%; }
        .nav-item:hover { background: rgba(74,144,217,0.1); color: var(--text-primary); }
        .nav-item.active { background: rgba(74,144,217,0.15); color: #4A90D9; }
        .main-content { flex: 1; margin-left: 260px; padding: 40px; background: var(--bg-main); min-height: 100vh; }
        .grid-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .metric-card { background: var(--bg-sidebar); border: 1px solid var(--border-light); border-radius: 12px; padding: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); }
        .table-wrapper { background: var(--bg-sidebar); border: 1px solid var(--border-light); border-radius: 12px; overflow-x: auto; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(0,0,0,0.02); padding: 12px 16px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); text-align: left; border-bottom: 1px solid var(--border-light); }
        td { padding: 12px 16px; border-bottom: 1px solid var(--border-light); font-size: 13px; }
        .btn-action { cursor: pointer; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-light); background: rgba(255,255,255,0.05); color: var(--text-primary); font-weight: 600; transition: 0.2s; }
        .btn-action:hover { background: rgba(74,144,217,0.2); border-color: #4A90D9; }
        .kanban-board { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 20px; }
        .kanban-col { flex: 1; min-width: 280px; max-width: 320px; background: var(--bg-sidebar); border: 1px solid var(--border-light); border-radius: 12px; display: flex; flex-direction: column; padding: 12px;}
        .kanban-card { background: var(--bg-main); border: 1px solid var(--border-light); border-radius: 8px; padding: 14px; margin-bottom: 12px; cursor: grab; }
        .modal-overlay { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999 !important; backdrop-filter: blur(4px); }
        .modal-content { background: ${tema === 'dark' ? '#0f172a' : '#ffffff'}; border: 1px solid var(--border-light); border-radius: 20px; padding: 30px; max-height: 90vh; overflow-y: auto; width: 95%; max-width: 800px; position: relative; color: var(--text-primary); }
        @media (max-width: 768px) { .sidebar { transform: translateX(-100%); } .main-content { margin-left: 0; padding: 20px; } }
      `}</style>

      <Sidebar 
        menuMobileAberto={menuMobileAberto} setMenuMobileAberto={setMenuMobileAberto} 
        tema={tema} alternarTema={() => {const n=tema==='dark'?'light':'dark'; setTema(n); localStorage.setItem("tema_ssti",n);}} 
        aba={aba} mudarAba={(a: any) => setAba(a)} isComercial={isComercial} isAdmin={isAdmin} 
        tarefasUrgentesCount={tarefas.filter(t => t.status !== 'Concluído' && calcDiasAtraso(t.data_vencimento) > 0).length} 
        router={router} abrirBuscaGlobal={()=>{}} perfilAtivo={perfilAtivo} handleLogout={()=>supabase.auth.signOut()} 
      />

      <main className="main-content">
        <Header 
          setMenuMobileAberto={setMenuMobileAberto} aba={aba} carregando={carregando} filtroDias={30} setFiltroDias={()=>{}} 
          vistaPropostas="kanban" setVistaPropostas={()=>{}} carregarTudo={carregarTudo} alertasCount={alertasCount} 
        />

        {/* ─── VISTAS ─── */}
        {aba === 'dashboard' && (
          <DashboardView 
            isAdmin={isAdmin} mrrAtivo={mrrAtivo} taxaConversao={taxaConversao} propostasFechadas={propostasFechadas}
            ticketMedio={ticketMedio} propostasPerdidas={propostas.filter(p => p.status === 'perdida')}
            propostasAbertas={propostas.filter(p => p.status === 'aberta' || !p.status)}
            propostasEnviadas={propostas.filter(p => p.status === 'enviada' || p.status === 'negociacao')}
            tarefasUrgentes={tarefas.filter(t => t.status !== 'Concluído')} mudarAba={setAba} pFiltradas={propostas}
            dadosMotivosPerda={dadosMotivosPerda} dadosPipelineMensal={dadosPipelineMensal}
          />
        )}

        {aba === 'propostas' && (
          <PropostasView 
            vistaPropostas="kanban" propostasAbertas={propostas.filter(p => p.status === 'aberta' || !p.status)} 
            propostasEnviadas={propostas.filter(p => p.status === 'enviada' || p.status === 'negociacao')} 
            propostasFechadas={propostasFechadas} propostasPerdidas={propostas.filter(p => p.status === 'perdida')} 
            pFiltradas={propostas} tarefaArrastando={null} handleDragStart={()=>{}} handleDragEnd={()=>{}} handleDragOver={()=>{}} handleDropStatus={()=>{}} 
            diasSemInteracao={diasSemInteracao} abrirModalEnvio={abrirModalEnvio} abrirNotasDaProposta={abrirNotasDaProposta} 
            setModalEditarValor={(v:any)=>setModalEditarValor(v)} isAdmin={isAdmin} 
            excluirProposta={async (id) => { await supabase.from('propostas').delete().eq('id', id); carregarTudo(); }} visualizarProposta={()=>{}} enviando={null} 
            alterarStatusParaGanho={async (p) => { await supabase.from('propostas').update({ status: 'fechada' }).eq('id', p.id); carregarTudo(); }} abrirModalPerda={()=>{}} reabrirProposta={async (id) => { await supabase.from('propostas').update({ status: 'aberta' }).eq('id', id); carregarTudo(); }}
          />
        )}

        {aba === 'relatorios' && (
          <RelatoriosView clientesAgrupados={clientesAgrupados} contratos={contratos} mrrAtivo={mrrAtivo} ticketMedio={ticketMedio} dadosPipelineMensal={dadosPipelineMensal} />
        )}
        
        {aba === 'clientes' && (
          <ClientesView 
            clientesAgrupados={clientesAgrupados} setClienteDetalhe={setClienteDetalhe} isAdmin={isAdmin} isComercial={isComercial}
            setModalClienteForm={setModalClienteForm} setFormCliente={setFormCliente} setModalComunicado={setModalComunicado} setFormComunicado={setFormComunicado}
            mostrarDesativados={mostrarDesativados} setMostrarDesativados={setMostrarDesativados}
            buscaCliente={buscaCliente} setBuscaCliente={setBuscaCliente} filtroTipoCliente={filtroTipoCliente} setFiltroTipoCliente={setFiltroTipoCliente}
            alternarStatusCliente={async (cli) => { await supabase.from('clientes').update({ ativo: !cli.ativo }).eq('id', cli.id); carregarTudo(); }} perfilAtivo={perfilAtivo}
          />
        )}

        {aba === 'contratos' && (
          <ContratosView 
            contratos={contratos} mrrAtivo={mrrAtivo}
            abrirNovoContrato={() => { setFormContrato({ cliente_nome: "", valor_mensal: 0, status: "Ativo" }); setModalContrato(true); }} 
            editarContrato={(c) => { setFormContrato(c); setModalContrato(true); }} 
          />
        )}
        
        {aba === 'tarefas' && (
          <TarefasView 
            tarefasFiltradas={tarefas} tarefasComAtraso={tarefas.filter(t => calcDiasAtraso(t.data_vencimento) > 0)}
            abrirNovaTarefa={() => { setFormTarefa({ titulo: "", descricao: "", status: "Pendente" }); setModalTarefa(true); }} 
            editarTarefa={(t) => { setFormTarefa(t); setModalTarefa(true); }}
            alterarStatusTarefaRapido={async (id, status) => { await supabase.from('tarefas').update({ status }).eq('id', id); carregarTudo(); }} 
            excluirTarefa={async (id) => { await supabase.from('tarefas').delete().eq('id', id); carregarTudo(); }}
            filtroStatusTarefa={filtroStatusTarefa} setFiltroStatusTarefa={setFiltroStatusTarefa} isAdmin={isAdmin}
          />
        )}

        {aba === 'templates' && isAdmin && (
          <TemplatesView 
            templates={templates} setModalTemplate={setModalTemplate} setFormTemplate={setFormTemplate} 
            excluirTemplate={async (id) => { await supabase.from('templates').delete().eq('id', id); carregarTudo(); }} 
          />
        )}

        {aba === 'usuarios' && isAdmin && (
          <UsuariosView 
            usuarios={usuarios} setModalUsuario={setModalUsuario} setFormUsuario={setFormUsuario} session={session} perfilAtivo={perfilAtivo}
            excluirUsuario={async (id) => { await supabase.from('perfis').delete().eq('id', id); carregarTudo(); }} 
          />
        )}
      </main>

      {/* ─── MODAIS ─── */}
      {clienteDetalhe && (
        <ModalFichaCliente 
          clienteDetalhe={clienteDetalhe} setClienteDetalhe={setClienteDetalhe} isComercial={isComercial} isAdmin={isAdmin} 
          abrirNovaTarefa={() => { setFormTarefa({ titulo: "", descricao: "", status: "Pendente" }); setModalTarefa(true); }} 
          formInteracao={formInteracao} setFormInteracao={setFormInteracao} 
          salvarInteracao={async (e:any) => { e.preventDefault(); await supabase.from('interacoes').insert([{ cliente_id: clienteDetalhe.id, cliente_nome: clienteDetalhe.nome, tipo: formInteracao.tipo, descricao: formInteracao.descricao }]); setFormInteracao({tipo:'Nota', descricao:''}); showToast("Nota salva!"); carregarTudo(); }} 
        />
      )}

      {modalEditarValor.ativo && (
        <ModalEditarValor isOpen={true} onClose={()=>setModalEditarValor({ativo:false, prop:null, novoValor:''})} modalEditarValor={modalEditarValor} setModalEditarValor={setModalEditarValor} salvarNovoValorProposta={async(e:any)=>{ e.preventDefault(); await supabase.from('propostas').update({valor:Number(modalEditarValor.novoValor)}).eq('id',modalEditarValor.prop.id); setModalEditarValor({ativo:false, prop:null, novoValor:''}); carregarTudo(); }} />
      )}

      {modalEnvioProposta.ativo && (
        <ModalEnvio modalEnvioProposta={modalEnvioProposta} setModalEnvioProposta={setModalEnvioProposta} formEnvioMensagem={{templateId:'', texto:'', assunto:''}} setFormEnvioMensagem={()=>{}} confirmarEnvioMensagem={async(e:any)=>{ e.preventDefault(); setModalEnvioProposta({...modalEnvioProposta, ativo:false}); showToast("Mensagem processada!"); }} templates={templates} enviando={null} />
      )}

      {modalTarefa && (
        <ModalTarefa isOpen={true} onClose={() => setModalTarefa(false)} formTarefa={formTarefa} setFormTarefa={setFormTarefa} salvarTarefa={async (e) => { e.preventDefault(); await supabase.from('tarefas').upsert([formTarefa]); setModalTarefa(false); carregarTudo(); }} />
      )}

      {modalContrato && (
        <ModalContrato isOpen={true} onClose={() => setModalContrato(false)} formContrato={formContrato} setFormContrato={setFormContrato} salvarContrato={async (e) => { e.preventDefault(); await supabase.from('contratos').upsert([formContrato]); setModalContrato(false); carregarTudo(); }} />
      )}

      {modalTemplate && (
        <ModalTemplate isOpen={true} onClose={() => setModalTemplate(false)} formTemplate={formTemplate} setFormTemplate={setFormTemplate} salvarTemplate={async (e) => { e.preventDefault(); await supabase.from('templates').upsert([formTemplate]); setModalTemplate(false); carregarTudo(); }} />
      )}

      {modalUsuario && (
        <ModalUsuario isOpen={true} onClose={() => setModalUsuario(false)} formUsuario={formUsuario} setFormUsuario={setFormUsuario} salvarUsuario={async (e) => { e.preventDefault(); await supabase.from('perfis').upsert([formUsuario]); setModalUsuario(false); carregarTudo(); }} />
      )}

      {modalClienteForm && (
        <ModalClienteForm isOpen={true} onClose={() => setModalClienteForm(false)} formCliente={formCliente} setFormCliente={setFormCliente} salvarClienteBase={async (e) => { e.preventDefault(); await supabase.from('clientes').upsert([formCliente]); setModalClienteForm(false); carregarTudo(); }} isAdmin={isAdmin} />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: toast.tipo === 'erro' ? '#ef4444' : '#22c55e', color: '#fff', padding: '12px 24px', borderRadius: 10, zIndex: 10000, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}