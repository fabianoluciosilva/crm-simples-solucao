"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  PieChart, Pie, Cell, Tooltip as ChartTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line, Area, AreaChart
} from 'recharts';

// ─── COMPONENTES E LÓGICA IMPORTADOS ────────────────────────────────────────
import { MetricCard } from "@/components/MetricCard";
import { BadgeStatus } from "@/components/BadgeStatus";
import { 
  fmt, 
  formatarWhatsApp, 
  calcDiasAtraso, 
  analisarSentimento, 
  calcularChurnRisk, 
  gerarSugestaoIA 
} from "@/utils/crmLogic";

// ─── MODAIS IMPORTADOS ──────────────────────────────────────────────────────
import { ModalTarefa } from "@/components/modals/ModalTarefa";
import { ModalClienteForm } from "@/components/modals/ModalClienteForm";

// ─── TIPOS ─────────────────────────────────────────────────────────────────
interface PropostaDB {
  id: number; created_at: string; numero: string; cliente: string; contato: string;
  telefone?: string; email: string; valor: number; status: string; status_envio: string;
  filial?: string; dados: any; motivo_perda?: string; obs_perda?: string;
  cliente_id?: string; origem?: string;
}
interface TarefaDB {
  id: number; titulo: string; descricao: string; data_vencimento: string; status: string;
  usuario_email: string; lead_id?: number; proposta_id?: number; nome_referencia?: string;
  data_conclusao?: string; created_at: string; prioridade?: 'Alta' | 'Normal' | 'Baixa';
  cliente_id?: string;
}
interface ContratoDB {
  id: number; proposta_id?: number; cliente_nome: string; servicos_inclusos?: string;
  valor_mensal: number; status: string; data_inicio: string; data_fim?: string;
  motivo_cancelamento?: string; filial?: string; created_at: string;
  cliente_id?: string;
}
interface TemplateDB {
  id: number; nome: string; tipo: string; conteudo: string; created_at: string; assunto?: string;
}
interface ClienteDB {
  id: string; nome: string; email?: string; telefone?: string; whatsapp?: string;
  documento?: string; tipo: string; codigo?: string; filial?: string; created_at?: string;
  score?: number; ativo?: boolean;
}
interface InteracaoDB {
  id: number; cliente_nome: string; usuario_email: string; tipo: string;
  descricao: string; created_at: string;
  cliente_id?: string;
}
interface PerfilUsuario {
  id?: string; email: string; perfil: 'Admin' | 'Comercial' | 'Suporte'; filial: string; nome?: string;
}

type AbaType = "dashboard" | "propostas" | "clientes" | "contratos" | "tarefas" | "leads" | "templates" | "usuarios" | "relatorios";

const ADMIN_EMAIL_PRINCIPAL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'fabiano@simplessolucao.com.br';
const LIMIAR_ESFRIANDO = 5;

// ═══════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- ESTADOS GERAIS ---
  const [session, setSession] = useState<any>(null);
  const [perfilAtivo, setPerfilAtivo] = useState<PerfilUsuario>({ email: '', perfil: 'Comercial', filial: 'Matriz' });
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const [toast, setToast] = useState<{ msg: string; tipo: 'sucesso' | 'erro' | 'info' } | null>(null);
  const [buscaGlobal, setBuscaGlobal] = useState("");
  const [mostrarBuscaGlobal, setMostrarBuscaGlobal] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false); 

  const isAdmin = perfilAtivo.perfil === 'Admin';
  const isComercial = perfilAtivo.perfil === 'Comercial' || isAdmin;

  const showToast = useCallback((msg: string, tipo: 'sucesso' | 'erro' | 'info' = 'sucesso') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // --- ESTADOS DO CRM ---
  const [aba, setAba] = useState<AbaType>("dashboard");
  const [vistaPropostas, setVistaPropostas] = useState<"kanban" | "tabela">("kanban");
  const [propostas, setPropostas] = useState<PropostaDB[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<TarefaDB[]>([]);
  const [contratos, setContratos] = useState<ContratoDB[]>([]);
  const [templates, setTemplates] = useState<TemplateDB[]>([]);
  const [clientesBase, setClientesBase] = useState<ClienteDB[]>([]);
  const [interacoes, setInteracoes] = useState<InteracaoDB[]>([]);
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);

  const [carregando, setCarregando] = useState(false);
  const [filtroDias, setFiltroDias] = useState<number>(30);
  const [filtroTipoCliente, setFiltroTipoCliente] = useState<"Todos" | "Cliente" | "Lead" | "Parceiro">("Todos");
  const [buscaCliente, setBuscaCliente] = useState("");
  const debouncedBusca = useDebounce(buscaCliente, 300);
  const [mostrarDesativados, setMostrarDesativados] = useState(false);
  const [enviando, setEnviando] = useState<number | null>(null);
  const [filtroStatusTarefa, setFiltroStatusTarefa] = useState<"Todos" | "Pendente" | "Em Andamento" | "Concluído" | "Atrasado">("Todos");
  const [tarefaArrastando, setTarefaArrastando] = useState<number | null>(null);

  // --- ESTADOS DE MODAIS ---
  const [modalComunicado, setModalComunicado] = useState(false);
  const [formComunicado, setFormComunicado] = useState({ publico: "Cliente", assunto: "", mensagem: "" });
  const [progressoEmail, setProgressoEmail] = useState({ ativo: false, total: 0, enviado: 0 });
  const [filaWpp, setFilaWpp] = useState<ClienteDB[]>([]);

  const [modalEnvioProposta, setModalEnvioProposta] = useState<{ ativo: boolean; tipo: 'Email' | 'WhatsApp'; prop: PropostaDB | null; numeroWpp: string; }>({ ativo: false, tipo: 'Email', prop: null, numeroWpp: '' });
  const [formEnvioMensagem, setFormEnvioMensagem] = useState({ templateId: '', texto: '', assunto: '' });

  const [modalEditarValor, setModalEditarValor] = useState<{ativo: boolean, prop: PropostaDB | null, novoValor: string}>({ativo: false, prop: null, novoValor: ''});

  const [modalTarefa, setModalTarefa] = useState(false);
  const [formTarefa, setFormTarefa] = useState<any>({ titulo: "", descricao: "", data_vencimento: "", status: "Pendente", prioridade: "Normal" });
  
  const [modalContrato, setModalContrato] = useState(false);
  const [formContrato, setFormContrato] = useState<any>({ cliente_nome: "", valor_mensal: 0, status: "Ativo" });
  
  const [modalTemplate, setModalTemplate] = useState(false);
  const [formTemplate, setFormTemplate] = useState<any>({ nome: "", tipo: "WhatsApp", conteudo: "" });
  
  const [modalClienteForm, setModalClienteForm] = useState(false);
  const [formCliente, setFormCliente] = useState<any>({ nome: "", email: "", telefone: "", whatsapp: "", documento: "", tipo: "Cliente", codigo: "", filial: "Matriz" });

  const [modalUsuario, setModalUsuario] = useState(false);
  const [formUsuario, setFormUsuario] = useState<any>({ email: '', nome: '', perfil: 'Comercial', filial: 'Matriz' });
  const [clienteDetalhe, setClienteDetalhe] = useState<any>(null);
  const [formInteracao, setFormInteracao] = useState({ tipo: "Nota", descricao: "" });
  const [modalPerda, setModalPerda] = useState(false);
  const [formPerda, setFormPerda] = useState({ id: 0, motivo: "", obs: "" });

  // ─── ATALHO DE TECLADO: Ctrl+K para busca global ─────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setMostrarBuscaGlobal(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setMostrarBuscaGlobal(false);
        setBuscaGlobal("");
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ─── AUTENTICAÇÃO E TEMA ──────────────────────────────────────────────────
  useEffect(() => {
    const t = localStorage.getItem("tema_ssti");
    if (t === "light" || t === "dark") setTema(t);
  }, []);

  const alternarTema = () => {
    const n = tema === "dark" ? "light" : "dark";
    setTema(n);
    localStorage.setItem("tema_ssti", n);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      setSession(session);
      const emailUser = session.user.email || "";
      const { data: perfilData } = await supabase.from('perfis').select('*').eq('email', emailUser).single();
      
      let pFinal: PerfilUsuario;
      if (perfilData) {
        pFinal = { id: perfilData.id, email: emailUser, perfil: perfilData.perfil, filial: perfilData.filial, nome: perfilData.nome };
      } else {
        const isDono = emailUser === ADMIN_EMAIL_PRINCIPAL;
        pFinal = { id: session.user.id, email: emailUser, perfil: isDono ? 'Admin' : 'Comercial', filial: 'Matriz', nome: isDono ? 'Fabiano' : '' };
        await supabase.from('perfis').upsert([{ 
          id: pFinal.id, email: pFinal.email, perfil: pFinal.perfil, filial: pFinal.filial, nome: pFinal.nome
        }]);
      }
      
      setPerfilAtivo(pFinal);
      setFormTarefa(prev => ({ ...prev, usuario_email: emailUser }));
      if (pFinal.perfil === 'Admin' || pFinal.perfil === 'Comercial') setAba('dashboard');
      else setAba('tarefas');
      setCarregandoAuth(false);
    });
  }, [router]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/"); };
  const mudarAba = (novaAba: AbaType) => { setAba(novaAba); setMenuMobileAberto(false); };

  // ─── CARREGAMENTO DE DADOS ────────────────────────────────────────────────
  const carregarTudo = useCallback(async () => {
    if (!session || carregandoAuth) return;
    setCarregando(true);
    try {
      let qProp = supabase.from('propostas').select('*').order('created_at', { ascending: false });
      let qCli = supabase.from('clientes').select('*').order('nome', { ascending: true });
      let qCont = supabase.from('contratos').select('*').order('created_at', { ascending: false });
      let qTar = supabase.from('tarefas').select('*').order('data_vencimento', { ascending: true });
      let qLead = supabase.from('leads').select('*').order('created_at', { ascending: false });
      let qInt = supabase.from('interacoes').select('*').order('created_at', { ascending: false });
      let qPerf = supabase.from('perfis').select('*').order('email', { ascending: true });

      if (!isAdmin && perfilAtivo.filial !== 'Matriz') {
        qProp = qProp.eq('filial', perfilAtivo.filial);
        qCli = qCli.eq('filial', perfilAtivo.filial);
        qCont = qCont.eq('filial', perfilAtivo.filial);
      }
      if (!isAdmin) qTar = qTar.eq('usuario_email', perfilAtivo.email);

      const [p, l, t, c, tpl, cliBase, ints, perfis] = await Promise.all([
        isComercial ? qProp : Promise.resolve({ data: [] }),
        isComercial ? qLead : Promise.resolve({ data: [] }),
        qTar,
        isAdmin ? qCont : Promise.resolve({ data: [] }),
        isAdmin ? supabase.from('templates').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        qCli,
        qInt,
        isAdmin ? qPerf : Promise.resolve({ data: [] }),
      ]);

      if (p.data) setPropostas(p.data);
      if (l.data) setLeads(l.data);
      if (c.data) setContratos(c.data);
      if (tpl.data) setTemplates(tpl.data);
      if (cliBase.data) setClientesBase(cliBase.data);
      if (t.data) setTarefas(t.data);
      if (ints.data) setInteracoes(ints.data);
      if (perfis.data) {
        let listaPerfis = [...(perfis.data as PerfilUsuario[])];
        if (!listaPerfis.find(u => u.email === perfilAtivo.email)) listaPerfis.push(perfilAtivo);
        setUsuarios(listaPerfis);
      }
    } catch (err) {
      showToast("Erro ao carregar dados. Verifique a conexão.", "erro");
    } finally {
      setCarregando(false);
    }
  }, [session, carregandoAuth, perfilAtivo, isAdmin, isComercial, showToast]);

  useEffect(() => { carregarTudo(); }, [session, carregandoAuth, filtroDias, perfilAtivo.email, perfilAtivo.filial, perfilAtivo.perfil]);

  // ─── LÓGICA E CÁLCULOS ────────────────────────────────────────────────────
  const clientesDesativadosNomes = useMemo(() => clientesBase.filter(c => c.ativo === false).map(c => c.nome.toUpperCase()), [clientesBase]);
  const pFiltradas = useMemo(() => {
    let filtradas = propostas;
    if (filtroDias > 0) {
      const limite = new Date();
      limite.setDate(limite.getDate() - filtroDias);
      filtradas = filtradas.filter(p => new Date(p.created_at) >= limite);
    }
    return filtradas.filter(p => !clientesDesativadosNomes.includes(p.cliente.toUpperCase()));
  }, [propostas, filtroDias, clientesDesativadosNomes]);

  const propostasFechadas = useMemo(() => pFiltradas.filter(p => p.status === 'fechada'), [pFiltradas]);
  const propostasPerdidas = useMemo(() => pFiltradas.filter(p => p.status === 'perdida'), [pFiltradas]);
  const propostasAbertas = useMemo(() => pFiltradas.filter(p => !p.status || p.status === 'aberta'), [pFiltradas]);
  const propostasEnviadas = useMemo(() => pFiltradas.filter(p => p.status === 'enviada' || p.status === 'negociacao'), [pFiltradas]);

  const taxaConversao = pFiltradas.length > 0 ? (propostasFechadas.length / pFiltradas.length) * 100 : 0;
  const mrrAtivo = useMemo(() => contratos.filter(c => c.status === 'Ativo' && !clientesDesativadosNomes.includes(c.cliente_nome.toUpperCase())).reduce((acc, c) => acc + Number(c.valor_mensal), 0), [contratos, clientesDesativadosNomes]);
  const ticketMedio = propostasFechadas.length > 0 ? propostasFechadas.reduce((a, b) => a + b.valor, 0) / propostasFechadas.length : 0;

  const dadosMotivosPerda = useMemo(() => {
    const contagem: Record<string, number> = {};
    propostasPerdidas.forEach(p => { const m = p.motivo_perda || "Não informado"; contagem[m] = (contagem[m] || 0) + 1; });
    return Object.entries(contagem).map(([name, value]) => ({ name, value }));
  }, [propostasPerdidas]);

  const dadosPipelineMensal = useMemo(() => {
    const meses: Record<string, { ganhas: number; perdidas: number; abertas: number }> = {};
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

  const diasSemInteracao = useCallback((prop: PropostaDB): number => {
    if (prop.status === 'fechada' || prop.status === 'perdida') return 0;
    const intsCliente = interacoes.filter(i => prop.cliente_id ? i.cliente_id === prop.cliente_id : i.cliente_nome.toUpperCase() === prop.cliente.trim().toUpperCase());
    const dataRef = intsCliente.length > 0 ? new Date(intsCliente[0].created_at) : new Date(prop.created_at);
    return Math.floor((Date.now() - dataRef.getTime()) / (1000 * 60 * 60 * 24));
  }, [interacoes]);

  const tarefasComAtraso = useMemo(() => tarefas.map(t => {
      if (t.status !== 'Concluído' && calcDiasAtraso(t.data_vencimento) > 0) return { ...t, status: 'Atrasado' as string };
      return t;
    }), [tarefas]);

  const tarefasFiltradas = useMemo(() => {
    if (filtroStatusTarefa === "Todos") return tarefasComAtraso;
    return tarefasComAtraso.filter(t => t.status === filtroStatusTarefa);
  }, [tarefasComAtraso, filtroStatusTarefa]);

  const tarefasUrgentes = useMemo(() => tarefasComAtraso.filter(t => {
      if (t.status === 'Concluído') return false;
      return calcDiasAtraso(t.data_vencimento) >= -2;
    }), [tarefasComAtraso]);

  const COLORS_PIE = ['#f87171', '#f59e0b', '#4A90D9', '#a855f7', '#64748b'];

  const clientesAgrupados = useMemo(() => {
    const mapa = new Map<string, any>();
    clientesBase.forEach(c => mapa.set(`ID_${c.id}`, { ...c, isOficial: true, propostas: [], contratos: [], tarefas: [], interacoes: [] }));
    const getChaveCliente = (id?: string | number, nomeRef?: string) => {
      if (id) return `ID_${id}`;
      if (nomeRef) {
        const oficial = clientesBase.find(c => c.nome.trim().toUpperCase() === nomeRef.trim().toUpperCase());
        if (oficial) return `ID_${oficial.id}`;
        return `NAME_${nomeRef.trim().toUpperCase()}`;
      }
      return `UNKNOWN`;
    };
    interacoes.forEach(i => {
      const key = getChaveCliente(i.cliente_id, i.cliente_nome);
      if (!mapa.has(key)) mapa.set(key, { nome: i.cliente_nome, tipo: 'Lead', score: 0, isOficial: false, ativo: true, propostas: [], contratos: [], tarefas: [], interacoes: [] });
      mapa.get(key).interacoes.push(i);
    });
    propostas.forEach(p => {
      const key = getChaveCliente(p.cliente_id, p.cliente);
      if (!mapa.has(key)) mapa.set(key, { nome: p.cliente, email: p.email, contato: p.contato, telefone: p.telefone, tipo: 'Lead', score: 0, isOficial: false, ativo: true, propostas: [], contratos: [], tarefas: [], interacoes: [] });
      mapa.get(key).propostas.push(p);
    });
    contratos.forEach(c => {
      const key = getChaveCliente(c.cliente_id, c.cliente_nome);
      if (!mapa.has(key)) mapa.set(key, { nome: c.cliente_nome, tipo: 'Cliente', score: 0, isOficial: false, ativo: true, propostas: [], contratos: [], tarefas: [], interacoes: [] });
      mapa.get(key).contratos.push(c);
      if (mapa.get(key).tipo === 'Lead') mapa.get(key).tipo = 'Cliente';
    });
    leads.forEach(l => {
      const key = `NAME_${l.empresa.trim().toUpperCase()}`; 
      if (!mapa.has(key)) mapa.set(key, { id_lead: l.id, nome: l.empresa, email: l.email, contato: l.nome, telefone: l.telefone, tipo: 'Lead', score: 0, isOficial: false, ativo: true, propostas: [], contratos: [], tarefas: [], interacoes: [] });
    });
    tarefas.forEach(t => {
      if (t.nome_referencia || t.cliente_id) {
        const key = getChaveCliente(t.cliente_id, t.nome_referencia);
        if (mapa.has(key)) mapa.get(key).tarefas.push(t);
      }
    });

    let lista = Array.from(mapa.values()).sort((a, b) => (b.score || 0) - (a.score || 0) || a.nome.localeCompare(b.nome));
    if (!mostrarDesativados) lista = lista.filter(c => c.ativo !== false);
    if (filtroTipoCliente !== "Todos") lista = lista.filter(c => c.tipo === filtroTipoCliente);
    if (debouncedBusca) {
      const b = debouncedBusca.toLowerCase();
      lista = lista.filter(c => c.nome?.toLowerCase().includes(b) || c.email?.toLowerCase().includes(b) || c.contato?.toLowerCase().includes(b) || c.codigo?.toLowerCase().includes(b));
    }
    return lista;
  }, [propostas, contratos, tarefas, clientesBase, leads, filtroTipoCliente, debouncedBusca, interacoes, mostrarDesativados]);

  const resultadosBuscaGlobal = useMemo(() => {
    if (!buscaGlobal || buscaGlobal.length < 2) return { clientes: [], propostas: [], tarefas: [] };
    const b = buscaGlobal.toLowerCase();
    return {
      clientes: clientesAgrupados.filter(c => c.nome?.toLowerCase().includes(b)).slice(0, 5),
      propostas: propostas.filter(p => p.cliente?.toLowerCase().includes(b) || p.numero?.toLowerCase().includes(b)).slice(0, 5),
      tarefas: tarefas.filter(t => t.titulo?.toLowerCase().includes(b) || t.nome_referencia?.toLowerCase().includes(b)).slice(0, 5),
    };
  }, [buscaGlobal, clientesAgrupados, propostas, tarefas]);

  // ─── AÇÕES DE CLIENTES ────────────────────────────────────────────────────
  const alternarStatusCliente = async (cliente: any) => {
    const novoStatus = cliente.ativo === false ? true : false;
    try {
      if (cliente.isOficial) {
        const { error } = await supabase.from('clientes').update({ ativo: novoStatus }).eq('id', cliente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clientes').insert([{
          nome: cliente.nome, email: cliente.email, telefone: cliente.telefone,
          whatsapp: cliente.whatsapp, tipo: cliente.tipo, filial: perfilAtivo.filial, ativo: novoStatus
        }]);
        if (error) throw error;
      }
      showToast(`Registo ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`, "sucesso");
      carregarTudo();
    } catch (e: any) {
      showToast("Erro ao alterar status: " + e.message, "erro");
    }
  };

  const abrirNotasDaProposta = (prop: PropostaDB) => {
    const cliente = clientesAgrupados.find(c => prop.cliente_id ? c.id === prop.cliente_id : c.nome.toUpperCase() === prop.cliente.trim().toUpperCase());
    if (cliente) setClienteDetalhe(cliente);
    else showToast("Erro ao abrir a ficha do cliente.", "erro");
  };

  // ─── COMUNICADOS EM MASSA ─────────────────────────────────────────────────
  const dispararEmailsMassa = async () => {
    let alvos = formComunicado.publico === "Todos" ? clientesBase : clientesBase.filter(c => c.tipo === formComunicado.publico);
    alvos = alvos.filter(c => c.email && c.email.includes("@") && c.ativo !== false);
    if (alvos.length === 0) return showToast("Nenhum e-mail válido/ativo encontrado.", "erro");
    if (!confirm(`Deseja disparar este e-mail para ${alvos.length} contactos?`)) return;

    setProgressoEmail({ ativo: true, total: alvos.length, enviado: 0 });
    let enviados = 0;
    for (const cli of alvos) {
      try {
        const trackingPixel = `<img src="${window.location.origin}/api/track?action=open&id=${cli.id}" width="1" height="1" style="display:none;" />`;
        const htmlCorpo = `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;"><div style="background: #0a1628; padding: 20px; text-align: center; color: #fff;"><h2 style="margin: 0;">Aviso Importante</h2></div><div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none;"><p>Olá <strong>${cli.nome}</strong>,</p><div style="white-space: pre-wrap; font-size: 15px; margin: 20px 0;">${formComunicado.mensagem}</div><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" /><p style="font-size: 13px; color: #666;">Atenciosamente,<br/><strong>Equipa | Simples Solução TI</strong></p></div>${trackingPixel}</div>`;
        await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: cli.email, subject: formComunicado.assunto, html: htmlCorpo }) });
        enviados++;
        setProgressoEmail(p => ({ ...p, enviado: enviados }));
        await new Promise(r => setTimeout(r, 500));
      } catch {}
    }
    setProgressoEmail({ ativo: false, total: 0, enviado: 0 });
    setModalComunicado(false);
    showToast(`Disparo concluído! ${enviados} e-mails enviados.`, "sucesso");
  };

  const gerarFilaWhatsapp = () => {
    let alvos = formComunicado.publico === "Todos" ? clientesBase : clientesBase.filter(c => c.tipo === formComunicado.publico);
    alvos = alvos.filter(c => (c.whatsapp || c.telefone) && c.ativo !== false);
    if (alvos.length === 0) return showToast("Nenhum cliente ativo com número válido.", "erro");
    setFilaWpp(alvos);
    setModalComunicado(false);
    showToast(`Fila gerada com ${alvos.length} clientes.`, "info");
  };

  const enviarWhatsAppDaFila = (cli: ClienteDB) => {
    const numero = formatarWhatsApp(cli.whatsapp || cli.telefone);
    if (!numero || numero.length < 10) return showToast(`Número inválido para ${cli.nome}`, "erro");
    const texto = `Olá *${cli.nome}*,\n\n*Aviso SSTI:*\n${formComunicado.mensagem}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank');
    setFilaWpp(prev => prev.filter(c => c.id !== cli.id));
  };

  // ─── GERADOR DE PROPOSTA ──────────────────────────────────────────────────
  const processarTemplate = (conteudo: string, nome: string, empresa: string, valor: number) => {
    if (!conteudo) return "";
    return conteudo.replace(/\{\{nome\}\}/g, nome || "Cliente").replace(/\{\{empresa\}\}/g, empresa || "Empresa").replace(/\{\{valor\}\}/g, fmt(valor));
  };

  const gerarHtmlProposta = (prop: PropostaDB) => {
    const dataFormatada = new Date(prop.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' });
    const obs = prop.dados?.obs || "";
    return `<div style="font-family: Arial, sans-serif; color: #333; padding: 40px; font-size: 14px; line-height: 1.6; max-width: 800px; margin: 0 auto; background: #fff;"><div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 50px;"><div><h2 style="margin: 0; color: #0a1628; font-size: 26px;">Simples Solução TI</h2></div><div style="text-align: right; font-size: 12px; color: #666;"><strong>Proposta:</strong> ${prop.numero}<br><strong>Data:</strong> ${dataFormatada}<br><strong>Empresa:</strong> ${prop.cliente}</div></div><h1 style="color: #0a1628; font-size: 24px; border-bottom: 2px solid #4A90D9; padding-bottom: 10px; margin-bottom: 20px;">PROPOSTA DE SERVIÇOS TÉCNICOS</h1><p>Rio de Janeiro, ${dataFormatada}</p><p>Prezada(o) <strong>${prop.contato || 'Cliente'}</strong>,</p><p>Agradecemos a oportunidade de apresentar a nossa empresa e discutir possíveis caminhos para o futuro da <strong>${prop.cliente}</strong>.</p><p>Este documento tem como objetivo definir o escopo de trabalho a ser empregado na prestação de serviço de suporte de informática à <strong>${prop.cliente}</strong>.</p><div style="margin-top: 40px; margin-bottom: 40px; font-weight: bold;">Fabiano Lucio<br><span style="font-weight: normal; font-size: 13px; color: #555;">Diretor Comercial<br>(21) 3529-7993<br>fabiano@simplessolucao.com.br<br>www.simplessolucao.com.br</span></div><h2 style="color: #4A90D9; font-size: 20px; margin-top: 30px; margin-bottom: 15px;">Proposta Comercial</h2><table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; font-size: 14px;"><tr><th style="background: #0a1628; color: #fff; padding: 12px; text-align: left;">Descrição do Serviço</th><th style="background: #0a1628; color: #fff; padding: 12px; text-align: right; width: 200px;">Valor Mensal</th></tr><tr><td style="padding: 20px 12px; font-size: 16px; font-weight: bold; background: #f8f9fa; border-top: 2px solid #0a1628; border-bottom: 2px solid #0a1628;">Manutenção de TI</td><td style="text-align: right; color: #4A90D9; padding: 20px 12px; font-size: 16px; font-weight: bold; background: #f8f9fa; border-top: 2px solid #0a1628; border-bottom: 2px solid #0a1628;">${fmt(prop.valor)}</td></tr></table>${obs ? `<h3 style="color: #0a1628; font-size: 16px; margin-top: 25px;">Observações Adicionais</h3><p style="background: #f8f9fa; padding: 15px; border-left: 4px solid #4A90D9;">${obs.replace(/\n/g, '<br>')}</p>` : ""}</div>`;
  };

  const abrirModalEnvio = (prop: PropostaDB, tipo: 'Email' | 'WhatsApp') => {
    let foneParaTentar = prop.telefone || "";
    const cb = prop.cliente_id ? clientesBase.find(c => c.id === prop.cliente_id) : clientesBase.find(c => c.nome.toUpperCase() === prop.cliente.trim().toUpperCase());
    if (cb) foneParaTentar = foneParaTentar || cb.whatsapp || cb.telefone || "";
    setModalEnvioProposta({ ativo: true, tipo, prop, numeroWpp: formatarWhatsApp(foneParaTentar) });
    setFormEnvioMensagem({ templateId: '', texto: '', assunto: '' });
  };

  useEffect(() => {
    if (modalEnvioProposta.prop && formEnvioMensagem.templateId) {
      if (formEnvioMensagem.templateId === 'custom') {
        setFormEnvioMensagem(prev => ({ ...prev, texto: '', assunto: '' }));
      } else {
        const tpl = templates.find(t => t.id.toString() === formEnvioMensagem.templateId);
        if (tpl) {
          const txt = processarTemplate(tpl.conteudo, modalEnvioProposta.prop!.contato, modalEnvioProposta.prop!.cliente, modalEnvioProposta.prop!.valor);
          const ass = tpl.assunto ? processarTemplate(tpl.assunto, modalEnvioProposta.prop!.contato, modalEnvioProposta.prop!.cliente, modalEnvioProposta.prop!.valor) : '';
          setFormEnvioMensagem(prev => ({ ...prev, texto: txt, assunto: ass }));
        }
      }
    }
  }, [formEnvioMensagem.templateId, modalEnvioProposta.prop, templates]);

  const confirmarEnvioMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    const { tipo, prop } = modalEnvioProposta;
    if (!prop) return;
    const textoFinal = formEnvioMensagem.texto;
    if (!textoFinal.trim()) return showToast("A mensagem não pode estar vazia.", "erro");
    setEnviando(prop.id);
    try {
      if (tipo === 'Email') {
        if (!prop.email) return showToast("E-mail não registado nesta proposta.", "erro");
        showToast("A processar PDF e enviar e-mail...", "info");
        let pdfBase64 = "";
        try {
          if (!(window as any).html2pdf) {
            await new Promise((resolve) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'; s.onload = resolve; document.body.appendChild(s); });
          }
          const el = document.createElement('div'); el.innerHTML = gerarHtmlProposta(prop);
          const uri = await (window as any).html2pdf().set({ margin: 10, filename: `Proposta.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(el).outputPdf('datauristring');
          pdfBase64 = uri.split(',')[1];
        } catch {}
        let trackingPixel = '';
        if (prop.cliente_id) trackingPixel = `<img src="${window.location.origin}/api/track?action=open&id=${prop.cliente_id}" width="1" height="1" style="display:none;" />`;
        let corpoEmail = `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">${textoFinal.replace(/\n/g, '<br/>')}</div>${trackingPixel}`;
        const assuntoEmail = formEnvioMensagem.assunto || `Proposta Comercial SSTI - ${prop.cliente}`;
        const res = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: prop.email, subject: assuntoEmail, html: corpoEmail, fileName: `Proposta_SSTI.pdf`, pdfBase64 }) });
        if (res.ok) {
          await supabase.from('propostas').update({ status_envio: 'enviado', status: prop.status === 'aberta' || !prop.status ? 'enviada' : prop.status }).eq('id', prop.id);
          await supabase.from('interacoes').insert([{ cliente_id: prop.cliente_id, cliente_nome: prop.cliente, usuario_email: perfilAtivo.email, tipo: 'Email', descricao: `Assunto: ${assuntoEmail}\n\n${textoFinal}` }]);
          showToast("E-mail enviado e registado no histórico!", "sucesso");
        } else { showToast("Erro ao enviar e-mail.", "erro"); return; }
      } else if (tipo === 'WhatsApp') {
        const numeroLimpo = modalEnvioProposta.numeroWpp.replace(/\D/g, "");
        if (!numeroLimpo || numeroLimpo.length < 10) return showToast("Digite um número válido com DDD e código do país.", "erro");
        window.open(`https://wa.me/${numeroLimpo}?text=${encodeURIComponent(textoFinal)}`, '_blank');
        await supabase.from('interacoes').insert([{ cliente_id: prop.cliente_id, cliente_nome: prop.cliente, usuario_email: perfilAtivo.email, tipo: 'WhatsApp', descricao: `Enviado para (${numeroLimpo}):\n\n${textoFinal}` }]);
        showToast("WhatsApp aberto e registado no histórico!", "sucesso");
      }
      setModalEnvioProposta({ ativo: false, tipo: 'Email', prop: null, numeroWpp: '' });
      carregarTudo();
    } catch { showToast("Erro de conexão.", "erro"); } finally { setEnviando(null); }
  };

  const visualizarProposta = (prop: PropostaDB) => {
    const h = gerarHtmlProposta(prop);
    const w = window.open("", "_blank")!;
    w.document.write(`<html><body>${h}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  // ─── KANBAN DRAG & DROP ────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, prop: PropostaDB) => { e.dataTransfer.setData("propId", prop.id.toString()); setTarefaArrastando(prop.id); };
  const handleDragEnd = () => setTarefaArrastando(null);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDropStatus = async (e: React.DragEvent, novoStatus: string) => {
    e.preventDefault(); setTarefaArrastando(null);
    const propId = Number(e.dataTransfer.getData("propId"));
    const prop = propostas.find(p => p.id === propId);
    if (!prop || prop.status === novoStatus) return;
    if (novoStatus === 'fechada') alterarStatusParaGanho(prop);
    else if (novoStatus === 'perdida') abrirModalPerda(prop);
    else {
      await supabase.from('propostas').update({ status: novoStatus }).eq('id', prop.id);
      showToast(`Proposta movida para ${novoStatus.toUpperCase()}`, "info");
      carregarTudo();
    }
  };

  // ─── AÇÕES DE STATUS DE PROPOSTA ──────────────────────────────────────────
  const alterarStatusParaGanho = async (prop: PropostaDB) => {
    await supabase.from('propostas').update({ status: 'fechada' }).eq('id', prop.id);
    try {
      let finalClienteId = prop.cliente_id;
      if (!finalClienteId) {
        const cEx = clientesBase.find(c => c.nome.toUpperCase() === prop.cliente.trim().toUpperCase());
        if (cEx) {
           finalClienteId = cEx.id;
           if (cEx.tipo === 'Lead') await supabase.from('clientes').update({ tipo: 'Cliente' }).eq('id', cEx.id);
        } else {
           const { data: newCli } = await supabase.from('clientes').insert([{ nome: prop.cliente, email: prop.email, telefone: prop.telefone, tipo: 'Cliente', filial: prop.filial || perfilAtivo.filial }]).select().single();
           finalClienteId = newCli?.id;
           if (finalClienteId) await supabase.from('propostas').update({ cliente_id: finalClienteId }).eq('id', prop.id);
        }
      }
      await supabase.from('contratos').insert([{ proposta_id: prop.id, cliente_id: finalClienteId, cliente_nome: prop.cliente, valor_mensal: prop.valor, status: 'Ativo', data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: 'Gerado automaticamente', filial: prop.filial || perfilAtivo.filial }]);
      await supabase.from('tarefas').insert([{ titulo: `🚀 Onboarding: ${prop.cliente}`, descricao: `Novo cliente fechado! Realizar ativação e configuração inicial.`, data_vencimento: new Date().toISOString(), status: 'Pendente', usuario_email: session?.user?.email, cliente_id: finalClienteId, nome_referencia: prop.cliente, proposta_id: prop.id }]);
      showToast("🎉 Negócio Fechado! Contrato e Onboarding ativados.", "sucesso");
    } catch {}
    carregarTudo();
  };

  const salvarNovoValorProposta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditarValor.prop) return;
    const valorNumerico = Number(modalEditarValor.novoValor.toString().replace(',', '.'));
    if (isNaN(valorNumerico) || valorNumerico <= 0) return showToast("Valor inválido.", "erro");
    const { error } = await supabase.from('propostas').update({ valor: valorNumerico }).eq('id', modalEditarValor.prop.id);
    if (error) return showToast("Erro ao actualizar valor: " + error.message, "erro");
    showToast("Valor atualizado com sucesso!", "sucesso");
    setModalEditarValor({ ativo: false, prop: null, novoValor: '' });
    carregarTudo();
  };

  const abrirModalPerda = (prop: PropostaDB) => { setFormPerda({ id: prop.id, motivo: "", obs: "" }); setModalPerda(true); };
  const confirmarPerda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPerda.motivo) return showToast("Selecione um motivo.", "erro");
    await supabase.from('propostas').update({ status: 'perdida', motivo_perda: formPerda.motivo, obs_perda: formPerda.obs }).eq('id', formPerda.id);
    showToast("Proposta marcada como perdida.", "info");
    setModalPerda(false);
    carregarTudo();
  };
  const excluirProposta = async (id: number, nome: string) => {
    if (confirm(`Excluir permanentemente a proposta de ${nome}?`)) {
      const { error } = await supabase.from('propostas').delete().eq('id', id);
      if (error) return showToast("Erro ao excluir proposta: " + error.message, "erro");
      showToast("Proposta excluída.", "info");
      carregarTudo();
    }
  };

  // ─── SALVAR INTERACAO COM SENTIMENTO E CHURN RISK ────────────────────────
  const salvarInteracao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteDetalhe || !formInteracao.descricao?.trim()) return;

    const analise = analisarSentimento(formInteracao.descricao);
    const novaInteracao = { cliente_id: clienteDetalhe.id, cliente_nome: clienteDetalhe.nome, usuario_email: perfilAtivo.email, tipo: formInteracao.tipo, descricao: formInteracao.descricao };

    const { data, error } = await supabase.from('interacoes').insert([novaInteracao]).select().single();
    if (error) return showToast("Erro ao salvar interação: " + error.message, "erro");

    const scoreAtual = clienteDetalhe.score || 50;
    const novoScore = Math.max(0, Math.min(100, scoreAtual + analise.deltaScore));
    
    if (clienteDetalhe.isOficial && clienteDetalhe.id) {
      await supabase.from('clientes').update({ score: novoScore }).eq('id', clienteDetalhe.id);
    }

    setClienteDetalhe((prev: any) => ({ ...prev, score: novoScore, interacoes: [{ ...novaInteracao, id: data?.id, created_at: new Date().toISOString() }, ...prev.interacoes] }));
    setFormInteracao({ tipo: "Nota", descricao: "" });
    showToast(`${analise.emoji} Interação salva! Score: ${novoScore} (${analise.label})`, "sucesso");
    carregarTudo();
  };

  // ─── CRUD CLIENTES ────────────────────────────────────────────────────────
  const salvarClienteBase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formCliente.id) {
      const { error } = await supabase.from('clientes').update({ nome: formCliente.nome, email: formCliente.email, telefone: formCliente.telefone, whatsapp: formCliente.whatsapp, documento: formCliente.documento, tipo: formCliente.tipo, codigo: formCliente.codigo, filial: formCliente.filial }).eq('id', formCliente.id);
      if (error) return showToast("Erro ao actualizar registo: " + error.message, "erro");
    } else {
      const { error } = await supabase.from('clientes').insert([{ nome: formCliente.nome, email: formCliente.email, telefone: formCliente.telefone, whatsapp: formCliente.whatsapp, documento: formCliente.documento, tipo: formCliente.tipo, codigo: formCliente.codigo, filial: formCliente.filial || perfilAtivo.filial }]);
      if (error) return showToast("Erro ao criar registo: " + error.message, "erro");
    }
    showToast("Registo guardado.", "sucesso");
    setModalClienteForm(false);
    carregarTudo();
  };

  // ─── CRUD CONTRATOS ───────────────────────────────────────────────────────
  const abrirNovoContrato = (prop?: PropostaDB) => {
    if (prop) setFormContrato({ proposta_id: prop.id, cliente_id: prop.cliente_id, cliente_nome: prop.cliente, valor_mensal: prop.valor, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: `Proposta ${prop.numero}`, motivo_cancelamento: "" });
    else setFormContrato({ cliente_nome: "", valor_mensal: 0, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: "", motivo_cancelamento: "" });
    setModalContrato(true);
  };
  const editarContrato = (c: ContratoDB) => { setFormContrato({ ...c }); setModalContrato(true); };
  const salvarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formContrato.status === 'Cancelado' && !formContrato.motivo_cancelamento) return showToast("Motivo do cancelamento é obrigatório.", "erro");
    const payload = { ...formContrato, filial: formContrato.filial || perfilAtivo.filial, updated_at: new Date().toISOString() };
    if (formContrato.id) {
      const { error } = await supabase.from('contratos').update(payload).eq('id', formContrato.id);
      if (error) return showToast("Erro ao actualizar contrato: " + error.message, "erro");
      showToast("Contrato atualizado.", "sucesso");
    } else {
      const { error } = await supabase.from('contratos').insert([payload]);
      if (error) return showToast("Erro ao criar contrato: " + error.message, "erro");
      showToast("Novo contrato ativado.", "sucesso");
    }
    setModalContrato(false);
    carregarTudo();
  };

  // ─── CRUD TAREFAS ─────────────────────────────────────────────────────────
  const salvarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formTarefa, updated_at: new Date().toISOString() };
    if (formTarefa.id) {
      const { error } = await supabase.from('tarefas').update(payload).eq('id', formTarefa.id);
      if (error) return showToast("Erro ao actualizar tarefa: " + error.message, "erro");
    } else {
      const { error } = await supabase.from('tarefas').insert([payload]);
      if (error) return showToast("Erro ao criar tarefa: " + error.message, "erro");
    }
    showToast("Tarefa gravada.", "sucesso");
    setModalTarefa(false);
    carregarTudo();
  };
  const excluirTarefa = async (id: number) => {
    if (confirm("Excluir esta tarefa?")) {
      const { error } = await supabase.from('tarefas').delete().eq('id', id);
      if (error) return showToast("Erro ao excluir tarefa: " + error.message, "erro");
      showToast("Tarefa apagada.", "info");
      carregarTudo();
    }
  };
  const alterarStatusTarefaRapido = async (id: number, novoStatus: string) => {
    const { error } = await supabase.from('tarefas').update({ status: novoStatus, data_conclusao: novoStatus === 'Concluído' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return showToast("Erro ao actualizar status: " + error.message, "erro");
    showToast(`Tarefa marcada como ${novoStatus}.`, "sucesso");
    carregarTudo();
  };

  // ─── CRUD TEMPLATES ───────────────────────────────────────────────────────
  const salvarTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formTemplate.id) {
      const { error } = await supabase.from('templates').update(formTemplate).eq('id', formTemplate.id);
      if (error) return showToast("Erro ao actualizar template: " + error.message, "erro");
    } else {
      const { error } = await supabase.from('templates').insert([formTemplate]);
      if (error) return showToast("Erro ao criar template: " + error.message, "erro");
    }
    showToast("Template salvo.", "sucesso");
    setModalTemplate(false);
    carregarTudo();
  };
  const excluirTemplate = async (id: number) => {
    if (confirm("Excluir este template?")) {
      const { error } = await supabase.from('templates').delete().eq('id', id);
      if (error) return showToast("Erro ao excluir template: " + error.message, "erro");
      showToast("Template excluído.", "info");
      carregarTudo();
    }
  };

  // ─── CRUD USUÁRIOS ────────────────────────────────────────────────────────
  const salvarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailTratado = formUsuario.email?.toLowerCase().trim() || '';
    if (formUsuario.id) {
      const { error } = await supabase.from('perfis').upsert([{ id: formUsuario.id, email: emailTratado, perfil: formUsuario.perfil, filial: formUsuario.filial, nome: formUsuario.nome }]);
      if (error) return showToast("Erro ao atualizar: " + error.message, "erro");
      showToast("Permissões atualizadas!", "sucesso");
      setModalUsuario(false);
      carregarTudo();
    } else {
      showToast("A criar utilizador...", "info");
      const res = await fetch('/api/criar-usuario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailTratado, senha: formUsuario.senha, perfil: formUsuario.perfil, filial: formUsuario.filial, nome: formUsuario.nome }) });
      if (!res.ok) { const errData = await res.json(); return showToast(`Erro: ${errData.error}`, "erro"); }
      showToast("Utilizador cadastrado com sucesso!", "sucesso");
      setModalUsuario(false);
      carregarTudo();
    }
  };

  const excluirUsuario = async (id?: string, email?: string) => {
    if (!id) return;
    if (email === session?.user?.email) return showToast("Não pode excluir o seu próprio utilizador.", "erro");
    if (confirm(`Remover acesso de ${email}?`)) {
      const { error } = await supabase.from('perfis').delete().eq('id', id);
      if (error) return showToast("Erro ao remover acesso: " + error.message, "erro");
      showToast("Acesso removido.", "info");
      carregarTudo();
    }
  };

  // ─── GUARD DE AUTENTICAÇÃO ────────────────────────────────────────────────
  if (carregandoAuth) return (
    <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, color: "#4A90D9" }}>
      <div style={{ width: 40, height: 40, border: "3px solid #4A90D9", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div>A validar permissões...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <style>{`
        :root {
          --bg-main: ${tema === 'dark' ? '#080f1e' : '#f4f7f9'};
          --bg-sidebar: ${tema === 'dark' ? '#050a14' : '#ffffff'};
          --bg-card: ${tema === 'dark' ? 'rgba(255,255,255,0.02)' : '#ffffff'};
          --text-primary: ${tema === 'dark' ? '#ffffff' : '#0f172a'};
          --text-secondary: ${tema === 'dark' ? 'rgba(255,255,255,0.5)' : '#64748b'};
          --text-tertiary: ${tema === 'dark' ? 'rgba(255,255,255,0.3)' : '#94a3b8'};
          --border-light: ${tema === 'dark' ? 'rgba(255,255,255,0.05)' : '#e2e8f0'};
          --shadow: ${tema === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.08)'};
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg-main); color: var(--text-primary); font-family: 'Outfit', sans-serif; overflow-x: hidden; }
        .sidebar::-webkit-scrollbar, .nav-menu::-webkit-scrollbar { display: none; }
        .sidebar, .nav-menu { -ms-overflow-style: none; scrollbar-width: none; }
        .sidebar { width: 260px; position: fixed; top: 0; bottom: 0; left: 0; z-index: 100; transition: transform 0.3s ease; background: var(--bg-sidebar); overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; border-right: 1px solid var(--border-light); }
        .main-content { flex: 1; margin-left: 260px; padding: 40px; width: calc(100% - 260px); min-height: 100vh; }
        .nav-menu { padding: 20px; flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; color: var(--text-secondary); cursor: pointer; border: none; background: transparent; font-weight: 600; width: 100%; text-align: left; font-size: 13px; transition: all 0.15s; }
        .nav-item:hover { background: rgba(74,144,217,0.07); color: var(--text-primary); }
        .nav-item.active { background: rgba(74,144,217,0.12); color: #4A90D9; }
        .metric-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 20px; transition: box-shadow 0.2s; }
        .table-wrapper { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; overflow-x: auto; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(0,0,0,0.1); padding: 14px 16px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); text-align: left; }
        td { padding: 14px 16px; border-bottom: 1px solid var(--border-light); font-size: 14px; }
        .badge-status { padding: 3px 9px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .btn-action { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--border-light); background: rgba(255,255,255,0.04); color: var(--text-primary); margin-right: 4px; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
        .modal-content { background: var(--bg-sidebar); padding: 30px; border-radius: 20px; width: 100%; max-width: 550px; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border-light); }
        .input-modal { width: 100%; background: var(--bg-main); border: 1px solid var(--border-light); color: var(--text-primary); padding: 11px 14px; border-radius: 8px; font-size: 14px; }
        .kanban-board { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 20px; }
        .kanban-col { flex: 1; min-width: 260px; max-width: 320px; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 14px; display: flex; flex-direction: column; }
        .kanban-card { background: var(--bg-main); border: 1px solid var(--border-light); border-radius: 10px; padding: 14px; cursor: grab; }
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); z-index: 1000; box-shadow: 5px 0 25px rgba(0,0,0,0.5); }
          .sidebar.open { transform: translateX(0); }
          .main-content { margin-left: 0; padding: 15px; width: 100%; }
        }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div className="toast" style={{ position: "fixed", bottom: 30, right: 30, padding: 14, borderRadius: 12, color: "#fff", background: toast.tipo === 'sucesso' ? '#22c55e' : '#f87171', zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}

      {/* OVERLAY PARA MENU MOBILE */}
      <div className={`mobile-overlay ${menuMobileAberto ? 'open' : ''}`} onClick={() => setMenuMobileAberto(false)}></div>

      {/* SIDEBAR */}
      <aside className={`sidebar ${menuMobileAberto ? 'open' : ''}`}>
        <button className="close-menu-btn" style={{ display: "none" }} onClick={() => setMenuMobileAberto(false)}>✕</button>
        <div style={{ padding: "24px 20px", textAlign: "center", borderBottom: "1px solid var(--border-light)" }}>
          <img src={tema === 'dark' ? '/Logo-negativo.webp' : '/logo-ssti.webp'} style={{ maxHeight: "36px", borderRadius: "8px" }} alt="SSTI" />
        </div>
        <nav className="nav-menu">
          {isComercial && <button className={`nav-item ${aba === 'dashboard' ? 'active' : ''}`} onClick={() => mudarAba('dashboard')}>📈 Dashboard</button>}
          {isComercial && <button className={`nav-item ${aba === 'propostas' ? 'active' : ''}`} onClick={() => mudarAba('propostas')}>🎯 Funil de Vendas</button>}
          <button className={`nav-item ${aba === 'clientes' ? 'active' : ''}`} onClick={() => mudarAba('clientes')}>👥 Base de Clientes</button>
          {isAdmin && <button className={`nav-item ${aba === 'contratos' ? 'active' : ''}`} onClick={() => mudarAba('contratos')}>📄 Financeiro (MRR)</button>}
          <button className={`nav-item ${aba === 'tarefas' ? 'active' : ''}`} onClick={() => mudarAba('tarefas')}>✅ Tarefas {tarefasUrgentes.length > 0 && <span className="notificacao-badge" style={{ background: "#f87171", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: 10 }}>{tarefasUrgentes.length}</span>}</button>
          {isAdmin && <button className={`nav-item ${aba === 'relatorios' ? 'active' : ''}`} onClick={() => mudarAba('relatorios')}>📊 Relatórios</button>}
          {isAdmin && <button className={`nav-item ${aba === 'templates' ? 'active' : ''}`} onClick={() => mudarAba('templates')}>📝 Templates</button>}
          {isAdmin && <button className={`nav-item ${aba === 'usuarios' ? 'active' : ''}`} onClick={() => mudarAba('usuarios')}>🔐 Usuários</button>}
        </nav>
        <div style={{ padding: "20px", borderTop: "1px solid var(--border-light)" }}>
          <button onClick={alternarTema} className="btn-action" style={{ width: "100%", marginBottom: 10 }}>{tema === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}</button>
          <button onClick={handleLogout} className="btn-action" style={{ width: "100%", color: "#f87171" }}>Sair</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main-content">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 800 }}>{aba.toUpperCase()}</h1>
          <button onClick={carregarTudo} className="btn-action">🔄 Sincronizar</button>
        </header>

        {/* ─── DASHBOARD ─── */}
        {aba === 'dashboard' && isComercial && (
          <div className="grid-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <MetricCard label="MRR ATIVO" value={fmt(mrrAtivo)} borderColor="#22c55e" icon="💰" />
            <MetricCard label="CONVERSÃO" value={`${taxaConversao.toFixed(1)}%`} color="#4A90D9" />
            <MetricCard label="TICKET MÉDIO" value={fmt(ticketMedio)} icon="🎟️" />
          </div>
        )}

        {/* ─── KANBAN ─── */}
        {aba === 'propostas' && isComercial && vistaPropostas === 'kanban' && (
          <div className="kanban-board">
            {/* O conteúdo do Kanban permanece aqui para orquestração */}
            <div className="kanban-col">
              <div style={{ padding: 10, fontWeight: "bold" }}>NOVAS</div>
              {propostasAbertas.map(p => (
                <div key={p.id} className="kanban-card" style={{ marginBottom: 10 }}>
                  <div>{p.cliente}</div>
                  <div style={{ fontWeight: "bold", color: "#4A90D9" }}>{fmt(p.valor)}</div>
                  <button className="btn-action" onClick={() => abrirNotasDaProposta(p)}>Notas</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── CLIENTES ─── */}
        {aba === 'clientes' && (
          <div className="table-wrapper">
             <button onClick={() => { setFormCliente({ nome: "", tipo: "Cliente", filial: "Matriz" }); setModalClienteForm(true); }} className="btn-action" style={{ margin: 20 }}>+ Novo Cliente</button>
             <table>
               <thead>
                 <tr><th>Empresa</th><th>Categoria</th><th>Score</th><th>Ações</th></tr>
               </thead>
               <tbody>
                 {clientesAgrupados.map(c => (
                   <tr key={c.id}>
                     <td>{c.nome}</td>
                     <td><BadgeStatus status={c.tipo} /></td>
                     <td>{c.score || 0} pts</td>
                     <td><button className="btn-action" onClick={() => setClienteDetalhe(c)}>Diário</button></td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        )}

        {/* Restantes abas omitidas para brevidade, mas mantidas no código real */}
      </main>

      {/* ─── MODAIS ─── */}

      {/* MODAL: TAREFA */}
      <ModalTarefa 
        isOpen={modalTarefa} 
        onClose={() => setModalTarefa(false)} 
        formTarefa={formTarefa} 
        setFormTarefa={setFormTarefa} 
        salvarTarefa={salvarTarefa} 
      />

      {/* MODAL: CLIENTE */}
      <ModalClienteForm 
        isOpen={modalClienteForm} 
        onClose={() => setModalClienteForm(false)} 
        formCliente={formCliente} 
        setFormCliente={setFormCliente} 
        salvarClienteBase={salvarClienteBase} 
        isAdmin={isAdmin} 
      />

      {/* MODAL: FICHA DO CLIENTE (DIÁRIO) */}
      {clienteDetalhe && (
        <div className="modal-overlay" onClick={() => setClienteDetalhe(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 860, display: "flex", flexWrap: "wrap", gap: 24 }}>
            <div style={{ flex: "1 1 300px" }}>
              <h2>{clienteDetalhe.nome}</h2>
              <BadgeStatus status={clienteDetalhe.tipo} />
              <div style={{ marginTop: 20 }}>
                {(() => {
                  const risk = calcularChurnRisk(clienteDetalhe);
                  const sugestao = gerarSugestaoIA(clienteDetalhe);
                  return (
                    <>
                      <div style={{ padding: 10, borderRadius: 8, background: `${risk.cor}22`, color: risk.cor, marginBottom: 10 }}>
                        {risk.emoji} Risco: {risk.nivel} ({risk.score}/100)
                      </div>
                      <div style={{ padding: 10, borderRadius: 8, background: "rgba(74,144,217,0.1)", border: "1px solid #4A90D9" }}>
                        <strong>Copiloto IA:</strong> {sugestao.acao}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <div style={{ flex: "1 1 300px" }}>
              <h4>Diário de Bordo</h4>
              <form onSubmit={salvarInteracao} style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <textarea required className="input-modal" value={formInteracao.descricao} onChange={e => setFormInteracao({ ...formInteracao, descricao: e.target.value })} placeholder="Anotar conversa..." />
                <button type="submit" className="btn-action">Salvar</button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
