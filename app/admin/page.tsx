"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── COMPONENTES DE LAYOUT E LÓGICA ─────────────────────────────────────────
import { BadgeStatus } from "@/components/BadgeStatus";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { 
  fmt, formatarWhatsApp, calcDiasAtraso, analisarSentimento
} from "@/utils/crmLogic";

// ─── VISTAS (VIEWS) EXTRAÍDAS ───────────────────────────────────────────────
import { DashboardView } from "@/components/views/DashboardView";
import { RelatoriosView } from "@/components/views/RelatoriosView";
import { PropostasView } from "@/components/views/PropostasView";
import { ClientesView } from "@/components/views/ClientesView";
import { ContratosView } from "@/components/views/ContratosView";
import { TarefasView } from "@/components/views/TarefasView";
import { TemplatesView } from "@/components/views/TemplatesView";
import { UsuariosView } from "@/components/views/UsuariosView";

// ─── MODAIS EXTRAÍDOS ───────────────────────────────────────────────────────
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

  // ─── FUNÇÃO: ALTERNAR TEMA ────────────────────────────────────────────────
  const alternarTema = () => {
    const n = tema === "dark" ? "light" : "dark";
    setTema(n);
    localStorage.setItem("tema_ssti", n);
  };

  // ─── LOGIN E AUTH ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = localStorage.getItem("tema_ssti");
    if (t === "light" || t === "dark") setTema(t);

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
      if (perfis.data) setUsuarios(perfis.data as PerfilUsuario[]);
    } catch (err) {
      showToast("Erro ao carregar dados.", "erro");
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

  const tarefasUrgentes = useMemo(() => tarefas.filter(t => t.status !== 'Concluído' && calcDiasAtraso(t.data_vencimento) >= -2), [tarefas]);

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

  // --- FUNÇÕES DE AÇÃO ---
  const alternarStatusCliente = async (cliente: any) => {
    const novoStatus = cliente.ativo === false ? true : false;
    try {
      if (cliente.isOficial) {
        await supabase.from('clientes').update({ ativo: novoStatus }).eq('id', cliente.id);
      } else {
        await supabase.from('clientes').insert([{ nome: cliente.nome, email: cliente.email, tipo: cliente.tipo, filial: perfilAtivo.filial, ativo: novoStatus }]);
      }
      showToast(`Registo ${novoStatus ? 'ativado' : 'desativado'}!`);
      carregarTudo();
    } catch { showToast("Erro ao alterar status.", "erro"); }
  };

  const gerarFilaWhatsapp = () => {
    let alvos = formComunicado.publico === "Todos" ? clientesBase : clientesBase.filter(c => c.tipo === formComunicado.publico);
    alvos = alvos.filter(c => (c.whatsapp || c.telefone) && c.ativo !== false);
    setFilaWpp(alvos);
    setModalComunicado(false);
  };

  const enviarWhatsAppDaFila = (cli: ClienteDB) => {
    const numero = formatarWhatsApp(cli.whatsapp || cli.telefone);
    const texto = `Olá *${cli.nome}*,\n\n${formComunicado.mensagem}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank');
    setFilaWpp(prev => prev.filter(c => c.id !== cli.id));
  };

  const abrirModalEnvio = (prop: PropostaDB, tipo: 'Email' | 'WhatsApp') => {
    setModalEnvioProposta({ ativo: true, tipo, prop, numeroWpp: formatarWhatsApp(prop.telefone || "") });
  };

  const handleDragStart = (e: React.DragEvent, prop: PropostaDB) => { e.dataTransfer.setData("propId", prop.id.toString()); setTarefaArrastando(prop.id); };
  const handleDragEnd = () => setTarefaArrastando(null);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDropStatus = async (e: React.DragEvent, novoStatus: string) => {
    e.preventDefault(); setTarefaArrastando(null);
    const propId = Number(e.dataTransfer.getData("propId"));
    await supabase.from('propostas').update({ status: novoStatus }).eq('id', propId);
    showToast("Status atualizado!");
    carregarTudo();
  };

  const alterarStatusParaGanho = async (prop: PropostaDB) => {
    await supabase.from('propostas').update({ status: 'fechada' }).eq('id', prop.id);
    showToast("🎉 Negócio Ganho!");
    carregarTudo();
  };

  const reabrirProposta = async (id: number) => {
    await supabase.from('propostas').update({ status: 'negociacao' }).eq('id', id);
    showToast("Proposta reaberta!");
    carregarTudo();
  };

  const salvarNovoValorProposta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalEditarValor.prop) {
      await supabase.from('propostas').update({ valor: Number(modalEditarValor.novoValor) }).eq('id', modalEditarValor.prop.id);
      setModalEditarValor({ ativo: false, prop: null, novoValor: '' });
      carregarTudo();
    }
  };

  const confirmarPerda = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('propostas').update({ status: 'perdida', motivo_perda: formPerda.motivo }).eq('id', formPerda.id);
    setModalPerda(false);
    carregarTudo();
  };

  const abrirModalPerda = (prop: PropostaDB) => { setFormPerda({ id: prop.id, motivo: "", obs: "" }); setModalPerda(true); };

  const salvarInteracao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clienteDetalhe) {
      await supabase.from('interacoes').insert([{ cliente_id: clienteDetalhe.id, cliente_nome: clienteDetalhe.nome, usuario_email: perfilAtivo.email, tipo: formInteracao.tipo, descricao: formInteracao.descricao }]);
      setFormInteracao({ tipo: "Nota", descricao: "" });
      showToast("Nota salva!");
      carregarTudo();
    }
  };

  const salvarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('tarefas').insert([formTarefa]);
    setModalTarefa(false);
    carregarTudo();
  };

  const salvarClienteBase = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('clientes').insert([formCliente]);
    setModalClienteForm(false);
    carregarTudo();
  };

  const salvarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('contratos').insert([formContrato]);
    setModalContrato(false);
    carregarTudo();
  };

  const salvarTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('templates').insert([formTemplate]);
    setModalTemplate(false);
    carregarTudo();
  };

  const salvarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('perfis').insert([formUsuario]);
    setModalUsuario(false);
    carregarTudo();
  };

  const excluirProposta = async (id: number, nome: string) => { if (confirm(`Excluir proposta de ${nome}?`)) { await supabase.from('propostas').delete().eq('id', id); carregarTudo(); } };
  const excluirTarefa = async (id: number) => { await supabase.from('tarefas').delete().eq('id', id); carregarTudo(); };
  const excluirTemplate = async (id: number) => { await supabase.from('templates').delete().eq('id', id); carregarTudo(); };
  const excluirUsuario = async (id?: string) => { if (id) { await supabase.from('perfis').delete().eq('id', id); carregarTudo(); } };
  const alterarStatusTarefaRapido = async (id: number, status: string) => { await supabase.from('tarefas').update({ status }).eq('id', id); carregarTudo(); };
  const editarTarefa = (t: any) => { setFormTarefa(t); setModalTarefa(true); };
  const editarContrato = (c: any) => { setFormContrato(c); setModalContrato(true); };

  // --- GUARD DE AUTENTICAÇÃO ---
  if (carregandoAuth) return <div style={{ background: "#080f1e", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#4A90D9" }}>A carregar sistema...</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* 1. ESTILOS CSS VITAIS */}
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
        .sidebar { width: 260px; position: fixed; top: 0; bottom: 0; left: 0; z-index: 100; transition: transform 0.3s ease; background: var(--bg-sidebar); overflow-y: auto; border-right: 1px solid var(--border-light); }
        .main-content { flex: 1; margin-left: 260px; padding: 40px; width: calc(100% - 260px); min-height: 100vh; transition: all 0.3s; }
        .nav-menu { padding: 20px; display: flex; flex-direction: column; gap: 4px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; color: var(--text-secondary); cursor: pointer; border: none; background: transparent; font-weight: 600; font-size: 13px; text-align: left; }
        .nav-item:hover { background: rgba(74,144,217,0.07); color: var(--text-primary); }
        .nav-item.active { background: rgba(74,144,217,0.12); color: #4A90D9; }
        .grid-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .metric-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 20px; transition: box-shadow 0.2s; min-height: 100px; }
        .table-wrapper { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; overflow-x: auto; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(0,0,0,0.1); padding: 14px 16px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); text-align: left; }
        td { padding: 14px 16px; border-bottom: 1px solid var(--border-light); font-size: 14px; }
        .btn-action { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--border-light); background: rgba(255,255,255,0.04); color: var(--text-primary); margin-right: 4px; transition: all 0.15s; }
        .kanban-board { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 20px; }
        .kanban-col { flex: 1; min-width: 260px; max-width: 320px; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 14px; display: flex; flex-direction: column; }
        .kanban-card { background: var(--bg-main); border: 1px solid var(--border-light); border-radius: 10px; padding: 14px; margin-bottom: 12px; cursor: grab; }
        .notificacao-badge { background: #f87171; color: #fff; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; margin-left: 6px; }
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); }
          .main-content { margin-left: 0; padding: 15px; width: 100%; }
          header { flex-direction: column; align-items: flex-start !important; gap: 15px; }
          .header-controls { width: 100%; flex-wrap: wrap; }
          .mobile-menu-btn { display: block; }
          .close-menu-btn { display: block; }
        }
      `}</style>

      {/* 2. SIDEBAR */}
      <Sidebar 
        menuMobileAberto={menuMobileAberto} setMenuMobileAberto={setMenuMobileAberto}
        tema={tema} alternarTema={alternarTema} aba={aba} mudarAba={mudarAba}
        isComercial={isComercial} isAdmin={isAdmin} tarefasUrgentesCount={tarefasUrgentes.length}
        router={router} abrirBuscaGlobal={() => { setMostrarBuscaGlobal(true); }}
        perfilAtivo={perfilAtivo} handleLogout={handleLogout}
      />

      <main className="main-content">
        {/* 3. HEADER */}
        <Header 
          setMenuMobileAberto={setMenuMobileAberto} aba={aba} carregando={carregando}
          filtroDias={filtroDias} setFiltroDias={setFiltroDias}
          vistaPropostas={vistaPropostas} setVistaPropostas={setVistaPropostas} carregarTudo={carregarTudo}
        />

        {/* 4. CONTEÚDO DINÂMICO (VIEWS) */}
        {aba === 'dashboard' && isComercial && (
          <DashboardView 
            isAdmin={isAdmin} mrrAtivo={mrrAtivo} taxaConversao={taxaConversao} 
            propostasFechadas={propostasFechadas} ticketMedio={ticketMedio} 
            propostasPerdidas={propostasPerdidas} propostasAbertas={propostasAbertas} 
            propostasEnviadas={propostasEnviadas} tarefasUrgentes={tarefasUrgentes} 
            mudarAba={mudarAba} pFiltradas={pFiltradas} 
            dadosMotivosPerda={dadosMotivosPerda} dadosPipelineMensal={dadosPipelineMensal} 
          />
        )}

        {aba === 'relatorios' && isAdmin && (
          <RelatoriosView 
            clientesAgrupados={clientesAgrupados} contratos={contratos} 
            mrrAtivo={mrrAtivo} ticketMedio={ticketMedio} dadosPipelineMensal={dadosPipelineMensal} 
          />
        )}

        {aba === 'propostas' && isComercial && (
          <PropostasView 
            vistaPropostas={vistaPropostas} propostasAbertas={propostasAbertas}
            propostasEnviadas={propostasEnviadas} propostasFechadas={propostasFechadas}
            propostasPerdidas={propostasPerdidas} pFiltradas={pFiltradas}
            tarefaArrastando={tarefaArrastando} handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd} handleDragOver={handleDragOver}
            handleDropStatus={handleDropStatus} diasSemInteracao={diasSemInteracao}
            abrirModalEnvio={abrirModalEnvio} abrirNotasDaProposta={abrirNotasDaProposta}
            setModalEditarValor={setModalEditarValor} isAdmin={isAdmin}
            excluirProposta={excluirProposta} visualizarProposta={() => {}}
            enviando={enviando} alterarStatusParaGanho={alterarStatusParaGanho}
            abrirModalPerda={abrirModalPerda} reabrirProposta={reabrirProposta}
          />
        )}

        {aba === 'clientes' && (
          <ClientesView 
            isComercial={isComercial} isAdmin={isAdmin} setFormCliente={setFormCliente} 
            setModalClienteForm={setModalClienteForm} perfilAtivo={perfilAtivo} 
            setFormComunicado={setFormComunicado} setModalComunicado={setModalComunicado} 
            mostrarDesativados={mostrarDesativados} setMostrarDesativados={setMostrarDesativados} 
            buscaCliente={buscaCliente} setBuscaCliente={setBuscaCliente} 
            filtroTipoCliente={filtroTipoCliente} setFiltroTipoCliente={setFiltroTipoCliente} 
            clientesAgrupados={clientesAgrupados} setClienteDetalhe={setClienteDetalhe} 
            alternarStatusCliente={alternarStatusCliente} 
          />
        )}

        {aba === 'contratos' && isAdmin && (
          <ContratosView 
            abrirNovoContrato={abrirNovoContrato} mrrAtivo={mrrAtivo} 
            contratos={contratos} editarContrato={editarContrato} 
          />
        )}

        {aba === 'tarefas' && (
          <TarefasView 
            abrirNovaTarefa={abrirNovaTarefa} filtroStatusTarefa={filtroStatusTarefa} 
            setFiltroStatusTarefa={setFiltroStatusTarefa} tarefasComAtraso={tarefas} 
            tarefasFiltradas={tarefas} alterarStatusTarefaRapido={alterarStatusTarefaRapido} 
            editarTarefa={editarTarefa} isAdmin={isAdmin} excluirTarefa={excluirTarefa} 
          />
        )}

        {aba === 'templates' && isAdmin && (
          <TemplatesView 
            setFormTemplate={setFormTemplate} setModalTemplate={setModalTemplate} 
            templates={templates} excluirTemplate={excluirTemplate} 
          />
        )}

        {aba === 'usuarios' && isAdmin && (
          <UsuariosView 
            setFormUsuario={setFormUsuario} setModalUsuario={setModalUsuario} 
            perfilAtivo={perfilAtivo} usuarios={usuarios} session={session} 
            excluirUsuario={excluirUsuario} 
          />
        )}
      </main>

      {/* 5. MODAIS */}
      <ModalTarefa isOpen={modalTarefa} onClose={() => setModalTarefa(false)} formTarefa={formTarefa} setFormTarefa={setFormTarefa} salvarTarefa={salvarTarefa} />
      <ModalClienteForm isOpen={modalClienteForm} onClose={() => setModalClienteForm(false)} formCliente={formCliente} setFormCliente={setFormCliente} salvarClienteBase={salvarClienteBase} isAdmin={isAdmin} />
      <ModalContrato isOpen={modalContrato} onClose={() => setModalContrato(false)} formContrato={formContrato} setFormContrato={setFormContrato} salvarContrato={salvarContrato} />
      <ModalTemplate isOpen={modalTemplate} onClose={() => setModalTemplate(false)} formTemplate={formTemplate} setFormTemplate={setFormTemplate} salvarTemplate={salvarTemplate} />
      <ModalUsuario isOpen={modalUsuario} onClose={() => setModalUsuario(false)} formUsuario={formUsuario} setFormUsuario={setFormUsuario} salvarUsuario={salvarUsuario} />
      <ModalPerda isOpen={modalPerda} onClose={() => setModalPerda(false)} formPerda={formPerda} setFormPerda={setFormPerda} confirmarPerda={confirmarPerda} />
      <ModalEditarValor isOpen={modalEditarValor.ativo} onClose={() => setModalEditarValor({ ativo: false, prop: null, novoValor: '' })} modalEditarValor={modalEditarValor} setModalEditarValor={setModalEditarValor} salvarNovoValorProposta={salvarNovoValorProposta} />
      <ModalComunicado isOpen={modalComunicado} onClose={() => setModalComunicado(false)} progressoEmail={progressoEmail} formComunicado={formComunicado} setFormComunicado={setFormComunicado} gerarFilaWhatsapp={gerarFilaWhatsapp} dispararEmailsMassa={() => {}} />
      <ModalEnvio modalEnvioProposta={modalEnvioProposta} setModalEnvioProposta={setModalEnvioProposta} formEnvioMensagem={formEnvioMensagem} setFormEnvioMensagem={setFormEnvioMensagem} confirmarEnvioMensagem={confirmarEnvioMensagem} templates={templates} enviando={enviando} />
      <ModalFichaCliente clienteDetalhe={clienteDetalhe} setClienteDetalhe={setClienteDetalhe} isComercial={isComercial} isAdmin={isAdmin} abrirNovaTarefa={abrirNovaTarefa} formInteracao={formInteracao} setFormInteracao={setFormInteracao} salvarInteracao={salvarInteracao} />
    </div>
  );
}