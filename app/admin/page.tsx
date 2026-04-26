"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { ModalPerda } from "@/components/modals/ModalPerda";
import { ModalEditarValor } from "@/components/modals/ModalEditarValor";
import { ModalComunicado } from "@/components/modals/ModalComunicado";
import { ModalEnvio } from "@/components/modals/ModalEnvio";
import { ModalFichaCliente } from "@/components/modals/ModalFichaCliente";

import { fmt, formatarWhatsApp, calcDiasAtraso } from "@/utils/crmLogic";

// ─── TIPOS ──────────────────────────────────────────────────────────────────
type AbaType = "dashboard" | "propostas" | "clientes" | "contratos" | "tarefas" | "templates" | "usuarios" | "relatorios";

export default function AdminPage() {
  const router = useRouter();
  
  // --- ESTADOS DE CONTROLE GERAL ---
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const [aba, setAba] = useState<AbaType>("dashboard");
  const [perfilAtivo, setPerfilAtivo] = useState<any>({ email: '', perfil: 'Comercial', filial: 'Matriz' });
  const [session, setSession] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: string } | null>(null);

  // --- ESTADOS DE DADOS (DATABASE) ---
  const [propostas, setPropostas] = useState<any[]>([]);
  const [clientesBase, setClientesBase] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [interacoes, setInteracoes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  // --- ESTADOS DE FILTROS E VISTAS ---
  const [filtroDias, setFiltroDias] = useState(30);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [filtroTipoCliente, setFiltroTipoCliente] = useState<any>("Todos");
  const [mostrarDesativados, setMostrarDesativados] = useState(false);
  const [vistaPropostas, setVistaPropostas] = useState<"kanban" | "tabela">("kanban");

  // --- ESTADOS DE MODAIS ---
  const [clienteDetalhe, setClienteDetalhe] = useState<any>(null);
  const [modalTarefa, setModalTarefa] = useState(false);
  const [modalContrato, setModalContrato] = useState(false);
  const [modalClienteForm, setModalClienteForm] = useState(false);
  const [modalPerda, setModalPerda] = useState(false);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [modalTemplate, setModalTemplate] = useState(false);
  const [modalComunicado, setModalComunicado] = useState(false);
  const [modalEditarValor, setModalEditarValor] = useState<{ativo: boolean, prop: any, novoValor: string}>({ ativo: false, prop: null, novoValor: '' });
  const [modalEnvioProposta, setModalEnvioProposta] = useState<{ativo: boolean, tipo: string, prop: any, numeroWpp: string}>({ ativo: false, tipo: 'Email', prop: null, numeroWpp: '' });

  // --- FORMULÁRIOS ---
  const [formTarefa, setFormTarefa] = useState<any>({ titulo: "", descricao: "", data_vencimento: "", status: "Pendente", prioridade: "Normal" });
  const [formInteracao, setFormInteracao] = useState({ tipo: "Nota", descricao: "" });
  const [formPerda, setFormPerda] = useState({ id: 0, motivo: "", obs: "" });
  const [formEnvioMensagem, setFormEnvioMensagem] = useState({ templateId: '', texto: '', assunto: '' });
  const [formCliente, setFormCliente] = useState<any>({ nome: "", email: "", tipo: "Cliente", filial: "Matriz" });
  const [formContrato, setFormContrato] = useState<any>({ cliente_nome: "", valor_mensal: 0, status: "Ativo" });
  const [formUsuario, setFormUsuario] = useState<any>({ email: "", perfil: "Comercial", filial: "Matriz" });
  const [formTemplate, setFormTemplate] = useState<any>({ nome: "", tipo: "WhatsApp", conteudo: "" });

  const isAdmin = perfilAtivo.perfil === 'Admin';
  const isComercial = perfilAtivo.perfil === 'Comercial' || isAdmin;

  const showToast = useCallback((msg: string, tipo: string = 'sucesso') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── CARREGAMENTO DE DADOS ────────────────────────────────────────────────
  const carregarTudo = useCallback(async () => {
    setCarregando(true);
    try {
      const [p, c, co, t, i, tp, u, l] = await Promise.all([
        supabase.from('propostas').select('*').order('created_at', { ascending: false }),
        supabase.from('clientes').select('*').order('nome', { ascending: true }),
        supabase.from('contratos').select('*').order('created_at', { ascending: false }),
        supabase.from('tarefas').select('*').order('data_vencimento', { ascending: true }),
        supabase.from('interacoes').select('*').order('created_at', { ascending: false }),
        supabase.from('templates').select('*').order('created_at', { ascending: false }),
        supabase.from('perfis').select('*').order('email', { ascending: true }),
        supabase.from('leads').select('*').order('created_at', { ascending: false })
      ]);

      if (p.data) setPropostas(p.data);
      if (c.data) setClientesBase(c.data);
      if (co.data) setContratos(co.data);
      if (t.data) setTarefas(t.data);
      if (i.data) setInteracoes(i.data);
      if (tp.data) setTemplates(tp.data);
      if (u.data) setUsuarios(u.data);
      if (l.data) setLeads(l.data);
    } catch (error) {
      showToast("Erro ao sincronizar dados.", "erro");
    } finally {
      setCarregando(false);
    }
  }, [showToast]);

  useEffect(() => {
    const t = localStorage.getItem("tema_ssti");
    if (t === "light" || t === "dark") setTema(t);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      setSession(session);
      supabase.from('perfis').select('*').eq('email', session.user.email).single().then(({ data }) => {
        if (data) setPerfilAtivo(data);
        carregarTudo();
      });
    });
  }, [router, carregarTudo]);

  // ─── LÓGICA DE NEGÓCIO E MÉTRICAS ─────────────────────────────────────────
  const clientesAgrupados = useMemo(() => {
    const mapa = new Map();
    clientesBase.forEach(c => mapa.set(c.id, { ...c, propostas: [], contratos: [], interacoes: [], tarefas: [] }));
    
    propostas.forEach(p => {
      const cli = Array.from(mapa.values()).find(c => c.id === p.cliente_id || c.nome.toUpperCase() === p.cliente.toUpperCase());
      if (cli) cli.propostas.push(p);
    });

    interacoes.forEach(i => {
      const cli = Array.from(mapa.values()).find(c => c.id === i.cliente_id || c.nome.toUpperCase() === i.cliente_nome.toUpperCase());
      if (cli) cli.interacoes.push(i);
    });

    let lista = Array.from(mapa.values());
    if (!mostrarDesativados) lista = lista.filter(c => c.ativo !== false);
    if (buscaCliente) lista = lista.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()));
    
    return lista;
  }, [clientesBase, propostas, interacoes, buscaCliente, mostrarDesativados]);

  const mrrAtivo = useMemo(() => contratos.filter(c => c.status === 'Ativo').reduce((acc, c) => acc + Number(c.valor_mensal), 0), [contratos]);
  
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

  // ─── FUNÇÕES DE AÇÃO ──────────────────────────────────────────────────────
  const abrirModalEnvio = (prop: any, tipo: any) => {
    setFormEnvioMensagem({ templateId: '', texto: '', assunto: `Proposta ${prop.numero} - Simples Solução TI` });
    setModalEnvioProposta({ ativo: true, tipo, prop, numeroWpp: formatarWhatsApp(prop.telefone || "") });
  };

  const abrirNotasDaProposta = (prop: any) => {
    const cli = clientesAgrupados.find(c => c.id === prop.cliente_id || c.nome.toUpperCase() === p.cliente.toUpperCase());
    if (cli) setClienteDetalhe(cli);
    else setClienteDetalhe({ nome: prop.cliente, propostas: [prop], interacoes: [] });
  };

  const excluirProposta = async (id: number, nome: string) => {
    if (confirm(`Deseja excluir a proposta de ${nome}?`)) {
      await supabase.from('propostas').delete().eq('id', id);
      showToast("Proposta removida.");
      carregarTudo();
    }
  };

  const salvarNovoValorProposta = async (e: any) => {
    e.preventDefault();
    if (modalEditarValor.prop) {
      await supabase.from('propostas').update({ valor: Number(modalEditarValor.novoValor) }).eq('id', modalEditarValor.prop.id);
      setModalEditarValor({ ativo: false, prop: null, novoValor: '' });
      showToast("Valor atualizado!");
      carregarTudo();
    }
  };

  const salvarInteracao = async (e: any) => {
    e.preventDefault();
    await supabase.from('interacoes').insert([{ 
      cliente_id: clienteDetalhe.id, 
      cliente_nome: clienteDetalhe.nome, 
      tipo: formInteracao.tipo, 
      descricao: formInteracao.descricao, 
      usuario_email: perfilAtivo.email 
    }]);
    setFormInteracao({ tipo: "Nota", descricao: "" });
    showToast("Interação salva!");
    carregarTudo();
    // Refresh local da timeline
    const { data } = await supabase.from('interacoes').select('*').eq('cliente_id', clienteDetalhe.id).order('created_at', { ascending: false });
    setClienteDetalhe({ ...clienteDetalhe, interacoes: data });
  };

  const reabrirProposta = async (id: number) => {
    await supabase.from('propostas').update({ status: 'aberta' }).eq('id', id);
    showToast("Proposta reaberta.");
    carregarTudo();
  };

  const diasSemInteracao = (prop: any) => {
    if (prop.status === 'fechada' || prop.status === 'perdida') return 0;
    const cli = clientesAgrupados.find(c => c.id === prop.cliente_id || c.nome.toUpperCase() === prop.cliente.toUpperCase());
    const dataRef = cli?.interacoes?.[0] ? new Date(cli.interacoes[0].created_at) : new Date(prop.created_at);
    return Math.floor((Date.now() - dataRef.getTime()) / (1000 * 60 * 60 * 24));
  };

  const abrirNovaTarefa = (ref?: string, cliId?: string) => {
    setFormTarefa({ ...formTarefa, nome_referencia: ref || "", cliente_id: cliId || "" });
    setModalTarefa(true);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-main)" }}>
      <style>{`
        :root {
          --bg-main: ${tema === 'dark' ? '#080f1e' : '#f4f7f9'};
          --bg-sidebar: ${tema === 'dark' ? '#050a14' : '#ffffff'};
          --bg-card: ${tema === 'dark' ? 'rgba(255,255,255,0.02)' : '#ffffff'};
          --border-light: rgba(255,255,255,0.05);
          --text-primary: ${tema === 'dark' ? '#ffffff' : '#0f172a'};
          --text-secondary: ${tema === 'dark' ? 'rgba(255,255,255,0.5)' : '#64748b'};
        }
        .sidebar { width: 260px; position: fixed; top: 0; bottom: 0; left: 0; background: var(--bg-sidebar); border-right: 1px solid var(--border-light); z-index: 100; scrollbar-width: none; }
        .sidebar::-webkit-scrollbar { display: none; }
        .main-content { flex: 1; margin-left: 260px; padding: 40px; min-height: 100vh; transition: all 0.3s; }
        
        /* MODAIS FIXOS E CENTRALIZADOS */
        .modal-overlay { 
          position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; 
          background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; 
          z-index: 9999 !important; backdrop-filter: blur(4px);
        }
        .modal-content { 
          background: #0f172a; border: 1px solid var(--border-light); border-radius: 20px; 
          padding: 30px; max-width: 800px; width: 95%; max-height: 90vh; overflow-y: auto; position: relative;
        }

        .btn-action { cursor: pointer; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-light); background: rgba(255,255,255,0.05); color: #fff; font-weight: 600; transition: 0.2s; }
        .btn-action:hover { background: rgba(74,144,217,0.2); border-color: #4A90D9; }

        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
          .main-content { margin-left: 0; padding: 20px; }
        }
      `}</style>

      <Sidebar 
        menuMobileAberto={menuMobileAberto} setMenuMobileAberto={setMenuMobileAberto}
        tema={tema} alternarTema={() => {
          const n = tema === 'dark' ? 'light' : 'dark';
          setTema(n); localStorage.setItem("tema_ssti", n);
        }}
        aba={aba} mudarAba={(a: any) => setAba(a)}
        isComercial={isComercial} isAdmin={isAdmin} tarefasUrgentesCount={tarefas.filter(t => t.status !== 'Concluído' && calcDiasAtraso(t.data_vencimento) > 0).length}
        router={router} abrirBuscaGlobal={() => {}} perfilAtivo={perfilAtivo} handleLogout={() => supabase.auth.signOut()}
      />

      <main className="main-content">
        <Header 
          setMenuMobileAberto={setMenuMobileAberto} aba={aba} carregando={carregando}
          filtroDias={filtroDias} setFiltroDias={setFiltroDias}
          vistaPropostas={vistaPropostas} setVistaPropostas={setVistaPropostas} carregarTudo={carregarTudo}
          alertasCount={alertasCount}
        />

        {aba === 'dashboard' && <DashboardView isAdmin={isAdmin} mrrAtivo={mrrAtivo} propostasAbertas={propostas.filter(p => p.status === 'aberta' || !p.status)} pFiltradas={propostas} tarefasUrgentes={tarefas.filter(t => t.status !== 'Concluído')} />}
        
        {aba === 'propostas' && (
          <PropostasView 
            vistaPropostas={vistaPropostas} 
            propostasAbertas={propostas.filter(p => p.status === 'aberta' || !p.status)}
            propostasEnviadas={propostas.filter(p => p.status === 'enviada' || p.status === 'negociacao')}
            propostasFechadas={propostas.filter(p => p.status === 'fechada')}
            propostasPerdidas={propostas.filter(p => p.status === 'perdida')}
            pFiltradas={propostas}
            abrirModalEnvio={abrirModalEnvio}
            abrirNotasDaProposta={abrirNotasDaProposta}
            setModalEditarValor={(val: any) => setModalEditarValor(val)}
            excluirProposta={excluirProposta}
            diasSemInteracao={diasSemInteracao}
            reabrirProposta={reabrirProposta}
            isAdmin={isAdmin}
          />
        )}

        {aba === 'relatorios' && <RelatoriosView clientesAgrupados={clientesAgrupados} contratos={contratos} mrrAtivo={mrrAtivo} ticketMedio={0} dadosPipelineMensal={[]} />}
        
        {aba === 'clientes' && (
          <ClientesView 
            clientesAgrupados={clientesAgrupados} 
            setClienteDetalhe={setClienteDetalhe} 
            setModalClienteForm={setModalClienteForm}
            setFormCliente={setFormCliente}
          />
        )}

        {aba === 'contratos' && <ContratosView contratos={contratos} abrirNovoContrato={() => setModalContrato(true)} />}
        
        {aba === 'tarefas' && (
          <TarefasView 
            tarefasFiltradas={tarefas} 
            abrirNovaTarefa={abrirNovaTarefa} 
            alterarStatusTarefaRapido={async (id, status) => { await supabase.from('tarefas').update({ status }).eq('id', id); carregarTudo(); }}
            excluirTarefa={async (id) => { await supabase.from('tarefas').delete().eq('id', id); carregarTudo(); }}
          />
        )}
      </main>

      {/* MODAIS GLOBAIS */}
      {modalEditarValor.ativo && (
        <ModalEditarValor 
          isOpen={true} onClose={() => setModalEditarValor({ ativo: false, prop: null, novoValor: '' })} 
          modalEditarValor={modalEditarValor} setModalEditarValor={setModalEditarValor} salvarNovoValorProposta={salvarNovoValorProposta} 
        />
      )}

      {modalEnvioProposta.ativo && (
        <ModalEnvio 
          modalEnvioProposta={modalEnvioProposta} setModalEnvioProposta={setModalEnvioProposta} 
          formEnvioMensagem={formEnvioMensagem} setFormEnvioMensagem={setFormEnvioMensagem} 
          confirmarEnvioMensagem={async () => { showToast("Mensagem enviada!"); setModalEnvioProposta({...modalEnvioProposta, ativo: false}); }} 
          templates={templates} 
        />
      )}

      {clienteDetalhe && (
        <ModalFichaCliente 
          clienteDetalhe={clienteDetalhe} setClienteDetalhe={setClienteDetalhe} 
          isComercial={isComercial} isAdmin={isAdmin} 
          abrirNovaTarefa={abrirNovaTarefa} 
          formInteracao={formInteracao} setFormInteracao={setFormInteracao} salvarInteracao={salvarInteracao} 
        />
      )}

      {modalTarefa && <ModalTarefa isOpen={true} onClose={() => setModalTarefa(false)} formTarefa={formTarefa} setFormTarefa={setFormTarefa} salvarTarefa={async () => { await supabase.from('tarefas').insert([formTarefa]); setModalTarefa(false); carregarTudo(); }} />}
      {modalClienteForm && <ModalClienteForm isOpen={true} onClose={() => setModalClienteForm(false)} formCliente={formCliente} setFormCliente={setFormCliente} salvarClienteBase={async () => { await supabase.from('clientes').insert([formCliente]); setModalClienteForm(false); carregarTudo(); }} isAdmin={isAdmin} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: toast.tipo === 'erro' ? '#ef4444' : '#22c55e', color: '#fff', padding: '12px 24px', borderRadius: 10, zIndex: 10000, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}