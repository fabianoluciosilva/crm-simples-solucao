"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── COMPONENTES E LÓGICA ───────────────────────────────────────────────────
import { BadgeStatus } from "@/components/BadgeStatus";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { 
  fmt, formatarWhatsApp, calcDiasAtraso, analisarSentimento
} from "@/utils/crmLogic";

// ─── VISTAS (VIEWS) ─────────────────────────────────────────────────────────
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
  const mudarAba = (novaAba: string) => { setAba(novaAba as AbaType); setMenuMobileAberto(false); };

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

  // ─── GERADOR DE PROPOSTA E ENVIO ─────────────────────────────────────────
  const abrirModalEnvio = (prop: PropostaDB, tipo: 'Email' | 'WhatsApp') => {
    let foneParaTentar = prop.telefone || "";
    const cb = prop.cliente_id ? clientesBase.find(c => c.id === prop.cliente_id) : clientesBase.find(c => c.nome.toUpperCase() === prop.cliente.trim().toUpperCase());
    if (cb) foneParaTentar = foneParaTentar || cb.whatsapp || cb.telefone || "";
    setModalEnvioProposta({ ativo: true, tipo, prop, numeroWpp: formatarWhatsApp(foneParaTentar) });
    setFormEnvioMensagem({ templateId: '', texto: '', assunto: '' });
  };

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
        // A lógica do fetch de e-mail é feita no backend
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
    window.open("", "_blank");
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

  const reabrirProposta = async (id: number) => {
    await supabase.from('propostas').update({ status: 'negociacao' }).eq('id', id);
    showToast("Proposta reaberta!", "info");
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

        .main-content { flex: 1; margin-left: 260px; padding: 40px; width: calc(100% - 260px); min-height: 100vh; }
        
        .grid-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .table-wrapper { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; overflow-x: auto; margin-bottom: 24px; -webkit-overflow-scrolling: touch; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(0,0,0,0.1); padding: 14px 16px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); text-align: left; letter-spacing: 0.05em; white-space: nowrap; }
        td { padding: 14px 16px; border-bottom: 1px solid var(--border-light); font-size: 14px; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(74,144,217,0.03); }
        .btn-action { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--border-light); background: rgba(255,255,255,0.04); color: var(--text-primary); margin-right: 4px; margin-bottom: 4px; transition: all 0.15s; }
        .btn-action:hover { background: rgba(74,144,217,0.1); border-color: rgba(74,144,217,0.3); color: #4A90D9; }
        .btn-action:disabled { opacity: 0.4; cursor: not-allowed; }
        
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
        .modal-content { background: var(--bg-sidebar); padding: 30px; border-radius: 20px; width: 100%; max-width: 550px; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border-light); box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
        .input-modal { width: 100%; background: var(--bg-main); border: 1px solid var(--border-light); color: var(--text-primary); padding: 11px 14px; border-radius: 8px; margin-bottom: 0; font-family: 'Outfit', sans-serif; font-size: 14px; transition: border-color 0.15s; }
        .input-modal:focus { outline: none; border-color: #4A90D9; }
        .toast { position: fixed; bottom: 30px; right: 30px; padding: 14px 22px; border-radius: 12px; color: #fff; font-weight: 600; z-index: 9999; box-shadow: 0 10px 25px rgba(0,0,0,0.3); animation: slideIn .3s forwards; display: flex; align-items: center; gap: 10px; font-size: 14px; }
        @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        
        .busca-global-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 200; display: flex; align-items: flex-start; justify-content: center; padding-top: 120px; backdrop-filter: blur(4px); }
        .busca-global-box { background: var(--bg-sidebar); border: 1px solid var(--border-light); border-radius: 16px; width: 100%; max-width: 600px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.5); }
        .resultado-busca-item { padding: 10px 20px; cursor: pointer; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; gap: 12px; font-size: 14px; transition: background 0.1s; }
        .resultado-busca-item:hover { background: rgba(74,144,217,0.1); }
        
        .mobile-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 9; backdrop-filter: blur(3px); }
        
        @media (max-width: 768px) {
          .main-content { margin-left: 0; padding: 15px; width: 100%; }
          .mobile-overlay.open { display: block; }
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

      <Sidebar 
        menuMobileAberto={menuMobileAberto}
        setMenuMobileAberto={setMenuMobileAberto}
        tema={tema}
        alternarTema={alternarTema}
        aba={aba}
        mudarAba={mudarAba}
        isComercial={isComercial}
        isAdmin={isAdmin}
        tarefasUrgentesCount={tarefasUrgentes.length}
        router={router}
        abrirBuscaGlobal={() => { setMenuMobileAberto(false); setMostrarBuscaGlobal(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
        perfilAtivo={perfilAtivo}
        handleLogout={handleLogout}
      />

      <main className="main-content">
        
        <Header 
          setMenuMobileAberto={setMenuMobileAberto}
          aba={aba}
          carregando={carregando}
          filtroDias={filtroDias}
          setFiltroDias={setFiltroDias}
          vistaPropostas={vistaPropostas}
          setVistaPropostas={setVistaPropostas}
          carregarTudo={carregarTudo}
        />

        {/* ─── VISTAS (VIEWS) ─────────────────────────────────────────────────── */}

        {aba === 'dashboard' && isComercial && (
          <DashboardView 
            isAdmin={isAdmin} 
            mrrAtivo={mrrAtivo} 
            taxaConversao={taxaConversao} 
            propostasFechadas={propostasFechadas} 
            ticketMedio={ticketMedio} 
            propostasPerdidas={propostasPerdidas} 
            propostasAbertas={propostasAbertas} 
            propostasEnviadas={propostasEnviadas} 
            tarefasUrgentes={tarefasUrgentes} 
            mudarAba={mudarAba} 
            pFiltradas={pFiltradas} 
            dadosMotivosPerda={dadosMotivosPerda} 
            dadosPipelineMensal={dadosPipelineMensal} 
          />
        )}

        {aba === 'relatorios' && isAdmin && (
          <RelatoriosView 
            clientesAgrupados={clientesAgrupados} 
            contratos={contratos} 
            mrrAtivo={mrrAtivo} 
            ticketMedio={ticketMedio} 
            dadosPipelineMensal={dadosPipelineMensal} 
          />
        )}

        {aba === 'propostas' && isComercial && (
          <PropostasView 
            vistaPropostas={vistaPropostas}
            propostasAbertas={propostasAbertas}
            propostasEnviadas={propostasEnviadas}
            propostasFechadas={propostasFechadas}
            propostasPerdidas={propostasPerdidas}
            pFiltradas={pFiltradas}
            tarefaArrastando={tarefaArrastando}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleDragOver={handleDragOver}
            handleDropStatus={handleDropStatus}
            diasSemInteracao={diasSemInteracao}
            abrirModalEnvio={abrirModalEnvio}
            abrirNotasDaProposta={abrirNotasDaProposta}
            setModalEditarValor={setModalEditarValor}
            isAdmin={isAdmin}
            excluirProposta={excluirProposta}
            visualizarProposta={visualizarProposta}
            enviando={enviando}
            alterarStatusParaGanho={alterarStatusParaGanho}
            abrirModalPerda={abrirModalPerda}
            reabrirProposta={reabrirProposta}
          />
        )}

        {aba === 'clientes' && (
          <ClientesView 
            isComercial={isComercial} 
            isAdmin={isAdmin} 
            setFormCliente={setFormCliente} 
            setModalClienteForm={setModalClienteForm} 
            perfilAtivo={perfilAtivo} 
            setFormComunicado={setFormComunicado} 
            setModalComunicado={setModalComunicado} 
            mostrarDesativados={mostrarDesativados} 
            setMostrarDesativados={setMostrarDesativados} 
            buscaCliente={buscaCliente} 
            setBuscaCliente={setBuscaCliente} 
            filtroTipoCliente={filtroTipoCliente} 
            setFiltroTipoCliente={setFiltroTipoCliente} 
            clientesAgrupados={clientesAgrupados} 
            setClienteDetalhe={setClienteDetalhe} 
            alternarStatusCliente={alternarStatusCliente} 
          />
        )}

        {aba === 'contratos' && isAdmin && (
          <ContratosView 
            abrirNovoContrato={abrirNovoContrato} 
            mrrAtivo={mrrAtivo} 
            contratos={contratos} 
            editarContrato={editarContrato} 
          />
        )}

        {aba === 'tarefas' && (
          <TarefasView 
            abrirNovaTarefa={abrirNovaTarefa} 
            filtroStatusTarefa={filtroStatusTarefa} 
            setFiltroStatusTarefa={setFiltroStatusTarefa} 
            tarefasComAtraso={tarefasComAtraso} 
            tarefasFiltradas={tarefasFiltradas} 
            alterarStatusTarefaRapido={alterarStatusTarefaRapido} 
            editarTarefa={editarTarefa} 
            isAdmin={isAdmin} 
            excluirTarefa={excluirTarefa} 
          />
        )}

        {aba === 'templates' && isAdmin && (
          <TemplatesView 
            setFormTemplate={setFormTemplate} 
            setModalTemplate={setModalTemplate} 
            templates={templates} 
            excluirTemplate={excluirTemplate} 
          />
        )}

        {aba === 'usuarios' && isAdmin && (
          <UsuariosView 
            setFormUsuario={setFormUsuario} 
            setModalUsuario={setModalUsuario} 
            perfilAtivo={perfilAtivo} 
            usuarios={usuarios} 
            session={session} 
            excluirUsuario={excluirUsuario} 
          />
        )}

      </main>

      {/* ─── MODAIS DA APLICAÇÃO ─────────────────────────────────────────────── */}
      
      <ModalTarefa isOpen={modalTarefa} onClose={() => setModalTarefa(false)} formTarefa={formTarefa} setFormTarefa={setFormTarefa} salvarTarefa={salvarTarefa} />
      <ModalClienteForm isOpen={modalClienteForm} onClose={() => setModalClienteForm(false)} formCliente={formCliente} setFormCliente={setFormCliente} salvarClienteBase={salvarClienteBase} isAdmin={isAdmin} />
      <ModalContrato isOpen={modalContrato} onClose={() => setModalContrato(false)} formContrato={formContrato} setFormContrato={setFormContrato} salvarContrato={salvarContrato} />
      <ModalTemplate isOpen={modalTemplate} onClose={() => setModalTemplate(false)} formTemplate={formTemplate} setFormTemplate={setFormTemplate} salvarTemplate={salvarTemplate} />
      <ModalUsuario isOpen={modalUsuario} onClose={() => setModalUsuario(false)} formUsuario={formUsuario} setFormUsuario={setFormUsuario} salvarUsuario={salvarUsuario} />
      <ModalPerda isOpen={modalPerda} onClose={() => setModalPerda(false)} formPerda={formPerda} setFormPerda={setFormPerda} confirmarPerda={confirmarPerda} />
      <ModalEditarValor isOpen={modalEditarValor.ativo} onClose={() => setModalEditarValor({ ativo: false, prop: null, novoValor: '' })} modalEditarValor={modalEditarValor} setModalEditarValor={setModalEditarValor} salvarNovoValorProposta={salvarNovoValorProposta} />
      
      <ModalComunicado 
        isOpen={modalComunicado} 
        onClose={() => setModalComunicado(false)} 
        progressoEmail={progressoEmail} 
        formComunicado={formComunicado} 
        setFormComunicado={setFormComunicado} 
        gerarFilaWhatsapp={gerarFilaWhatsapp} 
        dispararEmailsMassa={dispararEmailsMassa} 
      />

      <ModalEnvio 
        modalEnvioProposta={modalEnvioProposta} 
        setModalEnvioProposta={setModalEnvioProposta} 
        formEnvioMensagem={formEnvioMensagem} 
        setFormEnvioMensagem={setFormEnvioMensagem} 
        confirmarEnvioMensagem={confirmarEnvioMensagem} 
        templates={templates} 
        enviando={enviando} 
      />

      <ModalFichaCliente 
        clienteDetalhe={clienteDetalhe} 
        setClienteDetalhe={setClienteDetalhe} 
        isComercial={isComercial} 
        isAdmin={isAdmin} 
        abrirNovaTarefa={abrirNovaTarefa} 
        formInteracao={formInteracao} 
        setFormInteracao={setFormInteracao} 
        salvarInteracao={salvarInteracao} 
      />

    </div>
  );
}
