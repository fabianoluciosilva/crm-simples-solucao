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
import { ModalContrato } from "@/components/modals/ModalContrato";
import { ModalTemplate } from "@/components/modals/ModalTemplate";
import { ModalUsuario } from "@/components/modals/ModalUsuario";
import { ModalPerda } from "@/components/modals/ModalPerda";
import { ModalEditarValor } from "@/components/modals/ModalEditarValor";
import { ModalComunicado } from "@/components/modals/ModalComunicado";

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

// ─── HOOK: USE DEBOUNCE ─────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

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
  const [formTarefa, setFormTarefa] = useState<Partial<TarefaDB & { prioridade: string }>>({ titulo: "", descricao: "", data_vencimento: "", status: "Pendente", usuario_email: "", nome_referencia: "", prioridade: "Normal" });
  const [modalContrato, setModalContrato] = useState(false);
  const [formContrato, setFormContrato] = useState<Partial<ContratoDB>>({ cliente_nome: "", valor_mensal: 0, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: "", motivo_cancelamento: "" });
  const [modalTemplate, setModalTemplate] = useState(false);
  const [formTemplate, setFormTemplate] = useState<Partial<TemplateDB>>({ nome: "", tipo: "WhatsApp", conteudo: "", assunto: "" });
  const [modalClienteForm, setModalClienteForm] = useState(false);
  const [formCliente, setFormCliente] = useState<Partial<ClienteDB>>({ nome: "", email: "", telefone: "", whatsapp: "", documento: "", tipo: "Cliente", codigo: "", filial: "Matriz" });
  const [modalUsuario, setModalUsuario] = useState(false);
  const [formUsuario, setFormUsuario] = useState<Partial<PerfilUsuario & { senha?: string }>>({ email: '', nome: '', senha: '', perfil: 'Comercial', filial: 'Matriz' });
  
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

  // CORREÇÃO: Função diasSemInteracao recuperada e colocada corretamente
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
  const abrirNovaTarefa = (referencia?: string, leadId?: number, propostaId?: number, clienteId?: string) => {
    setFormTarefa({ titulo: "", descricao: "", data_vencimento: "", status: "Pendente", usuario_email: session?.user?.email || "", cliente_id: clienteId, nome_referencia: referencia || "", lead_id: leadId, proposta_id: propostaId, prioridade: "Normal" });
    setModalTarefa(true);
  };
  const editarTarefa = (t: TarefaDB) => {
    const dataFormatada = t.data_vencimento ? new Date(t.data_vencimento).toISOString().slice(0, 16) : "";
    setFormTarefa({ ...t, data_vencimento: dataFormatada });
    setModalTarefa(true);
  };
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
      if (!formUsuario.senha || formUsuario.senha.length < 6) return showToast("A senha deve ter pelo menos 6 caracteres.", "erro");
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
        
        /* CORREÇÃO DA ROLAGEM NO MENU: Esconde a barra visual mas mantém a funcionalidade */
        .sidebar::-webkit-scrollbar, .nav-menu::-webkit-scrollbar { display: none; }
        .sidebar, .nav-menu { -ms-overflow-style: none; scrollbar-width: none; }

        .sidebar { width: 260px; position: fixed; top: 0; bottom: 0; left: 0; z-index: 100; transition: transform 0.3s ease; background: var(--bg-sidebar); overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; border-right: 1px solid var(--border-light); }
        .main-content { flex: 1; margin-left: 260px; padding: 40px; width: calc(100% - 260px); min-height: 100vh; }
        
        .nav-menu { padding: 20px; flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; color: var(--text-secondary); cursor: pointer; border: none; background: transparent; font-weight: 600; width: 100%; text-align: left; font-size: 13px; transition: all 0.15s; }
        .nav-item:hover { background: rgba(74,144,217,0.07); color: var(--text-primary); }
        .nav-item.active { background: rgba(74,144,217,0.12); color: #4A90D9; }
        .grid-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .metric-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 20px; transition: box-shadow 0.2s; }
        .metric-card:hover { box-shadow: var(--shadow); }
        .table-wrapper { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; overflow-x: auto; margin-bottom: 24px; -webkit-overflow-scrolling: touch; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(0,0,0,0.1); padding: 14px 16px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); text-align: left; letter-spacing: 0.05em; white-space: nowrap; }
        td { padding: 14px 16px; border-bottom: 1px solid var(--border-light); font-size: 14px; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(74,144,217,0.03); }
        .badge-status { padding: 3px 9px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
        .btn-action { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--border-light); background: rgba(255,255,255,0.04); color: var(--text-primary); margin-right: 4px; margin-bottom: 4px; transition: all 0.15s; }
        .btn-action:hover { background: rgba(74,144,217,0.1); border-color: rgba(74,144,217,0.3); color: #4A90D9; }
        .btn-action:disabled { opacity: 0.4; cursor: not-allowed; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
        .modal-content { background: var(--bg-sidebar); padding: 30px; border-radius: 20px; width: 100%; max-width: 550px; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border-light); box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
        .input-modal { width: 100%; background: var(--bg-main); border: 1px solid var(--border-light); color: var(--text-primary); padding: 11px 14px; border-radius: 8px; margin-bottom: 0; font-family: 'Outfit', sans-serif; font-size: 14px; transition: border-color 0.15s; }
        .input-modal:focus { outline: none; border-color: #4A90D9; }
        .toast { position: fixed; bottom: 30px; right: 30px; padding: 14px 22px; border-radius: 12px; color: #fff; font-weight: 600; z-index: 9999; box-shadow: 0 10px 25px rgba(0,0,0,0.3); animation: slideIn .3s forwards; display: flex; align-items: center; gap: 10px; font-size: 14px; }
        @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        
        .kanban-board { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 20px; -webkit-overflow-scrolling: touch; }
        .kanban-col { flex: 1; min-width: 260px; max-width: 320px; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 14px; display: flex; flex-direction: column; transition: border-color 0.2s; }
        .kanban-col.drag-over { border-color: #4A90D9; background: rgba(74,144,217,0.04); }
        .kanban-header { padding: 14px 16px; border-bottom: 1px solid var(--border-light); font-weight: 700; font-size: 13px; text-transform: uppercase; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.05em; }
        .kanban-body { padding: 12px; flex: 1; display: flex; flex-direction: column; gap: 12px; min-height: 150px; }
        .kanban-card { background: var(--bg-main); border: 1px solid var(--border-light); border-radius: 10px; padding: 14px; cursor: grab; transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s; }
        .kanban-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.15); transform: translateY(-1px); }
        .kanban-card.dragging { opacity: 0.4; transform: scale(0.97); cursor: grabbing; }
        .notificacao-badge { background: #f87171; color: #fff; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; margin-left: 6px; }
        .prioridade-alta { border-left: 3px solid #f87171 !important; }
        .prioridade-normal { border-left: 3px solid #4A90D9 !important; }
        .prioridade-baixa { border-left: 3px solid #64748b !important; }
        .busca-global-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 200; display: flex; align-items: flex-start; justify-content: center; padding-top: 120px; backdrop-filter: blur(4px); }
        .busca-global-box { background: var(--bg-sidebar); border: 1px solid var(--border-light); border-radius: 16px; width: 100%; max-width: 600px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.5); }
        .resultado-busca-item { padding: 10px 20px; cursor: pointer; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; gap: 12px; font-size: 14px; transition: background 0.1s; }
        .resultado-busca-item:hover { background: rgba(74,144,217,0.1); }
        
        /* ─── MOBILE STYLES ─── */
        .mobile-menu-btn { display: none; background: none; border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; padding: 0 10px 0 0; }
        .close-menu-btn { display: none; background: none; border: none; color: var(--text-secondary); font-size: 20px; cursor: pointer; position: absolute; top: 15px; right: 15px; z-index: 1001; }
        .mobile-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 9; backdrop-filter: blur(3px); }
        .header-controls { display: flex; gap: 8px; align-items: center; }
        
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); z-index: 1000; box-shadow: 5px 0 25px rgba(0,0,0,0.5); }
          .sidebar.open { transform: translateX(0); }
          .main-content { margin-left: 0; padding: 15px; width: 100%; }
          .mobile-menu-btn { display: block; }
          .close-menu-btn { display: block; }
          .mobile-overlay.open { display: block; }
          header { flex-direction: column; align-items: flex-start !important; gap: 15px; }
          .header-controls { width: 100%; flex-wrap: wrap; }
          .metric-card { padding: 15px; }
          .grid-metrics { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
          table th, table td { font-size: 12px; padding: 10px; }
          .modal-content { padding: 20px; margin: 10px; }
        }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div className="toast" style={{ background: toast.tipo === 'sucesso' ? '#22c55e' : toast.tipo === 'erro' ? '#f87171' : '#4A90D9' }}>
          {toast.tipo === 'sucesso' ? '✅' : toast.tipo === 'erro' ? '❌' : 'ℹ️'} {toast.msg}
        </div>
      )}

      {/* OVERLAY PARA MENU MOBILE */}
      <div className={`mobile-overlay ${menuMobileAberto ? 'open' : ''}`} onClick={() => setMenuMobileAberto(false)}></div>

      {/* FILA WHATSAPP FLUTUANTE */}
      {filaWpp.length > 0 && (
        <div style={{ position: "fixed", bottom: 90, right: 30, background: "#22c55e", borderRadius: 16, padding: 16, zIndex: 999, maxWidth: 300, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
          <div style={{ color: "#fff", fontWeight: 700, marginBottom: 10 }}>💬 Fila WhatsApp ({filaWpp.length})</div>
          {filaWpp.slice(0, 3).map(cli => (
            <div key={cli.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: "#fff", fontSize: 12, flex: 1 }}>{cli.nome}</span>
              <button onClick={() => enviarWhatsAppDaFila(cli)} style={{ background: "#fff", color: "#22c55e", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Enviar</button>
            </div>
          ))}
          {filaWpp.length > 3 && <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 4 }}>+{filaWpp.length - 3} na fila...</div>}
          <button onClick={() => setFilaWpp([])} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", marginTop: 8, width: "100%" }}>Limpar Fila</button>
        </div>
      )}

      {/* BUSCA GLOBAL (Ctrl+K) */}
      {mostrarBuscaGlobal && (
        <div className="busca-global-overlay" onClick={() => { setMostrarBuscaGlobal(false); setBuscaGlobal(""); }}>
          <div className="busca-global-box" onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <input
                ref={searchInputRef}
                value={buscaGlobal}
                onChange={e => setBuscaGlobal(e.target.value)}
                placeholder="Pesquisar clientes, propostas, tarefas..."
                style={{ flex: 1, background: "transparent", border: "none", color: "var(--text-primary)", fontSize: 16, outline: "none", fontFamily: "'Outfit', sans-serif" }}
                autoFocus
              />
              <kbd style={{ background: "var(--border-light)", padding: "2px 6px", borderRadius: 4, fontSize: 11, color: "var(--text-secondary)" }}>ESC</kbd>
            </div>
            {buscaGlobal.length >= 2 && (
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {resultadosBuscaGlobal.clientes.length > 0 && (
                  <>
                    <div style={{ padding: "8px 20px", fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>CLIENTES</div>
                    {resultadosBuscaGlobal.clientes.map((c: any) => (
                      <div key={c.nome} className="resultado-busca-item" onClick={() => { setClienteDetalhe(c); setMostrarBuscaGlobal(false); setBuscaGlobal(""); }}>
                        <span>👤</span><div><div style={{ fontWeight: 600 }}>{c.nome}</div><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.tipo} · {c.email || "sem e-mail"}</div></div>
                      </div>
                    ))}
                  </>
                )}
                {resultadosBuscaGlobal.propostas.length > 0 && (
                  <>
                    <div style={{ padding: "8px 20px", fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>PROPOSTAS</div>
                    {resultadosBuscaGlobal.propostas.map((p: any) => (
                      <div key={p.id} className="resultado-busca-item" onClick={() => { mudarAba('propostas'); setMostrarBuscaGlobal(false); setBuscaGlobal(""); }}>
                        <span>🎯</span><div><div style={{ fontWeight: 600 }}>{p.cliente}</div><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.numero} · {fmt(p.valor)}</div></div>
                        <BadgeStatus status={p.status || 'aberta'} />
                      </div>
                    ))}
                  </>
                )}
                {resultadosBuscaGlobal.tarefas.length > 0 && (
                  <>
                    <div style={{ padding: "8px 20px", fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>TAREFAS</div>
                    {resultadosBuscaGlobal.tarefas.map((t: any) => (
                      <div key={t.id} className="resultado-busca-item" onClick={() => { mudarAba('tarefas'); setMostrarBuscaGlobal(false); setBuscaGlobal(""); }}>
                        <span>✅</span><div><div style={{ fontWeight: 600 }}>{t.titulo}</div><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.nome_referencia}</div></div>
                        <BadgeStatus status={t.status} />
                      </div>
                    ))}
                  </>
                )}
                {resultadosBuscaGlobal.clientes.length === 0 && resultadosBuscaGlobal.propostas.length === 0 && resultadosBuscaGlobal.tarefas.length === 0 && (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>Nenhum resultado encontrado para "{buscaGlobal}"</div>
                )}
              </div>
            )}
            {buscaGlobal.length < 2 && (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                Digite ao menos 2 caracteres para pesquisar
              </div>
            )}
          </div>
        </div>
      )}

      {/* SIDEBAR COM SUPORTE MOBILE */}
      <aside className={`sidebar ${menuMobileAberto ? 'open' : ''}`}>
        <button className="close-menu-btn" onClick={() => setMenuMobileAberto(false)}>✕</button>
        <div style={{ padding: "24px 20px", textAlign: "center", borderBottom: "1px solid var(--border-light)" }}>
          <img 
            src={tema === 'dark' ? '/Logo-negativo.webp' : '/logo-ssti.webp'} 
            style={{ maxHeight: "36px", borderRadius: "8px" }} 
            alt="SSTI" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }} 
          />
        </div>
        <nav className="nav-menu">
          {isComercial && <button className={`nav-item ${aba === 'dashboard' ? 'active' : ''}`} onClick={() => mudarAba('dashboard')}>📈 Dashboard</button>}
          {isComercial && (
            <button className={`nav-item ${aba === 'propostas' ? 'active' : ''}`} onClick={() => mudarAba('propostas')}>
              🎯 Funil de Vendas
            </button>
          )}
          <button className={`nav-item ${aba === 'clientes' ? 'active' : ''}`} onClick={() => mudarAba('clientes')}>👥 Base de Clientes</button>
          {isAdmin && <button className={`nav-item ${aba === 'contratos' ? 'active' : ''}`} onClick={() => mudarAba('contratos')}>📄 Financeiro (MRR)</button>}
          <button className={`nav-item ${aba === 'tarefas' ? 'active' : ''}`} onClick={() => mudarAba('tarefas')}>
            ✅ Tarefas
            {tarefasUrgentes.length > 0 && <span className="notificacao-badge">{tarefasUrgentes.length}</span>}
          </button>
          {isAdmin && <button className={`nav-item ${aba === 'relatorios' ? 'active' : ''}`} onClick={() => mudarAba('relatorios')}>📊 Relatórios</button>}
          {isAdmin && <button className={`nav-item ${aba === 'templates' ? 'active' : ''}`} onClick={() => mudarAba('templates')}>📝 Templates</button>}
          {isAdmin && <button className={`nav-item ${aba === 'usuarios' ? 'active' : ''}`} onClick={() => mudarAba('usuarios')}>🔐 Usuários</button>}
          {isComercial && (
            <button
              className="nav-item"
              style={{ color: "#4A90D9", marginTop: "16px", border: "1px dashed #4A90D9", borderRadius: 10 }}
              onClick={() => router.push('/preco')}
            >
              ✚ Nova Proposta
            </button>
          )}
        </nav>
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-light)" }}>
          <button
            onClick={() => { setMenuMobileAberto(false); setMostrarBuscaGlobal(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
            style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: 8, padding: "8px 12px", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}
          >
            🔍 <span>Pesquisar...</span>
            <kbd style={{ marginLeft: "auto", background: "var(--border-light)", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>⌘K</kbd>
          </button>
          <div style={{ fontSize: "11px", color: "#4A90D9", fontWeight: "bold", marginBottom: 2 }}>Simples Solução TI</div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: 4 }}>{perfilAtivo.perfil} · {perfilAtivo.filial}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={alternarTema} className="btn-action" style={{ flex: 1, textAlign: "center" }}>{tema === 'dark' ? '☀️' : '🌙'}</button>
            <button onClick={handleLogout} style={{ flex: 1, color: "#f87171", background: "none", border: "1px solid rgba(248,113,113,0.2)", cursor: "pointer", fontSize: "12px", padding: "6px", borderRadius: 6, fontWeight: 600 }}>Sair</button>
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: 10, textAlign: "center" }}>v4.2 - Total Modular</div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main-content">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* BOTÃO HAMBÚRGUER MOBILE */}
            <button className="mobile-menu-btn" onClick={() => setMenuMobileAberto(true)}>☰</button>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 800 }}>
                {aba === 'dashboard' && '📈 Dashboard'}
                {aba === 'propostas' && '🎯 Funil de Vendas'}
                {aba === 'clientes' && '👥 Base de Clientes'}
                {aba === 'contratos' && '📄 Financeiro (MRR)'}
                {aba === 'tarefas' && '✅ Tarefas'}
                {aba === 'relatorios' && '📊 Relatórios'}
                {aba === 'templates' && '📝 Templates'}
                {aba === 'usuarios' && '🔐 Usuários'}
              </h1>
              {carregando && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>A sincronizar dados...</div>}
            </div>
          </div>
          <div className="header-controls">
            {(aba === 'dashboard' || aba === 'propostas' || aba === 'relatorios') && (
              <select value={filtroDias} onChange={e => setFiltroDias(Number(e.target.value))} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "8px 12px", fontSize: 13 }}>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 3 Meses</option>
                <option value={180}>Últimos 6 Meses</option>
                <option value={0}>Sempre</option>
              </select>
            )}
            {aba === 'propostas' && (
              <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, overflow: "hidden" }}>
                <button onClick={() => setVistaPropostas('kanban')} style={{ background: vistaPropostas === 'kanban' ? 'rgba(74,144,217,0.2)' : 'transparent', color: vistaPropostas === 'kanban' ? '#4A90D9' : 'var(--text-secondary)', border: "none", padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Kanban</button>
                <button onClick={() => setVistaPropostas('tabela')} style={{ background: vistaPropostas === 'tabela' ? 'rgba(74,144,217,0.2)' : 'transparent', color: vistaPropostas === 'tabela' ? '#4A90D9' : 'var(--text-secondary)', border: "none", padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Tabela</button>
              </div>
            )}
            <button onClick={carregarTudo} className="btn-action" style={{ margin: 0 }} title="Recarregar dados">🔄</button>
          </div>
        </header>

        {/* ─── ABA: DASHBOARD ─────────────────────────────────────────────────── */}
        {aba === 'dashboard' && isComercial && (
          <>
            <div className="grid-metrics">
              {isAdmin && <MetricCard label="MRR ATIVO" value={fmt(mrrAtivo)} borderColor="#22c55e" icon="💰" sub={`${contratos.filter(c => c.status === 'Ativo').length} contratos`} />}
              <MetricCard label="TAXA DE CONVERSÃO" value={`${taxaConversao.toFixed(1)}%`} color="#4A90D9" borderColor="#4A90D9" icon="📈" />
              <MetricCard label="GANHAS (VALOR)" value={fmt(propostasFechadas.reduce((a, b) => a + b.valor, 0))} color="#22c55e" borderColor="#22c55e" icon="🏆" sub={`${propostasFechadas.length} negócios`} />
              <MetricCard label="TICKET MÉDIO" value={fmt(ticketMedio)} borderColor="#a855f7" icon="🎟️" />
              <MetricCard label="PERDIDAS" value={propostasPerdidas.length} color="#f87171" borderColor="#f87171" icon="❌" />
            </div>

            <div className="grid-metrics" style={{ marginBottom: "24px" }}>
              <MetricCard label="EM ABERTO (NOVAS)" value={fmt(propostasAbertas.reduce((a, b) => a + b.valor, 0))} borderColor="#64748b" />
              <MetricCard label="EM NEGOCIAÇÃO" value={fmt(propostasEnviadas.reduce((a, b) => a + b.valor, 0))} color="#4A90D9" borderColor="#4A90D9" />
              <MetricCard label="FECHADO NO PERÍODO" value={fmt(propostasFechadas.reduce((a, b) => a + b.valor, 0))} color="#22c55e" borderColor="#22c55e" />
            </div>

            {/* ALERTAS RÁPIDOS */}
            {tarefasUrgentes.length > 0 && (
              <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <span style={{ color: "#f87171", fontWeight: 700, fontSize: 14 }}>⚠️ {tarefasUrgentes.length} tarefa{tarefasUrgentes.length > 1 ? 's' : ''} urgente{tarefasUrgentes.length > 1 ? 's' : ''}</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: 13, marginLeft: 10 }}>{tarefasUrgentes.slice(0, 2).map(t => t.titulo).join(', ')}{tarefasUrgentes.length > 2 ? '...' : ''}</span>
                </div>
                <button className="btn-action" style={{ color: "#f87171", borderColor: "#f87171", margin: 0 }} onClick={() => mudarAba('tarefas')}>Ver Tarefas</button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
              <div className="metric-card" style={{ height: 320 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 16 }}>📊 Funil de Negociação</div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ name: 'Criadas', qtd: pFiltradas.length }, { name: 'Enviadas', qtd: propostasEnviadas.length + propostasFechadas.length }, { name: 'Ganhas', qtd: propostasFechadas.length }]} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={80} />
                    <ChartTooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0a1628', border: 'none', borderRadius: 8, color: '#fff' }} />
                    <Bar dataKey="qtd" fill="#4A90D9" radius={[0, 6, 6, 0]} barSize={28} label={{ position: 'right', fill: 'var(--text-secondary)', fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="metric-card" style={{ height: 320 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 16 }}>📉 Motivos de Perda</div>
                {propostasPerdidas.length === 0 ? (
                  <div style={{ height: "80%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontSize: 32 }}>🎉</span>
                    <span>Nenhuma perda no período!</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dadosMotivosPerda} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={5} dataKey="value">
                        {dadosMotivosPerda.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />)}
                      </Pie>
                      <ChartTooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: 8, color: '#fff' }} itemStyle={{ color: '#fff' }} />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="metric-card" style={{ height: 280, gridColumn: "1 / -1" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 16 }}>📅 Evolução Mensal de Propostas (6 meses)</div>
                <ResponsiveContainer width="100%" height="85%">
                  <AreaChart data={dadosPipelineMensal} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorGanhas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPerdidas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <ChartTooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: 8, color: '#fff' }} />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                    <Area type="monotone" dataKey="ganhas" name="Ganhas" stroke="#22c55e" fill="url(#colorGanhas)" strokeWidth={2} />
                    <Area type="monotone" dataKey="perdidas" name="Perdidas" stroke="#f87171" fill="url(#colorPerdidas)" strokeWidth={2} />
                    <Area type="monotone" dataKey="abertas" name="Em Aberto" stroke="#4A90D9" fill="none" strokeWidth={2} strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* ─── ABA: PROPOSTAS (KANBAN) ─────────────────────────────────────────── */}
        {aba === 'propostas' && isComercial && vistaPropostas === 'kanban' && (
          <div className="kanban-board">
            {[
              { status: 'aberta', label: 'Novas', cor: 'var(--text-secondary)', propostas: propostasAbertas },
              { status: 'negociacao', label: 'Em Negociação', cor: '#4A90D9', propostas: propostasEnviadas },
              { status: 'fechada', label: '🎉 Ganhou', cor: '#22c55e', propostas: propostasFechadas },
              { status: 'perdida', label: '❌ Perdeu', cor: '#f87171', propostas: propostasPerdidas },
            ].map(col => (
              <div
                key={col.status}
                className="kanban-col"
                style={{ borderColor: col.status !== 'aberta' ? `${col.cor}33` : undefined }}
                onDragOver={handleDragOver}
                onDrop={e => handleDropStatus(e, col.status)}
                onDragEnter={e => e.currentTarget.classList.add('drag-over')}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.classList.remove('drag-over'); }}
              >
                <div className="kanban-header" style={{ color: col.cor }}>
                  <span>{col.label}</span>
                  <span style={{ background: `${col.cor}22`, color: col.cor, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{col.propostas.length}</span>
                </div>
                <div className="kanban-body">
                  {col.propostas.map(p => {
                    const diasFrio = diasSemInteracao(p);
                    const esfriando = diasFrio >= LIMIAR_ESFRIANDO;
                    return (
                    <div
                      key={p.id}
                      className={`kanban-card ${tarefaArrastando === p.id ? 'dragging' : ''}`}
                      style={{ borderLeft: col.status !== 'aberta' ? `3px solid ${col.cor}` : undefined, opacity: col.status === 'perdida' ? 0.7 : 1 }}
                      draggable={true} 
                      onDragStart={e => handleDragStart(e, p)}
                      onDragEnd={handleDragEnd}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{new Date(p.created_at).toLocaleDateString('pt-BR')} · {p.filial || 'Matriz'}</div>
                        {esfriando && col.status !== 'fechada' && col.status !== 'perdida' && (
                          <span title={`${diasFrio} dias sem interação`} style={{ fontSize: 10, background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "1px 6px", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                            ❄️ {diasFrio}d frio
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14, marginBottom: 2 }}>{p.cliente}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{p.contato}</div>
                      {p.origem && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 6 }}>🎯 {p.origem}</div>}
                      <div style={{ fontWeight: 800, color: "#4A90D9", marginBottom: 10, fontSize: 16 }}>{fmt(p.valor)}</div>
                      {p.motivo_perda && <div style={{ fontSize: 11, color: "#f87171", marginBottom: 8, padding: "4px 8px", background: "rgba(248,113,113,0.08)", borderRadius: 6 }}>{p.motivo_perda}</div>}
                      
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0 }} onClick={() => abrirModalEnvio(p, 'WhatsApp')}>💬 Wpp</button>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0 }} onClick={() => abrirModalEnvio(p, 'Email')}>📧 E-mail</button>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, background: "rgba(74,144,217,0.08)", color: "#4A90D9", borderColor: "rgba(74,144,217,0.3)", margin: 0 }} onClick={() => abrirNotasDaProposta(p)}>📝 Notas</button>
                      </div>

                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0, background: "rgba(34,197,94,0.08)", color: "#22c55e", borderColor: "rgba(34,197,94,0.3)" }} onClick={() => setModalEditarValor({ativo: true, prop: p, novoValor: p.valor.toString()})}>💰 Alterar Valor</button>
                        {isAdmin && <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0, background: "rgba(248,113,113,0.08)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }} onClick={() => excluirProposta(p.id, p.cliente)}>🗑️ Excluir</button>}
                      </div>

                    </div>
                    );
                  })}
                  {col.propostas.length === 0 && (
                    <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: 12, padding: 20 }}>Arraste propostas aqui</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── ABA: PROPOSTAS (TABELA) ─────────────────────────────────────────── */}
        {aba === 'propostas' && isComercial && vistaPropostas === 'tabela' && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Data</th><th>Cliente / Contato</th><th>Filial</th><th>Valor</th><th>Origem</th><th>Status</th><th style={{ textAlign: "right" }}>Ações</th></tr>
              </thead>
              <tbody>
                {pFiltradas.map(p => (
                  <tr key={p.id} style={{ opacity: p.status === 'perdida' ? 0.6 : 1 }}>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                    <td><strong>{p.cliente}</strong><br /><small style={{ color: "var(--text-secondary)" }}>{p.contato}</small></td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.filial || 'Matriz'}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(p.valor)}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.origem || '—'}</td>
                    <td title={p.motivo_perda ? `Motivo: ${p.motivo_perda}` : ""}>
                      <BadgeStatus status={p.status || 'aberta'} />
                      {p.motivo_perda && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3 }}>{p.motivo_perda}</div>}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn-action" onClick={() => abrirNotasDaProposta(p)}>📝</button>
                      <button className="btn-action" onClick={() => visualizarProposta(p)}>PDF</button>
                      <button className="btn-action" onClick={() => abrirModalEnvio(p, 'WhatsApp')}>💬</button>
                      <button className="btn-action" disabled={enviando === p.id} onClick={() => abrirModalEnvio(p, 'Email')}>{enviando === p.id ? '...' : '📧'}</button>
                      {p.status !== 'fechada' && <button className="btn-action" style={{ color: "#22c55e", borderColor: "#22c55e" }} onClick={() => alterarStatusParaGanho(p)}>✓</button>}
                      {p.status !== 'perdida' && <button className="btn-action" style={{ color: "#f87171" }} onClick={() => abrirModalPerda(p)}>✗</button>}
                      {(p.status === 'fechada' || p.status === 'perdida') && (
                        <button className="btn-action" style={{ color: "#f59e0b", borderColor: "#f59e0b" }} onClick={async () => {
                          await supabase.from('propostas').update({ status: 'negociacao' }).eq('id', p.id);
                          showToast("Proposta reaberta!", "info");
                          carregarTudo();
                        }}>↩️</button>
                      )}
                      {isAdmin && <button className="btn-action" style={{ color: "#f87171" }} onClick={() => excluirProposta(p.id, p.cliente)}>🗑️</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── ABA: CLIENTES ───────────────────────────────────────────────────── */}
        {aba === 'clientes' && (
          <>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
              {isComercial && (
                <button
                  onClick={() => { setFormCliente({ nome: "", email: "", telefone: "", whatsapp: "", documento: "", tipo: "Cliente", codigo: "", filial: perfilAtivo.filial }); setModalClienteForm(true); }}
                  className="btn-action" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "9px 18px", fontSize: 13, margin: 0 }}
                >+ Novo Registo</button>
              )}
              {isComercial && (
                <button
                  onClick={() => { setFormComunicado({ publico: "Cliente", assunto: "", mensagem: "" }); setModalComunicado(true); }}
                  className="btn-action" style={{ color: "#4A90D9", border: "1px solid #4A90D9", padding: "9px 18px", fontSize: 13, margin: 0 }}
                >📢 Comunicado em Massa</button>
              )}
              <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-card)", padding: "0 12px", borderRadius: 8, border: "1px solid var(--border-light)", cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={mostrarDesativados} onChange={e => setMostrarDesativados(e.target.checked)} />
                  Exibir Inativos
                </label>
                <input className="input-modal" style={{ maxWidth: "240px", margin: 0, padding: "8px 12px" }} placeholder="🔍 Pesquisar..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} />
                <select className="input-modal" value={filtroTipoCliente} onChange={e => setFiltroTipoCliente(e.target.value as any)} style={{ maxWidth: "180px", margin: 0, padding: "8px 12px" }}>
                  <option value="Todos">Todas as Categorias</option>
                  <option value="Cliente">Apenas Clientes</option>
                  <option value="Lead">Apenas Leads</option>
                  <option value="Parceiro">Apenas Parceiros</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              {clientesAgrupados.length} registo{clientesAgrupados.length !== 1 ? 's' : ''} encontrado{clientesAgrupados.length !== 1 ? 's' : ''}
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Nome / Cód</th><th>Contatos</th><th>Categoria</th><th>🔥 Score</th>{isComercial && <th>Histórico</th>}<th style={{ textAlign: "right" }}>Ação</th></tr>
                </thead>
                <tbody>
                  {clientesAgrupados.map(c => (
                    <tr key={c.nome} style={{ opacity: c.ativo === false ? 0.4 : 1 }}>
                      <td>
                        <strong>{c.nome}</strong>
                        {c.codigo && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.codigo}</div>}
                        {c.ativo === false && <span style={{ fontSize: 10, color: "#f87171", fontWeight: "bold" }}> (INATIVO)</span>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>📞 {c.telefone || c.contato || '—'}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>💬 {c.whatsapp || '—'}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{c.email}</div>
                      </td>
                      <td><BadgeStatus status={c.tipo} /></td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 'bold', color: (c.score || 0) >= 75 ? '#22c55e' : (c.score || 0) >= 45 ? '#f59e0b' : '#f87171' }}>
                          {c.score || 0} pts
                        </span>
                      </td>
                      {isComercial && (
                        <td style={{ whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {c.propostas.length} prop{c.propostas.length !== 1 ? 's' : ''}
                            {c.contratos.filter((x: any) => x.status === 'Ativo').length > 0 && ` · ${c.contratos.filter((x: any) => x.status === 'Ativo').length} contrato(s)`}
                            {c.interacoes.length > 0 && <span style={{ color: "#4A90D9", display: "block" }}>{c.interacoes.length} nota(s)</span>}
                          </span>
                        </td>
                      )}
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn-action" onClick={() => setClienteDetalhe(c)}>📋 Diário</button>
                        {isComercial && (
                          <button className="btn-action" onClick={() => {
                            setFormCliente({ id: c.isOficial ? c.id : undefined, nome: c.nome, email: c.email || "", telefone: c.telefone || "", whatsapp: c.whatsapp || "", documento: c.documento || "", tipo: c.tipo || "Lead", codigo: c.codigo || "", filial: c.filial || perfilAtivo.filial });
                            setModalClienteForm(true);
                          }}>Editar</button>
                        )}
                        {isAdmin && (
                          <button className="btn-action" style={{ borderColor: c.ativo === false ? "#22c55e" : "#f87171", color: c.ativo === false ? "#22c55e" : "#f87171", margin: 0 }} onClick={() => alternarStatusCliente(c)}>
                            {c.ativo === false ? 'Ativar' : 'Desativar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── ABA: CONTRATOS (MRR) ────────────────────────────────────────────── */}
        {aba === 'contratos' && isAdmin && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => abrirNovoContrato()} className="btn-action" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "9px 18px", fontSize: 13, margin: 0 }}>+ Novo Contrato</button>
              <div style={{ flex: 1 }} />
              <div className="metric-card" style={{ padding: "10px 20px", marginBottom: 0, display: "flex", gap: 20, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>MRR Total:</span>
                <span style={{ fontWeight: 800, color: "#22c55e", fontSize: 16 }}>{fmt(mrrAtivo)}</span>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Início</th><th>Cliente</th><th>Valor MRR</th><th>Serviços</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {contratos.map(c => (
                    <tr key={c.id} style={{ opacity: c.status === 'Cancelado' ? 0.5 : 1 }}>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{new Date(c.data_inicio).toLocaleDateString('pt-BR')}</td>
                      <td><strong>{c.cliente_nome}</strong></td>
                      <td style={{ fontWeight: 700, color: "#22c55e", whiteSpace: "nowrap" }}>{fmt(c.valor_mensal)}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 200 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.servicos_inclusos || '—'}</div></td>
                      <td><BadgeStatus status={c.status} /></td>
                      <td style={{ whiteSpace: "nowrap" }}><button className="btn-action" style={{ margin: 0 }} onClick={() => editarContrato(c)}>Gerir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── ABA: TAREFAS ────────────────────────────────────────────────────── */}
        {aba === 'tarefas' && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => abrirNovaTarefa()} className="btn-action" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "9px 18px", fontSize: 13, margin: 0 }}>+ Nova Tarefa</button>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
                {(["Todos", "Pendente", "Em Andamento", "Concluído", "Atrasado"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFiltroStatusTarefa(s)}
                    className="btn-action"
                    style={{
                      background: filtroStatusTarefa === s ? 'rgba(74,144,217,0.2)' : 'transparent',
                      color: filtroStatusTarefa === s ? '#4A90D9' : 'var(--text-secondary)',
                      borderColor: filtroStatusTarefa === s ? '#4A90D9' : 'var(--border-light)',
                      fontSize: 12, margin: 0
                    }}
                  >
                    {s === 'Atrasado' ? '⚠️ ' : ''}{s}
                    {s === 'Atrasado' && tarefasComAtraso.filter(t => t.status === 'Atrasado').length > 0 && (
                      <span className="notificacao-badge" style={{ marginLeft: 4 }}>{tarefasComAtraso.filter(t => t.status === 'Atrasado').length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Prazo</th><th>Tarefa</th><th>Cliente</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>
                  {tarefasFiltradas.map(t => {
                    const diasAtraso = t.status !== 'Concluído' ? calcDiasAtraso(t.data_vencimento) : 0;
                    return (
                      <tr key={t.id} style={{ opacity: t.status === 'Concluído' ? 0.5 : 1 }}
                        className={t.prioridade === 'Alta' ? 'prioridade-alta' : t.prioridade === 'Baixa' ? 'prioridade-baixa' : ''}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ fontSize: 13 }}>{new Date(t.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                          {diasAtraso > 0 && t.status !== 'Concluído' && (
                            <div style={{ fontSize: 10, color: "#f87171", fontWeight: 700 }}>⚠️ {diasAtraso}d atrasado</div>
                          )}
                        </td>
                        <td>
                          <strong style={{ fontSize: 14 }}>{t.titulo}</strong>
                          {t.descricao && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{t.descricao.substring(0, 60)}{t.descricao.length > 60 ? '...' : ''}</div>}
                        </td>
                        <td style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{t.nome_referencia || '—'}</td>
                        <td><BadgeStatus status={t.status} /></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {t.status !== 'Concluído' && (
                            <button className="btn-action" style={{ color: "#22c55e", borderColor: "#22c55e" }} onClick={() => alterarStatusTarefaRapido(t.id, 'Concluído')}>✓</button>
                          )}
                          {t.status !== 'Em Andamento' && t.status !== 'Concluído' && (
                            <button className="btn-action" style={{ color: "#4A90D9" }} onClick={() => alterarStatusTarefaRapido(t.id, 'Em Andamento')}>▶</button>
                          )}
                          <button className="btn-action" onClick={() => editarTarefa(t as TarefaDB)}>Editar</button>
                          {isAdmin && <button className="btn-action" style={{ color: "#f87171", margin: 0 }} onClick={() => excluirTarefa(t.id)}>🗑️</button>}
                        </td>
                      </tr>
                    );
                  })}
                  {tarefasFiltradas.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>Nenhuma tarefa para o filtro selecionado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── ABA: RELATÓRIOS ─────────────────────────────────────────────────── */}
        {aba === 'relatorios' && isAdmin && (
          <>
            <div className="grid-metrics" style={{ marginBottom: 24 }}>
              <MetricCard label="CLIENTES ATIVOS" value={clientesAgrupados.filter(c => c.tipo === 'Cliente' && c.ativo !== false).length} icon="👥" />
              <MetricCard label="LEADS NA BASE" value={clientesAgrupados.filter(c => c.tipo === 'Lead').length} color="#f59e0b" icon="🎯" />
              <MetricCard label="CONTRATOS ATIVOS" value={contratos.filter(c => c.status === 'Ativo').length} color="#22c55e" icon="📄" />
              <MetricCard label="CHURN (CANCELADOS)" value={contratos.filter(c => c.status === 'Cancelado').length} color="#f87171" icon="📉" />
              <MetricCard label="MRR TOTAL" value={fmt(mrrAtivo)} color="#22c55e" icon="💰" />
              <MetricCard label="TICKET MÉDIO" value={fmt(ticketMedio)} icon="🎟️" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
              <div className="metric-card" style={{ height: 360 }}>
                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: 8 }}>MRR Atual vs Meta Trimestral</div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: 16 }}>Valor recorrente por contratos ativos</div>
                <ResponsiveContainer width="100%" height="80%">
                  <BarChart data={[{ name: 'MRR Atual', Receita: mrrAtivo }, { name: 'Meta (+20%)', Receita: mrrAtivo * 1.2 }]} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                    <ChartTooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0a1628', border: 'none', borderRadius: 8, color: '#fff' }} formatter={(v: any) => fmt(v)} />
                    <Bar dataKey="Receita" fill="#22c55e" radius={[6, 6, 0, 0]} barSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="metric-card" style={{ height: 360 }}>
                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: 8 }}>Evolução Mensal de Propostas</div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: 16 }}>Ganhas vs Perdidas nos últimos 6 meses</div>
                <ResponsiveContainer width="100%" height="80%">
                  <LineChart data={dadosPipelineMensal} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <ChartTooltip contentStyle={{ background: '#0a1628', border: 'none', borderRadius: 8, color: '#fff' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="ganhas" name="Ganhas" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} />
                    <Line type="monotone" dataKey="perdidas" name="Perdidas" stroke="#f87171" strokeWidth={2} dot={{ fill: '#f87171', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* ─── ABA: TEMPLATES ──────────────────────────────────────────────────── */}
        {aba === 'templates' && isAdmin && (
          <>
            <button onClick={() => { setFormTemplate({ nome: "", tipo: "WhatsApp", conteudo: "", assunto: "" }); setModalTemplate(true); }} className="btn-action" style={{ marginBottom: "20px", background: "#4A90D9", color: "#fff", border: "none", padding: "9px 18px" }}>+ Novo Template</button>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Nome</th><th>Canal</th><th>Pré-visualização</th><th style={{ textAlign: "right" }}>Ação</th></tr></thead>
                <tbody>
                  {templates.map(t => (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: "nowrap" }}><strong>{t.nome}</strong></td>
                      <td><span className="badge-status" style={{ background: t.tipo === 'WhatsApp' ? 'rgba(34,197,94,0.15)' : 'rgba(74,144,217,0.15)', color: t.tipo === 'WhatsApp' ? '#22c55e' : '#4A90D9' }}>{t.tipo}</span></td>
                      <td><div style={{ maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "12px", color: "var(--text-secondary)" }}>{t.conteudo}</div></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn-action" onClick={() => { setFormTemplate(t); setModalTemplate(true); }}>Editar</button>
                        <button className="btn-action" style={{ color: "#f87171", margin: 0 }} onClick={() => excluirTemplate(t.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── ABA: USUÁRIOS ───────────────────────────────────────────────────── */}
        {aba === 'usuarios' && isAdmin && (
          <>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <button onClick={() => { setFormUsuario({ id: undefined, email: '', nome: '', senha: '', perfil: 'Comercial', filial: perfilAtivo.filial }); setModalUsuario(true); }} className="btn-action" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "9px 18px", fontSize: 13 }}>+ Pré-registar Membro</button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Nome / E-mail</th><th>Perfil</th><th>Filial</th><th style={{ textAlign: "right" }}>Ações</th></tr></thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.email}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <strong>{u.nome || "Não definido"}</strong>
                        {u.email === session?.user?.email && <span style={{ marginLeft: 8, fontSize: 10, color: "#4A90D9", background: "rgba(74,144,217,0.1)", padding: "2px 6px", borderRadius: 10 }}>Você</span>}
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{u.email}</div>
                      </td>
                      <td><span className="badge-status" style={{ background: "rgba(74,144,217,0.1)", color: "#4A90D9" }}>{u.perfil}</span></td>
                      <td>{u.filial}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn-action" onClick={() => { setFormUsuario(u); setModalUsuario(true); }}>Editar Acesso</button>
                        {u.email !== session?.user?.email && <button className="btn-action" style={{ color: "#f87171", margin: 0 }} onClick={() => excluirUsuario(u.id, u.email)}>Remover</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* ─── MODAIS DA APLICAÇÃO ─────────────────────────────────────────────── */}
      
      {/* ─── MODAIS COMPONENTIZADOS ─── */}
      <ModalTarefa 
        isOpen={modalTarefa} 
        onClose={() => setModalTarefa(false)} 
        formTarefa={formTarefa} 
        setFormTarefa={setFormTarefa} 
        salvarTarefa={salvarTarefa} 
      />

      <ModalClienteForm 
        isOpen={modalClienteForm} 
        onClose={() => setModalClienteForm(false)} 
        formCliente={formCliente} 
        setFormCliente={setFormCliente} 
        salvarClienteBase={salvarClienteBase} 
        isAdmin={isAdmin} 
      />

      <ModalContrato 
        isOpen={modalContrato} 
        onClose={() => setModalContrato(false)} 
        formContrato={formContrato} 
        setFormContrato={setFormContrato} 
        salvarContrato={salvarContrato} 
      />

      <ModalTemplate 
        isOpen={modalTemplate} 
        onClose={() => setModalTemplate(false)} 
        formTemplate={formTemplate} 
        setFormTemplate={setFormTemplate} 
        salvarTemplate={salvarTemplate} 
      />

      <ModalUsuario 
        isOpen={modalUsuario} 
        onClose={() => setModalUsuario(false)} 
        formUsuario={formUsuario} 
        setFormUsuario={setFormUsuario} 
        salvarUsuario={salvarUsuario} 
      />

      <ModalPerda 
        isOpen={modalPerda} 
        onClose={() => setModalPerda(false)} 
        formPerda={formPerda} 
        setFormPerda={setFormPerda} 
        confirmarPerda={confirmarPerda} 
      />

      <ModalEditarValor 
        isOpen={modalEditarValor.ativo} 
        onClose={() => setModalEditarValor({ ativo: false, prop: null, novoValor: '' })} 
        modalEditarValor={modalEditarValor} 
        setModalEditarValor={setModalEditarValor} 
        salvarNovoValorProposta={salvarNovoValorProposta} 
      />

      <ModalComunicado 
        isOpen={modalComunicado} 
        onClose={() => setModalComunicado(false)} 
        progressoEmail={progressoEmail} 
        formComunicado={formComunicado} 
        setFormComunicado={setFormComunicado} 
        gerarFilaWhatsapp={gerarFilaWhatsapp} 
        dispararEmailsMassa={dispararEmailsMassa} 
      />

      {/* ─── MODAL INLINE RESTANTE (Diário de Bordo e Envio Inteligente) ─── */}

      {/* MODAL: ENVIO INTELIGENTE */}
      {modalEnvioProposta.ativo && modalEnvioProposta.prop && (
        <div className="modal-overlay" onClick={() => setModalEnvioProposta({ ativo: false, tipo: 'Email', prop: null, numeroWpp: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 6 }}>Enviar {modalEnvioProposta.tipo === 'Email' ? '📧 E-mail' : '💬 WhatsApp'}</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Para: <strong>{modalEnvioProposta.prop.cliente}</strong></p>
            <form onSubmit={confirmarEnvioMensagem} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {modalEnvioProposta.tipo === 'WhatsApp' && (
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Número de Destino (Com DDD e código do país)</label>
                  <input required className="input-modal" value={modalEnvioProposta.numeroWpp} onChange={e => setModalEnvioProposta({ ...modalEnvioProposta, numeroWpp: e.target.value })} placeholder="Ex: 5521999999999" />
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Template</label>
                <select className="input-modal" value={formEnvioMensagem.templateId} onChange={e => setFormEnvioMensagem({ ...formEnvioMensagem, templateId: e.target.value })}>
                  <option value="" disabled>Selecione um template...</option>
                  {templates.filter(t => t.tipo === modalEnvioProposta.tipo).map(t => (
                    <option key={t.id} value={t.id.toString()}>{t.nome}</option>
                  ))}
                  <option value="custom">✍️ Mensagem personalizada...</option>
                </select>
              </div>
              {formEnvioMensagem.templateId && modalEnvioProposta.tipo === 'Email' && (
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Assunto</label>
                  <input required className="input-modal" value={formEnvioMensagem.assunto} onChange={e => setFormEnvioMensagem({ ...formEnvioMensagem, assunto: e.target.value })} placeholder="Assunto do e-mail..." />
                </div>
              )}
              {formEnvioMensagem.templateId && (
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Mensagem (pode editar antes de enviar)</label>
                  <textarea required className="input-modal" rows={8} value={formEnvioMensagem.texto} onChange={e => setFormEnvioMensagem({ ...formEnvioMensagem, texto: e.target.value })} placeholder="Digite a mensagem..." />
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <button type="button" onClick={() => setModalEnvioProposta({ ativo: false, tipo: 'Email', prop: null, numeroWpp: '' })} className="btn-action" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={!formEnvioMensagem.templateId || !formEnvioMensagem.texto.trim() || enviando === modalEnvioProposta.prop.id} className="btn-action" style={{ flex: 1, background: "#4A90D9", color: "#fff", borderColor: "#4A90D9" }}>
                  {enviando === modalEnvioProposta.prop.id ? '⏳ A enviar...' : `Enviar ${modalEnvioProposta.tipo}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: FICHA DO CLIENTE (DIÁRIO DE BORDO) — COM CHURN RISK E COPILOTO ─── */}
      {clienteDetalhe && (
        <div className="modal-overlay" onClick={() => setClienteDetalhe(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 860, display: "flex", flexWrap: "wrap", gap: 24 }}>
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 20 }}>{clienteDetalhe.nome}</h2>
                  <BadgeStatus status={clienteDetalhe.tipo} />
                </div>
                <button onClick={() => setClienteDetalhe(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 20, padding: 4 }}>✕</button>
              </div>

              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                <span>📞 {clienteDetalhe.telefone || clienteDetalhe.contato || '—'}</span><br />
                <span>💬 {clienteDetalhe.whatsapp || '—'}</span><br />
                <span>📧 {clienteDetalhe.email || '—'}</span>
                {clienteDetalhe.documento && <><br /><span>📋 {clienteDetalhe.documento}</span></>}
                <br />
                <span style={{ color: "#f87171", fontWeight: "bold" }}>🔥 Score: {clienteDetalhe.score || 0} pts</span>
              </div>

              {/* BADGE DE CHURN RISK */}
              {(() => {
                const risk = calcularChurnRisk(clienteDetalhe);
                return (
                  <div style={{ 
                    marginBottom: 16,
                    padding: '10px 14px', 
                    borderRadius: 12, 
                    background: `${risk.cor}15`,
                    border: `1px solid ${risk.cor}40`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{risk.emoji}</span>
                      <span style={{ fontWeight: 700, color: risk.cor, fontSize: 14 }}>
                        Risco de Churn: {risk.nivel} ({risk.score}/100)
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {risk.recomendacao}
                    </div>
                  </div>
                );
              })()}

              {/* COPILOTO COMERCIAL IA */}
              {(() => {
                const sugestao = gerarSugestaoIA(clienteDetalhe);
                return (
                  <div style={{ 
                    marginTop: 16,
                    padding: '14px 16px', 
                    borderRadius: 12, 
                    background: 'rgba(74,144,217,0.08)',
                    border: '1px solid rgba(74,144,217,0.2)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 18 }}>{sugestao.emoji}</span>
                      <span style={{ fontWeight: 700, color: '#4A90D9', fontSize: 14 }}>
                        Sugestão da IA
                      </span>
                      <span style={{ 
                        marginLeft: 'auto', 
                        fontSize: 11, 
                        padding: '2px 8px', 
                        borderRadius: 9999,
                        background: sugestao.prioridade === 'Alta' ? '#f8717122' : 
                                   sugestao.prioridade === 'Média' ? '#f59e0b22' : '#22c55e22',
                        color: sugestao.prioridade === 'Alta' ? '#f87171' : 
                               sugestao.prioridade === 'Média' ? '#f59e0b' : '#22c55e',
                        fontWeight: 600
                      }}>
                        {sugestao.prioridade}
                      </span>
                    </div>
                    
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                      {sugestao.titulo}
                    </div>
                    
                    <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 6 }}>
                      {sugestao.acao}
                    </div>
                    
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {sugestao.motivo}
                    </div>
                  </div>
                );
              })()}

              <hr style={{ margin: "12px 0", opacity: 0.1 }} />
              
              {isComercial && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <h4 style={{ color: "#4A90D9", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Propostas</h4>
                    {clienteDetalhe.propostas.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Nenhuma proposta</div>
                    ) : (
                      clienteDetalhe.propostas.map((p: any) => (
                        <div key={p.id} style={{ fontSize: 13, padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
                          <span>{p.numero}</span>
                          <span style={{ fontWeight: 700, color: p.status === 'fechada' ? '#22c55e' : p.status === 'perdida' ? '#f87171' : 'var(--text-primary)' }}>{fmt(p.valor)}</span>
                          <BadgeStatus status={p.status || 'aberta'} />
                        </div>
                      ))
                    )}
                  </div>
                  {isAdmin && (
                    <div style={{ marginBottom: 12 }}>
                      <h4 style={{ color: "#4A90D9", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Contratos</h4>
                      {clienteDetalhe.contratos.length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Sem contrato</div>
                      ) : (
                        clienteDetalhe.contratos.map((c: any) => (
                          <div key={c.id} style={{ fontSize: 13, padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#22c55e", fontWeight: 700 }}>{fmt(c.valor_mensal)}/mês</span>
                            <BadgeStatus status={c.status} />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
              <div>
                <h4 style={{ color: "#4A90D9", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Tarefas Pendentes</h4>
                {clienteDetalhe.tarefas.filter((t: any) => t.status !== 'Concluído').length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Nenhuma pendência</div>
                ) : (
                  clienteDetalhe.tarefas.filter((t: any) => t.status !== 'Concluído').map((t: any) => (
                    <div key={t.id} style={{ fontSize: 13, padding: "4px 0" }}>
                      {t.titulo} — <span style={{ color: "var(--text-secondary)" }}>{new Date(t.data_vencimento).toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))
                )}
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn-action" style={{ width: "100%", background: "rgba(74,144,217,0.1)", color: "#4A90D9", borderColor: "rgba(74,144,217,0.3)", padding: 10 }} 
                  onClick={() => { abrirNovaTarefa(clienteDetalhe.nome, undefined, undefined, clienteDetalhe.id); setClienteDetalhe(null); }}>
                  + Criar Tarefa para este Cliente
                </button>
              </div>
            </div>

            <div style={{ flex: "1 1 300px", background: "var(--bg-main)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <h4 style={{ marginBottom: 16, fontSize: 14 }}>📒 Diário de Bordo</h4>
              <div style={{ flex: 1, overflowY: "auto", marginBottom: 16, paddingRight: 8, maxHeight: 380 }}>
                {clienteDetalhe.interacoes.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", marginTop: 40 }}>Nenhuma interação registada.<br />Comece pelo formulário abaixo.</div>
                ) : (
                  clienteDetalhe.interacoes.map((i: any) => (
                    <div key={i.id} style={{ borderLeft: "2px solid #4A90D9", paddingLeft: 12, marginLeft: 5, marginBottom: 18, position: "relative" }}>
                      <div style={{ position: "absolute", left: -6, top: 3, width: 10, height: 10, borderRadius: 10, background: "#4A90D9" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: "bold", color: "#4A90D9", textTransform: "uppercase", letterSpacing: "0.05em" }}>{i.tipo}</span>
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{new Date(i.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{i.descricao}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, textAlign: "right" }}>— {i.usuario_email.split('@')[0]}</div>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={salvarInteracao} style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border-light)", paddingTop: 14 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <select className="input-modal" style={{ width: 130, padding: 8, fontSize: 13 }} value={formInteracao.tipo} onChange={e => setFormInteracao({ ...formInteracao, tipo: e.target.value })}>
                    <option value="Nota">✏️ Nota</option>
                    <option value="Ligação">📞 Ligação</option>
                    <option value="Reunião">🤝 Reunião</option>
                    <option value="WhatsApp">💬 Wpp</option>
                    <option value="E-mail">📧 E-mail</option>
                    <option value="Visita">🏢 Visita</option>
                  </select>
                  <textarea required className="input-modal" style={{ flex: 1, padding: 8, fontSize: 13, resize: "vertical" }} rows={3} placeholder="Registe o que foi conversado..." value={formInteracao.descricao} onChange={e => setFormInteracao({ ...formInteracao, descricao: e.target.value })} />
                </div>
                <button type="submit" className="btn-action" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: 10 }}>Gravar Interação</button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
