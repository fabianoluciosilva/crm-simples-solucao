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

// ─── MODAIS ─────────────────────────────────────────────────────────────────
import { ModalTarefa } from "@/components/modals/ModalTarefa";
import { ModalClienteForm } from "@/components/modals/ModalClienteForm";
import { ModalContrato } from "@/components/modals/ModalContrato";
import { ModalEditarValor } from "@/components/modals/ModalEditarValor";
import { ModalEnvio } from "@/components/modals/ModalEnvio";
import { ModalFichaCliente } from "@/components/modals/ModalFichaCliente";

import { fmt, formatarWhatsApp, calcDiasAtraso } from "@/utils/crmLogic";

type AbaType = "dashboard" | "propostas" | "clientes" | "contratos" | "tarefas" | "relatorios";

export default function AdminPage() {
  const router = useRouter();
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const [aba, setAba] = useState<AbaType>("dashboard");
  const [perfilAtivo, setPerfilAtivo] = useState<any>({ email: '', perfil: 'Comercial', filial: 'Matriz' });
  const [carregando, setCarregando] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  const [propostas, setPropostas] = useState<any[]>([]);
  const [clientesBase, setClientesBase] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [interacoes, setInteracoes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const [clienteDetalhe, setClienteDetalhe] = useState<any>(null);
  const [modalTarefa, setModalTarefa] = useState(false);
  const [modalEditarValor, setModalEditarValor] = useState<any>({ ativo: false, prop: null, novoValor: '' });
  const [modalEnvioProposta, setModalEnvioProposta] = useState<any>({ ativo: false, tipo: 'Email', prop: null, numeroWpp: '' });

  const isAdmin = perfilAtivo.perfil === 'Admin';
  const isComercial = perfilAtivo.perfil === 'Comercial' || isAdmin;

  const carregarTudo = useCallback(async () => {
    setCarregando(true);
    try {
      const [p, c, co, t, i, tp] = await Promise.all([
        supabase.from('propostas').select('*').order('created_at', { ascending: false }),
        supabase.from('clientes').select('*').order('nome', { ascending: true }),
        supabase.from('contratos').select('*').order('created_at', { ascending: false }),
        supabase.from('tarefas').select('*').order('data_vencimento', { ascending: true }),
        supabase.from('interacoes').select('*').order('created_at', { ascending: false }),
        supabase.from('templates').select('*')
      ]);
      setPropostas(p.data || []);
      setClientesBase(c.data || []);
      setContratos(co.data || []);
      setTarefas(t.data || []);
      setInteracoes(i.data || []);
      setTemplates(tp.data || []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("tema_ssti") || "dark";
    setTema(t as any);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      supabase.from('perfis').select('*').eq('email', session.user.email).single().then(({ data }) => {
        if (data) setPerfilAtivo(data);
        carregarTudo();
      });
    });
  }, [router, carregarTudo]);

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
    return Array.from(mapa.values());
  }, [clientesBase, propostas, interacoes]);

  const mrrAtivo = useMemo(() => contratos.filter(c => c.status === 'Ativo').reduce((acc, c) => acc + Number(c.valor_mensal), 0), [contratos]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <style>{`
        :root { --bg-main: ${tema === 'dark' ? '#080f1e' : '#f4f7f9'}; --bg-sidebar: ${tema === 'dark' ? '#050a14' : '#ffffff'}; --border-light: rgba(255,255,255,0.05); }
        .sidebar { width: 260px; position: fixed; top: 0; bottom: 0; left: 0; background: var(--bg-sidebar); border-right: 1px solid var(--border-light); z-index: 100; scrollbar-width: none; }
        .main-content { flex: 1; margin-left: 260px; padding: 40px; background: var(--bg-main); min-height: 100vh; }
        .modal-overlay { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999 !important; backdrop-filter: blur(4px); }
        .modal-content { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 30px; max-height: 90vh; overflow-y: auto; width: 95%; max-width: 800px; }
      `}</style>

      <Sidebar menuMobileAberto={menuMobileAberto} setMenuMobileAberto={setMenuMobileAberto} tema={tema} alternarTema={() => {const n=tema==='dark'?'light':'dark'; setTema(n); localStorage.setItem("tema_ssti",n);}} aba={aba} mudarAba={(a: any) => setAba(a)} isComercial={isComercial} isAdmin={isAdmin} tarefasUrgentesCount={0} router={router} abrirBuscaGlobal={()=>{}} perfilAtivo={perfilAtivo} handleLogout={()=>supabase.auth.signOut()} />

      <main className="main-content">
        <Header setMenuMobileAberto={setMenuMobileAberto} aba={aba} carregando={carregando} filtroDias={30} setFiltroDias={()=>{}} vistaPropostas="kanban" setVistaPropostas={()=>{}} carregarTudo={carregarTudo} alertasCount={0} />

        {aba === 'dashboard' && (
          <DashboardView 
            isAdmin={isAdmin} mrrAtivo={mrrAtivo} 
            taxaConversao={propostas.length > 0 ? (propostas.filter(p => p.status === 'fechada').length / propostas.length) * 100 : 0} 
            propostasFechadas={propostas.filter(p => p.status === 'fechada')}
            ticketMedio={propostas.filter(p => p.status === 'fechada').length > 0 ? (propostas.filter(p => p.status === 'fechada').reduce((a, b) => a + b.valor, 0) / propostas.filter(p => p.status === 'fechada').length) : 0}
            propostasPerdidas={propostas.filter(p => p.status === 'perdida')}
            propostasAbertas={propostas.filter(p => p.status === 'aberta' || !p.status)}
            propostasEnviadas={propostas.filter(p => p.status === 'enviada' || p.status === 'negociacao')}
            tarefasUrgentes={tarefas.filter(t => t.status !== 'Concluído')}
            mudarAba={setAba} pFiltradas={propostas}
            dadosMotivosPerda={Object.entries(propostas.filter(p => p.status === 'perdida').reduce((acc: any, p) => { const m = p.motivo_perda || "Não informado"; acc[m] = (acc[m] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value }))}
          />
        )}

        {aba === 'propostas' && (
          <PropostasView 
            vistaPropostas="kanban" propostasAbertas={propostas.filter(p => p.status === 'aberta' || !p.status)} propostasEnviadas={propostas.filter(p => p.status === 'enviada' || p.status === 'negociacao')} propostasFechadas={propostas.filter(p => p.status === 'fechada')} propostasPerdidas={propostas.filter(p => p.status === 'perdida')} pFiltradas={propostas} tarefaArrastando={null} handleDragStart={()=>{}} handleDragEnd={()=>{}} handleDragOver={()=>{}} handleDropStatus={()=>{}} 
            diasSemInteracao={() => 0} abrirModalEnvio={()=>{}} abrirNotasDaProposta={(p:any)=>setClienteDetalhe({nome:p.cliente, propostas:[p], interacoes:[]})} setModalEditarValor={(v:any)=>setModalEditarValor(v)} isAdmin={isAdmin} excluirProposta={()=>{}} visualizarProposta={()=>{}} enviando={null} alterarStatusParaGanho={()=>{}} abrirModalPerda={()=>{}} reabrirProposta={()=>{}}
          />
        )}

        {aba === 'relatorios' && <RelatoriosView clientesAgrupados={clientesAgrupados} contratos={contratos} mrrAtivo={mrrAtivo} ticketMedio={0} dadosPipelineMensal={[]} />}
        {aba === 'clientes' && <ClientesView clientesAgrupados={clientesAgrupados} setClienteDetalhe={setClienteDetalhe} />}
      </main>

      {clienteDetalhe && <ModalFichaCliente clienteDetalhe={clienteDetalhe} setClienteDetalhe={setClienteDetalhe} isComercial={isComercial} isAdmin={isAdmin} abrirNovaTarefa={() => setModalTarefa(true)} formInteracao={{tipo:'Nota', descricao:''}} setFormInteracao={()=>{}} salvarInteracao={async(e:any)=>{e.preventDefault(); carregarTudo();}} />}
    </div>
  );
}