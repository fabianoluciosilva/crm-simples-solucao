"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PieChart, Pie, Cell, Tooltip as ChartTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface PropostaDB { id: number; created_at: string; numero: string; cliente: string; contato: string; telefone?: string; email: string; valor: number; status: string; status_envio: string; filial?: string; dados: any; motivo_perda?: string; obs_perda?: string; }
interface TarefaDB { id: number; titulo: string; descricao: string; data_vencimento: string; status: string; usuario_email: string; lead_id?: number; proposta_id?: number; nome_referencia?: string; data_conclusao?: string; created_at: string; }
interface ContratoDB { id: number; proposta_id?: number; cliente_nome: string; servicos_inclusos?: string; valor_mensal: number; status: string; data_inicio: string; data_fim?: string; motivo_cancelamento?: string; filial?: string; created_at: string; }
interface TemplateDB { id: number; nome: string; tipo: string; conteudo: string; created_at: string; }
interface ClienteDB { id: number; nome: string; email?: string; telefone?: string; whatsapp?: string; documento?: string; tipo: string; codigo?: string; filial?: string; created_at?: string; score?: number; }
interface InteracaoDB { id: number; cliente_nome: string; usuario_email: string; tipo: string; descricao: string; created_at: string; }

interface PerfilUsuario { email: string; perfil: 'Admin' | 'Comercial' | 'Suporte'; filial: string; }

export default function AdminPage() {
  const router = useRouter();

  // --- ESTADOS GERAIS E PERFIS ---
  const [session, setSession] = useState<any>(null);
  const [perfilAtivo, setPerfilAtivo] = useState<PerfilUsuario>({ email: '', perfil: 'Comercial', filial: 'Matriz' });
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const [toast, setToast] = useState<{msg: string, tipo: 'sucesso' | 'erro' | 'info'} | null>(null);

  const isAdmin = perfilAtivo.perfil === 'Admin';
  const isComercial = perfilAtivo.perfil === 'Comercial' || isAdmin;
  const isSuporte = perfilAtivo.perfil === 'Suporte' || isAdmin;

  const showToast = (msg: string, tipo: 'sucesso' | 'erro' | 'info' = 'sucesso') => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 4000); };
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // --- ESTADOS DO CRM E VISUALIZAÇÃO ---
  const [aba, setAba] = useState<"dashboard" | "propostas" | "clientes" | "contratos" | "tarefas" | "leads" | "templates">("dashboard");
  const [vistaPropostas, setVistaPropostas] = useState<"kanban" | "tabela">("kanban");
  const [propostas, setPropostas] = useState<PropostaDB[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<TarefaDB[]>([]);
  const [contratos, setContratos] = useState<ContratoDB[]>([]);
  const [templates, setTemplates] = useState<TemplateDB[]>([]);
  const [clientesBase, setClientesBase] = useState<ClienteDB[]>([]);
  const [interacoes, setInteracoes] = useState<InteracaoDB[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroDias, setFiltroDias] = useState<number>(30);
  const [filtroTipoCliente, setFiltroTipoCliente] = useState<"Todos" | "Cliente" | "Lead" | "Parceiro">("Todos");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [enviando, setEnviando] = useState<number | null>(null);

  // --- ESTADOS DE MODAIS ---
  const [modalComunicado, setModalComunicado] = useState(false);
  const [formComunicado, setFormComunicado] = useState({ publico: "Cliente", assunto: "", mensagem: "" });
  const [progressoEmail, setProgressoEmail] = useState({ ativo: false, total: 0, enviado: 0 });
  const [filaWpp, setFilaWpp] = useState<ClienteDB[]>([]);
  
  const [modalEnvioProposta, setModalEnvioProposta] = useState<{ativo: boolean, tipo: 'Email' | 'WhatsApp', prop: PropostaDB | null}>({ativo: false, tipo: 'Email', prop: null});
  const [formEnvioMensagem, setFormEnvioMensagem] = useState({ templateId: '', texto: '' });

  const [modalTarefa, setModalTarefa] = useState(false);
  const [formTarefa, setFormTarefa] = useState<Partial<TarefaDB>>({ titulo: "", descricao: "", data_vencimento: "", status: "Pendente", usuario_email: "", nome_referencia: "" });
  const [modalContrato, setModalContrato] = useState(false);
  const [formContrato, setFormContrato] = useState<Partial<ContratoDB>>({ cliente_nome: "", valor_mensal: 0, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: "", motivo_cancelamento: "" });
  const [modalTemplate, setModalTemplate] = useState(false);
  const [formTemplate, setFormTemplate] = useState<Partial<TemplateDB>>({ nome: "", tipo: "WhatsApp", conteudo: "" });
  const [modalClienteForm, setModalClienteForm] = useState(false);
  const [formCliente, setFormCliente] = useState<Partial<ClienteDB>>({ nome: "", email: "", telefone: "", whatsapp: "", documento: "", tipo: "Cliente", codigo: "", filial: "Matriz" });
  
  const [clienteDetalhe, setClienteDetalhe] = useState<any>(null);
  const [formInteracao, setFormInteracao] = useState({ tipo: "Nota", descricao: "" });
  
  const [modalPerda, setModalPerda] = useState(false);
  const [formPerda, setFormPerda] = useState({ id: 0, motivo: "", obs: "" });

  // ─── AUTENTICAÇÃO E CARREGAMENTO ─────────────────────────────────────────
  useEffect(() => { const t = localStorage.getItem("tema_ssti"); if (t === "light" || t === "dark") setTema(t); }, []);
  const alternarTema = () => { const n = tema === "dark" ? "light" : "dark"; setTema(n); localStorage.setItem("tema_ssti", n); };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      setSession(session);
      let emailUser = session.user.email || "";
      const { data: perfilData } = await supabase.from('perfis').select('*').eq('email', emailUser).single();
      let pFinal: PerfilUsuario = { email: emailUser, perfil: 'Comercial', filial: 'Matriz' };
      if (perfilData) { pFinal = { email: emailUser, perfil: perfilData.perfil, filial: perfilData.filial }; } 
      else { const isDono = emailUser === 'fabiano@simplessolucao.com.br'; pFinal = { email: emailUser, perfil: isDono ? 'Admin' : 'Comercial', filial: 'Matriz' }; await supabase.from('perfis').insert([{ id: session.user.id, email: emailUser, perfil: pFinal.perfil, filial: 'Matriz' }]); }
      setPerfilAtivo(pFinal); setFormTarefa(prev => ({ ...prev, usuario_email: emailUser }));
      if (pFinal.perfil === 'Admin' || pFinal.perfil === 'Comercial') setAba('dashboard'); else setAba('tarefas');
      setCarregandoAuth(false);
    });
  }, [router]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/"); };

  const carregarTudo = async () => {
    if (!session || carregandoAuth) return;
    setCarregando(true);
    let qProp = supabase.from('propostas').select('*').order('created_at', { ascending: false });
    let qCli = supabase.from('clientes').select('*').order('nome', { ascending: true });
    let qCont = supabase.from('contratos').select('*').order('created_at', { ascending: false });
    let qTar = supabase.from('tarefas').select('*').order('data_vencimento', { ascending: true });
    let qLead = supabase.from('leads').select('*').order('created_at', { ascending: false });
    let qInt = supabase.from('interacoes').select('*').order('created_at', { ascending: false });
    
    if (!isAdmin && perfilAtivo.filial !== 'Matriz') { qProp = qProp.eq('filial', perfilAtivo.filial); qCli = qCli.eq('filial', perfilAtivo.filial); qCont = qCont.eq('filial', perfilAtivo.filial); }
    if (!isAdmin) qTar = qTar.eq('usuario_email', perfilAtivo.email);

    const [p, l, t, c, tpl, cliBase, ints] = await Promise.all([
      isComercial ? qProp : Promise.resolve({ data: [] }), isComercial ? qLead : Promise.resolve({ data: [] }), qTar, isAdmin ? qCont : Promise.resolve({ data: [] }), isAdmin ? supabase.from('templates').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }), qCli, qInt 
    ]);
    
    if (p.data) setPropostas(p.data); if (l.data) setLeads(l.data); if (c.data) setContratos(c.data);
    if (tpl.data) setTemplates(tpl.data); if (cliBase.data) setClientesBase(cliBase.data); if (t.data) setTarefas(t.data);
    if (ints.data) setInteracoes(ints.data);
    
    setCarregando(false);
  };
  useEffect(() => { carregarTudo(); }, [session, carregandoAuth, filtroDias, perfilAtivo]);

  // ─── CÁLCULOS DO DASHBOARD E AGRUPAMENTOS ──────────────────────────────
  const limiteFiltro = new Date(); if (filtroDias > 0) limiteFiltro.setDate(limiteFiltro.getDate() - filtroDias);
  const pFiltradas = propostas.filter(p => filtroDias === 0 || new Date(p.created_at) >= limiteFiltro);
  
  const propostasFechadas = pFiltradas.filter(p => p.status === 'fechada');
  const propostasPerdidas = pFiltradas.filter(p => p.status === 'perdida');
  const propostasAbertas = pFiltradas.filter(p => !p.status || p.status === 'aberta');
  const propostasEnviadas = pFiltradas.filter(p => p.status === 'enviada' || p.status === 'negociacao');
  
  const taxaConversao = pFiltradas.length > 0 ? (propostasFechadas.length / pFiltradas.length) * 100 : 0;
  const mrrAtivo = contratos.filter(c => c.status === 'Ativo').reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  const dadosMotivosPerda = useMemo(() => {
    const contagem: Record<string, number> = {};
    propostasPerdidas.forEach(p => { const m = p.motivo_perda || "Não informado"; contagem[m] = (contagem[m] || 0) + 1; });
    return Object.entries(contagem).map(([name, value]) => ({ name, value }));
  }, [propostasPerdidas]);

  const COLORS_PIE = ['#f87171', '#f59e0b', '#4A90D9', '#a855f7', '#64748b'];

  const clientesAgrupados = useMemo(() => {
    const mapa = new Map<string, any>();
    // Clientes oficiais
    clientesBase.forEach(c => { const key = c.nome.trim().toUpperCase(); mapa.set(key, { ...c, propostas: [], contratos: [], tarefas: [], interacoes: interacoes.filter(i=>i.cliente_nome.toUpperCase()===key) }); });
    // Propostas não registadas
    propostas.forEach(p => {
      const key = p.cliente.trim().toUpperCase();
      if (!mapa.has(key)) mapa.set(key, { nome: p.cliente, email: p.email, contato: p.contato, telefone: p.telefone, tipo: 'Lead', score: 0, propostas: [], contratos: [], tarefas: [], interacoes: interacoes.filter(i=>i.cliente_nome.toUpperCase()===key) });
      mapa.get(key).propostas.push(p);
    });
    // Contratos não registados
    contratos.forEach(c => {
      const key = c.cliente_nome.trim().toUpperCase();
      if (!mapa.has(key)) mapa.set(key, { nome: c.cliente_nome, tipo: 'Cliente', score: 0, propostas: [], contratos: [], tarefas: [], interacoes: interacoes.filter(i=>i.cliente_nome.toUpperCase()===key) });
      mapa.get(key).contratos.push(c);
      mapa.get(key).tipo = 'Cliente';
    });
    // Leads do site
    leads.forEach(l => {
      const key = l.empresa.trim().toUpperCase();
      if (!mapa.has(key)) mapa.set(key, { nome: l.empresa, email: l.email, contato: l.nome, telefone: l.telefone, tipo: 'Lead', score: 0, propostas: [], contratos: [], tarefas: [], interacoes: interacoes.filter(i=>i.cliente_nome.toUpperCase()===key) });
    });

    tarefas.forEach(t => {
      if (t.nome_referencia) { const key = t.nome_referencia.trim().toUpperCase(); if (mapa.has(key)) mapa.get(key).tarefas.push(t); }
    });

    let lista = Array.from(mapa.values()).sort((a,b) => (b.score || 0) - (a.score || 0) || a.nome.localeCompare(b.nome));
    
    // Filtro por Categoria
    if (filtroTipoCliente !== "Todos") lista = lista.filter(c => c.tipo === filtroTipoCliente);
    
    // Filtro por Texto (Pesquisa)
    if (buscaCliente) {
      const b = buscaCliente.toLowerCase();
      lista = lista.filter(c => 
        c.nome?.toLowerCase().includes(b) || 
        c.email?.toLowerCase().includes(b) || 
        c.contato?.toLowerCase().includes(b) ||
        c.codigo?.toLowerCase().includes(b)
      );
    }
    
    return lista;
  }, [propostas, contratos, tarefas, clientesBase, leads, filtroTipoCliente, buscaCliente, interacoes]);

  const abrirNotasDaProposta = (prop: PropostaDB) => {
    const cliente = clientesAgrupados.find(c => c.nome.toUpperCase() === prop.cliente.trim().toUpperCase());
    if (cliente) { setClienteDetalhe(cliente); } else { showToast("Erro ao abrir a ficha do cliente associado.", "erro"); }
  };

  // ─── COMUNICADOS EM MASSA (EMAIL / FILA WPP) ─────────────────────────────
  const dispararEmailsMassa = async () => {
    const alvos = formComunicado.publico === "Todos" ? clientesBase.filter(c => c.email && c.email.includes("@")) : clientesBase.filter(c => c.tipo === formComunicado.publico && c.email && c.email.includes("@"));
    if (alvos.length === 0) return showToast("Nenhum e-mail válido encontrado para este público.", "erro");
    if (!confirm(`Deseja disparar este e-mail para ${alvos.length} contactos?`)) return;

    setProgressoEmail({ ativo: true, total: alvos.length, enviado: 0 });
    let enviados = 0;
    for (const cli of alvos) {
      try {
        const trackingPixel = `<img src="${window.location.origin}/api/track?action=open&id=${cli.id}" width="1" height="1" style="display:none;" />`;
        let htmlCorpo = `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;"><div style="background: #0a1628; padding: 20px; text-align: center; color: #fff;"><h2 style="margin: 0;">Aviso Importante</h2></div><div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none;"><p>Olá <strong>${cli.nome}</strong>,</p><div style="white-space: pre-wrap; font-size: 15px; margin: 20px 0;">${formComunicado.mensagem}</div><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" /><p style="font-size: 13px; color: #666;">Atenciosamente,<br/><strong>Equipa | Simples Solução TI</strong></p></div>${trackingPixel}</div>`;
        await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: cli.email, subject: formComunicado.assunto, html: htmlCorpo }) });
        enviados++; setProgressoEmail(p => ({ ...p, enviado: enviados })); await new Promise(r => setTimeout(r, 500));
      } catch (e) {}
    }
    setProgressoEmail({ ativo: false, total: 0, enviado: 0 }); setModalComunicado(false); showToast(`Disparo concluído! ${enviados} e-mails enviados.`, "sucesso");
  };

  const gerarFilaWhatsapp = () => {
    const alvos = formComunicado.publico === "Todos" ? clientesBase.filter(c => c.whatsapp || c.telefone) : clientesBase.filter(c => c.tipo === formComunicado.publico && (c.whatsapp || c.telefone));
    if (alvos.length === 0) return showToast("Nenhum cliente com número válido encontrado.", "erro");
    setFilaWpp(alvos); setModalComunicado(false); showToast(`Fila gerada com ${alvos.length} clientes prontos para envio.`, "info");
  };

  const enviarWhatsAppDaFila = (cli: ClienteDB) => {
    const numero = (cli.whatsapp || cli.telefone || "").replace(/\D/g, "");
    if (!numero) return showToast(`Número inválido para ${cli.nome}`, "erro");
    const texto = `Olá *${cli.nome}*,\n\n*Aviso SSTI:*\n${formComunicado.mensagem}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank');
    setFilaWpp(prev => prev.filter(c => c.id !== cli.id));
  };

  // ─── GERADOR DE PDF E ENVIO INTELIGENTE DE MENSAGENS ─────────────────────
  const processarTemplate = (conteudo: string, nome: string, empresa: string, valor: number) => { if (!conteudo) return ""; return conteudo.replace(/\{\{nome\}\}/g, nome || "Cliente").replace(/\{\{empresa\}\}/g, empresa || "Empresa").replace(/\{\{valor\}\}/g, fmt(valor)); };
  
  const gerarHtmlProposta = (prop: PropostaDB) => {
    const dataFormatada = new Date(prop.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' }); const obs = prop.dados?.obs || "";
    return `<div style="font-family: Arial, sans-serif; color: #333; padding: 40px; font-size: 14px; line-height: 1.6; max-width: 800px; margin: 0 auto; background: #fff;"><div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 50px;"><div><h2 style="margin: 0; color: #0a1628; font-size: 26px;">Simples Solução TI</h2></div><div style="text-align: right; font-size: 12px; color: #666;"><strong>Proposta:</strong> ${prop.numero}<br><strong>Data:</strong> ${dataFormatada}<br><strong>Empresa:</strong> ${prop.cliente}</div></div><h1 style="color: #0a1628; font-size: 24px; border-bottom: 2px solid #4A90D9; padding-bottom: 10px; margin-bottom: 20px;">PROPOSTA DE SERVIÇOS TÉCNICOS</h1><p>Rio de Janeiro, ${dataFormatada}</p><p>Prezada(o) <strong>${prop.contato || 'Cliente'}</strong>,</p><p>Agradecemos a oportunidade de apresentar a nossa empresa e discutir possíveis caminhos para o futuro da <strong>${prop.cliente}</strong>.</p><p>Este documento tem como objetivo definir o escopo de trabalho a ser empregado na prestação de serviço de suporte de informática à <strong>${prop.cliente}</strong>.</p><div style="margin-top: 40px; margin-bottom: 40px; font-weight: bold;">Fabiano Lucio<br><span style="font-weight: normal; font-size: 13px; color: #555;">Diretor Comercial<br>(21) 3529-7993<br>fabiano@simplessolucao.com.br<br>www.simplessolucao.com.br</span></div><h2 style="color: #4A90D9; font-size: 20px; margin-top: 30px; margin-bottom: 15px;">Proposta Comercial</h2><table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; font-size: 14px;"><tr><th style="background: #0a1628; color: #fff; padding: 12px; text-align: left;">Descrição do Serviço</th><th style="background: #0a1628; color: #fff; padding: 12px; text-align: right; width: 200px;">Valor Mensal</th></tr><tr><td style="padding: 20px 12px; font-size: 16px; font-weight: bold; background: #f8f9fa; border-top: 2px solid #0a1628; border-bottom: 2px solid #0a1628;">Manutenção de TI</td><td style="text-align: right; color: #4A90D9; padding: 20px 12px; font-size: 16px; font-weight: bold; background: #f8f9fa; border-top: 2px solid #0a1628; border-bottom: 2px solid #0a1628;">${fmt(prop.valor)}</td></tr></table>${obs ? `<h3 style="color: #0a1628; font-size: 16px; margin-top: 25px;">Observações Adicionais</h3><p style="background: #f8f9fa; padding: 15px; border-left: 4px solid #4A90D9;">${obs.replace(/\n/g, '<br>')}</p>` : ""}</div>`;
  };

  const abrirModalEnvio = (prop: PropostaDB, tipo: 'Email' | 'WhatsApp') => {
    setModalEnvioProposta({ ativo: true, tipo, prop });
    setFormEnvioMensagem({ templateId: '', texto: '' });
  };

  useEffect(() => {
    if (modalEnvioProposta.prop && formEnvioMensagem.templateId) {
      if (formEnvioMensagem.templateId === 'custom') { setFormEnvioMensagem(prev => ({ ...prev, texto: '' })); } 
      else {
        const tpl = templates.find(t => t.id.toString() === formEnvioMensagem.templateId);
        if (tpl) {
          const txt = processarTemplate(tpl.conteudo, modalEnvioProposta.prop.contato, modalEnvioProposta.prop.cliente, modalEnvioProposta.prop.valor);
          setFormEnvioMensagem(prev => ({ ...prev, texto: txt }));
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
        showToast("A processar PDF e a enviar e-mail...", "info");
        
        let pdfBase64 = "";
        try {
          if (!(window as any).html2pdf) { await new Promise((resolve) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'; s.onload = resolve; document.body.appendChild(s); }); }
          const el = document.createElement('div'); el.innerHTML = gerarHtmlProposta(prop);
          const uri = await (window as any).html2pdf().set({ margin: 10, filename: `Proposta.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(el).outputPdf('datauristring');
          pdfBase64 = uri.split(',')[1];
        } catch (err) {}
        
        const cb = clientesBase.find(c => c.nome.toUpperCase() === prop.cliente.trim().toUpperCase());
        const trackingPixel = cb ? `<img src="${window.location.origin}/api/track?action=open&id=${cb.id}" width="1" height="1" style="display:none;" />` : '';
        let corpoEmail = `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">${textoFinal.replace(/\n/g, '<br/>')}</div>${trackingPixel}`;

        const res = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: prop.email, subject: `Proposta Comercial SSTI - ${prop.cliente}`, html: corpoEmail, fileName: `Proposta_SSTI.pdf`, pdfBase64 }) });
        
        if (res.ok) {
          await supabase.from('propostas').update({ status_envio: 'enviado', status: prop.status === 'aberta' || !prop.status ? 'enviada' : prop.status }).eq('id', prop.id);
          await supabase.from('interacoes').insert([{ cliente_nome: prop.cliente, usuario_email: perfilAtivo.email, tipo: 'Email', descricao: `Proposta enviada por E-mail:\n\n${textoFinal}` }]);
          try {
            const { data: log } = await supabase.from('automacoes_log').select('id').eq('tipo_regra', 'PROPOSTA_ENVIADA_FOLLOWUP').eq('referencia_id', prop.id);
            if (!log || log.length === 0) {
              await supabase.from('automacoes_log').insert([{ tipo_regra: 'PROPOSTA_ENVIADA_FOLLOWUP', referencia_id: prop.id, tabela_referencia: 'propostas', acao_executada: 'Tarefa Follow-up' }]);
              const dataVenc = new Date(); dataVenc.setDate(dataVenc.getDate() + 3); dataVenc.setHours(10, 0, 0, 0);
              await supabase.from('tarefas').insert([{ titulo: `📞 Follow-up: ${prop.cliente}`, descricao: `Validar retorno da proposta ${prop.numero}.`, data_vencimento: dataVenc.toISOString(), status: 'Pendente', usuario_email: session?.user?.email, nome_referencia: prop.cliente, proposta_id: prop.id }]);
            }
          } catch (e) {}
          showToast("E-mail enviado e registado no histórico!", "sucesso"); 
        } else { showToast(`Erro ao enviar e-mail.`, "erro"); return; }
      } 
      else if (tipo === 'WhatsApp') {
        const numero = (prop.telefone || "").replace(/\D/g, "");
        if (!numero) return showToast("Número de telefone inválido.", "erro");
        window.open(`https://wa.me/${numero}?text=${encodeURIComponent(textoFinal)}`, '_blank');
        await supabase.from('interacoes').insert([{ cliente_nome: prop.cliente, usuario_email: perfilAtivo.email, tipo: 'WhatsApp', descricao: `Proposta enviada no WhatsApp:\n\n${textoFinal}` }]);
        showToast("WhatsApp aberto e registado no histórico!", "sucesso");
      }

      setModalEnvioProposta({ ativo: false, tipo: 'Email', prop: null });
      carregarTudo();

    } catch (e) { showToast("Erro de conexão.", "erro"); } finally { setEnviando(null); }
  };

  const visualizarProposta = (prop: PropostaDB) => { const h = gerarHtmlProposta(prop); const w = window.open("", "_blank")!; w.document.write(`<html><body>${h}</body></html>`); w.document.close(); setTimeout(() => w.print(), 500); };

  // ─── AÇÕES DE KANBAN E STATUS ─────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, prop: PropostaDB) => { e.dataTransfer.setData("propId", prop.id.toString()); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDropStatus = async (e: React.DragEvent, novoStatus: string) => {
    e.preventDefault(); const propId = Number(e.dataTransfer.getData("propId")); const prop = propostas.find(p => p.id === propId);
    if (!prop || prop.status === novoStatus) return;
    if (novoStatus === 'fechada') { alterarStatusParaGanho(prop); } else if (novoStatus === 'perdida') { abrirModalPerda(prop); } else {
      await supabase.from('propostas').update({ status: novoStatus }).eq('id', prop.id); showToast(`Proposta movida para ${novoStatus.toUpperCase()}`, "info"); carregarTudo();
    }
  };

  const alterarStatusParaGanho = async (prop: PropostaDB) => {
    await supabase.from('propostas').update({ status: 'fechada' }).eq('id', prop.id);
    try {
      await supabase.from('contratos').insert([{ proposta_id: prop.id, cliente_nome: prop.cliente, valor_mensal: prop.valor, status: 'Ativo', data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: 'Gerado automaticamente', filial: prop.filial || perfilAtivo.filial }]);
      await supabase.from('tarefas').insert([{ titulo: `🚀 Onboarding: ${prop.cliente}`, descricao: `Novo cliente fechado!`, data_vencimento: new Date().toISOString(), status: 'Pendente', usuario_email: session?.user?.email, nome_referencia: prop.cliente, proposta_id: prop.id }]);
      const cEx = clientesBase.find(c => c.nome.toUpperCase() === prop.cliente.trim().toUpperCase());
      if (!cEx) { await supabase.from('clientes').insert([{ nome: prop.cliente, email: prop.email, telefone: prop.telefone, tipo: 'Cliente', filial: prop.filial || perfilAtivo.filial }]); } else if (cEx.tipo === 'Lead') { await supabase.from('clientes').update({ tipo: 'Cliente' }).eq('id', cEx.id); }
      showToast("Negócio Fechado! Contrato e Onboarding ativados.", "sucesso");
    } catch (e) {} carregarTudo();
  };

  const abrirModalPerda = (prop: PropostaDB) => { setFormPerda({ id: prop.id, motivo: "", obs: "" }); setModalPerda(true); };
  const confirmarPerda = async (e: React.FormEvent) => { e.preventDefault(); if (!formPerda.motivo) return showToast("Selecione um motivo.", "erro"); await supabase.from('propostas').update({ status: 'perdida', motivo_perda: formPerda.motivo, obs_perda: formPerda.obs }).eq('id', formPerda.id); showToast("Proposta marcada como perdida.", "info"); setModalPerda(false); carregarTudo(); };
  const excluirProposta = async (id: number, nome: string) => { if (confirm(`Excluir permanentemente ${nome}?`)) { await supabase.from('propostas').delete().eq('id', id); showToast("Proposta excluída.", "info"); carregarTudo(); }};

  // ─── AÇÕES DA TIMELINE E CRUD ─────────────────────────────────────────────
  const salvarInteracao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteDetalhe || !formInteracao.descricao) return;
    await supabase.from('interacoes').insert([{ cliente_nome: clienteDetalhe.nome, usuario_email: perfilAtivo.email, tipo: formInteracao.tipo, descricao: formInteracao.descricao }]);
    setFormInteracao({ tipo: "Nota", descricao: "" });
    showToast("Nota adicionada ao histórico!", "sucesso");
    setClienteDetalhe(null); setAba('dashboard'); carregarTudo();
  };

  const salvarClienteBase = async (e: React.FormEvent) => { e.preventDefault(); if (formCliente.id) await supabase.from('clientes').update(formCliente).eq('id', formCliente.id); else await supabase.from('clientes').insert([{...formCliente, filial: formCliente.filial || perfilAtivo.filial}]); showToast("Registo guardado.", "sucesso"); setModalClienteForm(false); carregarTudo(); };
  const abrirNovoContrato = (prop?: PropostaDB) => { if (prop) setFormContrato({ proposta_id: prop.id, cliente_nome: prop.cliente, valor_mensal: prop.valor, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: `Proposta ${prop.numero}`, motivo_cancelamento: "" }); else setFormContrato({ cliente_nome: "", valor_mensal: 0, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: "", motivo_cancelamento: "" }); setModalContrato(true); };
  const editarContrato = (c: ContratoDB) => { setFormContrato({ ...c }); setModalContrato(true); };
  const salvarContrato = async (e: React.FormEvent) => { e.preventDefault(); if (formContrato.status === 'Cancelado' && !formContrato.motivo_cancelamento) return showToast("Motivo do cancelamento é obrigatório.", "erro"); const payload = { ...formContrato, filial: formContrato.filial || perfilAtivo.filial, updated_at: new Date().toISOString() }; if (formContrato.id) { await supabase.from('contratos').update(payload).eq('id', formContrato.id); showToast("Contrato atualizado.", "sucesso"); } else { await supabase.from('contratos').insert([payload]); showToast("Novo contrato ativado.", "sucesso"); } setModalContrato(false); carregarTudo(); };
  const abrirNovaTarefa = (referencia?: string, leadId?: number, propostaId?: number) => { setFormTarefa({ titulo: "", descricao: "", data_vencimento: "", status: "Pendente", usuario_email: session?.user?.email || "", nome_referencia: referencia || "", lead_id: leadId, proposta_id: propostaId }); setModalTarefa(true); };
  const editarTarefa = (t: TarefaDB) => { const dataFormatada = new Date(t.data_vencimento).toISOString().slice(0, 16); setFormTarefa({ ...t, data_vencimento: dataFormatada }); setModalTarefa(true); };
  const salvarTarefa = async (e: React.FormEvent) => { e.preventDefault(); const payload = { ...formTarefa, updated_at: new Date().toISOString() }; if (formTarefa.id) await supabase.from('tarefas').update(payload).eq('id', formTarefa.id); else await supabase.from('tarefas').insert([payload]); showToast("Tarefa gravada.", "sucesso"); setModalTarefa(false); carregarTudo(); };
  const excluirTarefa = async (id: number) => { if (confirm("Excluir tarefa?")) { await supabase.from('tarefas').delete().eq('id', id); showToast("Tarefa apagada.", "info"); carregarTudo(); } };
  const alterarStatusTarefaRapido = async (id: number, novoStatus: string) => { await supabase.from('tarefas').update({ status: novoStatus, data_conclusao: novoStatus === 'Concluído' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id); showToast(`Tarefa marcada como ${novoStatus}.`, "sucesso"); carregarTudo(); };
  const enviarWhatsAppLead = (lead: any) => { window.open(`https://wa.me/${lead.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(`Olá ${lead.nome}, tudo bem? Sou da Simples Solução TI.`)}`, '_blank'); };
  const salvarTemplate = async (e: React.FormEvent) => { e.preventDefault(); if (formTemplate.id) await supabase.from('templates').update(formTemplate).eq('id', formTemplate.id); else await supabase.from('templates').insert([formTemplate]); showToast("Template salvo.", "sucesso"); setModalTemplate(false); carregarTudo(); };
  const excluirTemplate = async (id: number) => { if (confirm("Excluir template?")) { await supabase.from('templates').delete().eq('id', id); showToast("Template excluído.", "info"); carregarTudo(); }};

  if (carregandoAuth) return <div style={{minHeight:"100vh",background:"#080f1e",display:"flex",alignItems:"center",justifyContent:"center",color:"#4A90D9"}}>A validar permissões e carregar sistema...</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <style>{`:root{--bg-main:${tema==='dark'?'#080f1e':'#f4f7f9'};--bg-sidebar:${tema==='dark'?'#050a14':'#ffffff'};--bg-card:${tema==='dark'?'rgba(255,255,255,0.02)':'#ffffff'};--text-primary:${tema==='dark'?'#ffffff':'#0f172a'};--text-secondary:${tema==='dark'?'rgba(255,255,255,0.5)':'#64748b'};--border-light:${tema==='dark'?'rgba(255,255,255,0.05)':'#e2e8f0'}} *{box-sizing:border-box;margin:0;padding:0} body{background:var(--bg-main);color:var(--text-primary);font-family:'Outfit',sans-serif}.sidebar{width:260px;background:var(--bg-sidebar);border-right:1px solid var(--border-light);position:fixed;top:0;bottom:0;left:0;display:flex;flex-direction:column;z-index:10}.main-content{flex:1;margin-left:260px;padding:40px}.nav-menu{padding:20px;flex:1;display:flex;flex-direction:column;gap:8px}.nav-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;color:var(--text-secondary);cursor:pointer;border:none;background:transparent;font-weight:600;width:100%;text-align:left}.nav-item.active{background:rgba(74,144,217,0.1);color:#4A90D9}.grid-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:30px}.metric-card{background:var(--bg-card);border:1px solid var(--border-light);border-radius:16px;padding:24px}.table-wrapper{background:var(--bg-card);border:1px solid var(--border-light);border-radius:16px;overflow:hidden;margin-bottom:30px;}table{width:100%;border-collapse:collapse}th{background:rgba(0,0,0,0.1);padding:16px;font-size:12px;text-transform:uppercase;color:var(--text-secondary);text-align:left}td{padding:16px;border-bottom:1px solid var(--border-light);font-size:14px}.badge-status{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase}.btn-action{padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--border-light);background:rgba(255,255,255,0.05);color:var(--text-primary);margin-right:4px;margin-bottom:4px}.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100}.modal-content{background:var(--bg-sidebar);padding:30px;border-radius:20px;width:100%;max-width:550px;max-height:90vh;overflow-y:auto}.input-modal{width:100%;background:var(--bg-main);border:1px solid var(--border-light);color:var(--text-primary);padding:12px;border-radius:8px;margin-bottom:15px;font-family:'Outfit',sans-serif} .toast{position:fixed;bottom:30px;right:30px;padding:16px 24px;border-radius:12px;color:#fff;font-weight:600;z-index:9999;box-shadow:0 10px 25px rgba(0,0,0,0.2);animation:slideIn .3s forwards;display:flex;align-items:center;gap:10px;} @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}} .kanban-board { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; } .kanban-col { flex: 1; min-width: 280px; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 12px; display: flex; flex-direction: column; } .kanban-header { padding: 15px; border-bottom: 1px solid var(--border-light); font-weight: 700; font-size: 13px; text-transform: uppercase; color: var(--text-secondary); display: flex; justify-content: space-between;} .kanban-body { padding: 15px; flex: 1; display: flex; flex-direction: column; gap: 15px; min-height: 200px; } .kanban-card { background: var(--bg-main); border: 1px solid var(--border-light); border-radius: 8px; padding: 15px; cursor: grab; transition: transform 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.05); } .kanban-card:active { transform: scale(0.98); cursor: grabbing; border-color: #4A90D9; }`}</style>

      {toast && <div className="toast" style={{ background: toast.tipo === 'sucesso' ? '#22c55e' : toast.tipo === 'erro' ? '#f87171' : '#4A90D9' }}>{toast.tipo === 'sucesso' ? '✅' : toast.tipo === 'erro' ? '❌' : 'ℹ️'} {toast.msg}</div>}

      {/* FILA DO WHATSAPP */}
      {filaWpp.length > 0 && (
        <div style={{ position: "fixed", bottom: 20, left: 280, width: 380, background: "var(--bg-sidebar)", border: "1px solid #4A90D9", borderRadius: 16, zIndex: 50, boxShadow: "0 10px 30px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", maxHeight: 500 }}>
          <div style={{ background: "#4A90D9", color: "#fff", padding: "12px 20px", borderTopLeftRadius: 15, borderTopRightRadius: 15, fontWeight: 700, display: "flex", justifyContent: "space-between" }}><span>💬 Fila de Envio WhatsApp ({filaWpp.length})</span><button onClick={() => setFilaWpp([])} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontWeight: "bold" }}>X</button></div>
          <div style={{ padding: 15, overflowY: "auto", flex: 1 }}>
            {filaWpp.map(c => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", borderBottom: "1px solid var(--border-light)" }}>
                <div><div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{c.nome}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.whatsapp || c.telefone}</div></div>
                <button onClick={() => enviarWhatsAppDaFila(c)} style={{ background: "#22c55e", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Enviar ›</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div style={{padding:"30px",textAlign:"center"}}><img src={tema==='dark'?'/Logo-negativo.webp':'/icon.png'} style={{maxHeight:"40px", borderRadius: "8px"}}/></div>
        <nav className="nav-menu">
          {isComercial && <button className={`nav-item ${aba==='dashboard'?'active':''}`} onClick={()=>setAba('dashboard')}>📈 Dashboard Global</button>}
          {isComercial && <button className={`nav-item ${aba==='propostas'?'active':''}`} onClick={()=>setAba('propostas')}>🎯 Funil de Vendas</button>}
          <button className={`nav-item ${aba==='clientes'?'active':''}`} onClick={()=>setAba('clientes')}>👥 Base de Clientes</button>
          {isAdmin && <button className={`nav-item ${aba==='contratos'?'active':''}`} onClick={()=>setAba('contratos')}>📄 Financeiro (MRR)</button>}
          <button className={`nav-item ${aba==='tarefas'?'active':''}`} onClick={()=>setAba('tarefas')}>✅ Minhas Tarefas</button>
          {isAdmin && <button className={`nav-item ${aba==='templates'?'active':''}`} onClick={()=>setAba('templates')}>📝 Templates</button>}
          {isComercial && <button className="nav-item" style={{color:"#4A90D9",marginTop:"20px",border:"1px dashed #4A90D9"}} onClick={()=>router.push('/preco')}>+ Nova Proposta</button>}
        </nav>
        <div style={{padding:"20px",borderTop:"1px solid var(--border-light)", textAlign:"center"}}>
           <div style={{fontSize:"12px",color:"#4A90D9", fontWeight:"bold", marginBottom: 4}}>Simples Solução TI</div>
           <div style={{fontSize:"11px",color:"var(--text-primary)", marginBottom: 4}}>{perfilAtivo.perfil} | {perfilAtivo.filial}</div>
           <button onClick={handleLogout} style={{color:"#f87171",background:"none",border:"none",cursor:"pointer",fontSize:"12px",marginTop:"12px", width:"100%", padding:"8px", borderTop:"1px solid rgba(248,113,113,0.2)"}}>Sair</button>
           <div style={{fontSize:"10px",color:"var(--text-secondary)", marginTop: "15px"}}>v1.01</div>
        </div>
      </aside>

      <main className="main-content">
        <header style={{display:"flex",justifyContent:"space-between",marginBottom:"30px"}}>
          <h1 style={{fontSize:"24px"}}>{aba.toUpperCase()}</h1>
          <div style={{display:"flex",gap:"10px"}}>
            <button onClick={alternarTema} className="btn-action">{tema==='dark'?'☀️ Claro':'🌙 Escuro'}</button>
            {(aba === 'dashboard' || aba === 'propostas') && (
              <select value={filtroDias} onChange={e=>setFiltroDias(Number(e.target.value))} style={{background:"var(--bg-card)",color:"var(--text-primary)",border:"1px solid var(--border-light)",borderRadius:"8px",padding:"0 10px"}}>
                <option value={30}>Últimos 30 dias</option><option value={90}>Últimos 3 Meses</option><option value={0}>Sempre</option>
              </select>
            )}
            {aba === 'propostas' && (
              <div style={{display:"flex", background:"var(--bg-card)", border:"1px solid var(--border-light)", borderRadius:8, overflow:"hidden"}}>
                <button onClick={()=>setVistaPropostas('kanban')} style={{background: vistaPropostas==='kanban'?'rgba(74,144,217,0.2)':'transparent', color: vistaPropostas==='kanban'?'#4A90D9':'var(--text-secondary)', border:"none", padding:"8px 16px", cursor:"pointer", fontWeight:600}}>Kanban</button>
                <button onClick={()=>setVistaPropostas('tabela')} style={{background: vistaPropostas==='tabela'?'rgba(74,144,217,0.2)':'transparent', color: vistaPropostas==='tabela'?'#4A90D9':'var(--text-secondary)', border:"none", padding:"8px 16px", cursor:"pointer", fontWeight:600}}>Tabela</button>
              </div>
            )}
          </div>
        </header>

        {aba === 'dashboard' && isComercial && (
          <>
            <div className="grid-metrics">
              {isAdmin && <div className="metric-card"><div style={{fontSize:"12px",color:"var(--text-secondary)"}}>MRR ATIVO</div><div style={{fontSize:"28px",fontWeight:800}}>{fmt(mrrAtivo)}</div></div>}
              <div className="metric-card"><div style={{fontSize:"12px",color:"var(--text-secondary)"}}>CONVERSÃO GERAL</div><div style={{fontSize:"28px",fontWeight:800,color:"#4A90D9"}}>{taxaConversao.toFixed(1)}%</div></div>
              <div className="metric-card"><div style={{fontSize:"12px",color:"var(--text-secondary)"}}>GANHAS (VALOR)</div><div style={{fontSize:"28px",fontWeight:800,color:"#22c55e"}}>{fmt(propostasFechadas.reduce((a,b)=>a+b.valor,0))}</div></div>
              <div className="metric-card"><div style={{fontSize:"12px",color:"var(--text-secondary)"}}>PERDIDAS (QTD)</div><div style={{fontSize:"28px",fontWeight:800,color:"#f87171"}}>{propostasPerdidas.length}</div></div>
            </div>

            <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px"}}>
              <div className="metric-card" style={{height: 350}}>
                <div style={{fontSize:"14px", fontWeight:700, color:"var(--text-secondary)", marginBottom: 20}}>📊 Funil de Negociação</div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Criadas', qtd: pFiltradas.length },
                    { name: 'Enviadas', qtd: propostasEnviadas.length + propostasFechadas.length },
                    { name: 'Ganhas', qtd: propostasFechadas.length }
                  ]} layout="vertical" margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 12}} width={80} />
                    <ChartTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{background:'#0a1628', border:'none', borderRadius:8, color:'#fff'}} />
                    <Bar dataKey="qtd" fill="#4A90D9" radius={[0, 4, 4, 0]} barSize={30} label={{ position: 'right', fill: 'var(--text-primary)' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="metric-card" style={{height: 350}}>
                <div style={{fontSize:"14px", fontWeight:700, color:"var(--text-secondary)", marginBottom: 20}}>📉 Análise de Perdas</div>
                {propostasPerdidas.length === 0 ? (
                  <div style={{height: "100%", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)"}}>Nenhuma perda no período! 🎉</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dadosMotivosPerda} cx="50%" cy="45%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {dadosMotivosPerda.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />)}
                      </Pie>
                      <ChartTooltip contentStyle={{background:'#0a1628', border:'none', borderRadius:8, color:'#fff'}} itemStyle={{color:'#fff'}} />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: 12, color: 'var(--text-secondary)'}} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        )}

        {aba === 'propostas' && isComercial && vistaPropostas === 'kanban' && (
          <div className="kanban-board">
            <div className="kanban-col" onDragOver={handleDragOver} onDrop={(e)=>handleDropStatus(e, 'aberta')}>
              <div className="kanban-header">Novas <span style={{background:"rgba(255,255,255,0.1)", padding:"2px 8px", borderRadius:10}}>{propostasAbertas.length}</span></div>
              <div className="kanban-body">
                {propostasAbertas.map(p => (
                  <div key={p.id} className="kanban-card" draggable onDragStart={(e)=>handleDragStart(e, p)}>
                    <div style={{fontSize:11, color:"var(--text-secondary)", marginBottom:4}}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</div>
                    <div style={{fontWeight:700, color:"var(--text-primary)", fontSize:15}}>{p.cliente}</div>
                    <div style={{fontSize:12, color:"var(--text-secondary)", marginBottom:8}}>{p.contato}</div>
                    <div style={{fontWeight:800, color:"#4A90D9", marginBottom:10}}>{fmt(p.valor)}</div>
                    <div style={{display:"flex", gap:5}}>
                      <button className="btn-action" style={{flex:1, padding: "6px 4px"}} onClick={()=>abrirModalEnvio(p, 'WhatsApp')}>Wpp</button>
                      <button className="btn-action" style={{flex:1, padding: "6px 4px"}} onClick={()=>abrirModalEnvio(p, 'Email')}>E-mail</button>
                      <button className="btn-action" style={{flex:1, padding: "6px 4px", background: "rgba(74,144,217,0.1)", color: "#4A90D9", borderColor: "#4A90D9"}} onClick={()=>abrirNotasDaProposta(p)}>📝 Notas</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="kanban-col" onDragOver={handleDragOver} onDrop={(e)=>handleDropStatus(e, 'negociacao')}>
              <div className="kanban-header">Em Negociação <span style={{background:"rgba(74,144,217,0.2)", color:"#4A90D9", padding:"2px 8px", borderRadius:10}}>{propostasEnviadas.length}</span></div>
              <div className="kanban-body">
                {propostasEnviadas.map(p => (
                  <div key={p.id} className="kanban-card" draggable onDragStart={(e)=>handleDragStart(e, p)}>
                    <div style={{fontWeight:700, color:"var(--text-primary)", fontSize:15}}>{p.cliente}</div>
                    <div style={{fontSize:12, color:"var(--text-secondary)", marginBottom:8}}>{p.contato}</div>
                    <div style={{fontWeight:800, color:"#4A90D9", marginBottom:10}}>{fmt(p.valor)}</div>
                    <div style={{display:"flex", gap:5}}>
                      <button className="btn-action" style={{flex:1, padding: "6px 4px"}} onClick={()=>abrirModalEnvio(p, 'WhatsApp')}>Wpp</button>
                      <button className="btn-action" style={{flex:1, padding: "6px 4px"}} onClick={()=>abrirModalEnvio(p, 'Email')}>E-mail</button>
                      <button className="btn-action" style={{flex:1, padding: "6px 4px", background: "rgba(74,144,217,0.1)", color: "#4A90D9", borderColor: "#4A90D9"}} onClick={()=>abrirNotasDaProposta(p)}>📝 Notas</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="kanban-col" onDragOver={handleDragOver} onDrop={(e)=>handleDropStatus(e, 'fechada')} style={{borderColor: "rgba(34,197,94,0.3)"}}>
              <div className="kanban-header" style={{color:"#22c55e"}}>Ganhou 🎉 <span style={{background:"rgba(34,197,94,0.2)", padding:"2px 8px", borderRadius:10}}>{propostasFechadas.length}</span></div>
              <div className="kanban-body">
                {propostasFechadas.map(p => (
                  <div key={p.id} className="kanban-card" style={{borderLeft:"3px solid #22c55e", opacity: 0.8}}>
                    <div style={{fontWeight:700}}>{p.cliente}</div>
                    <div style={{fontWeight:800, color:"#22c55e", marginBottom:10}}>{fmt(p.valor)}</div>
                    <button className="btn-action" style={{width:"100%", background: "transparent", borderColor: "#22c55e", color: "#22c55e"}} onClick={()=>abrirNotasDaProposta(p)}>📝 Ver Histórico</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="kanban-col" onDragOver={handleDragOver} onDrop={(e)=>handleDropStatus(e, 'perdida')} style={{borderColor: "rgba(248,113,113,0.3)"}}>
              <div className="kanban-header" style={{color:"#f87171"}}>Perdeu ❌ <span style={{background:"rgba(248,113,113,0.2)", padding:"2px 8px", borderRadius:10}}>{propostasPerdidas.length}</span></div>
              <div className="kanban-body">
                {propostasPerdidas.map(p => (
                  <div key={p.id} className="kanban-card" style={{borderLeft:"3px solid #f87171", opacity: 0.6}}>
                    <div style={{fontWeight:700}}>{p.cliente}</div>
                    <div style={{fontSize:11, color:"var(--text-tertiary)", marginTop:4, marginBottom:10}}>{p.motivo_perda}</div>
                    <button className="btn-action" style={{width:"100%", background: "transparent", borderColor: "#f87171", color: "#f87171"}} onClick={()=>abrirNotasDaProposta(p)}>📝 Ver Motivo</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {aba === 'propostas' && isComercial && vistaPropostas === 'tabela' && (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Data</th><th>Cliente / Contato</th><th>Valor</th><th>Status</th><th style={{minWidth:"300px", textAlign:"right"}}>Ações</th></tr></thead>
                <tbody>
                  {pFiltradas.map(p => (
                    <tr key={p.id} style={{ opacity: p.status === 'perdida' ? 0.6 : 1 }}>
                      <td>{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                      <td><strong>{p.cliente}</strong><br/><small>{p.contato}</small></td>
                      <td>{fmt(p.valor)}</td>
                      <td title={p.motivo_perda ? `Motivo: ${p.motivo_perda}` : ""}>
                        <span className="badge-status" style={{background:p.status==='fechada'?'#22c55e22':p.status==='perdida'?'#f8717122':'#f59e0b22',color:p.status==='fechada'?'#22c55e':p.status==='perdida'?'#f87171':'#f59e0b'}}>{p.status==='negociacao'?'Negociação':p.status||'aberta'}</span>
                        {p.motivo_perda && <div style={{fontSize: 10, color: "var(--text-tertiary)", marginTop: 4}}>{p.motivo_perda}</div>}
                      </td>
                      <td style={{textAlign:"right"}}>
                        <button className="btn-action" onClick={()=>abrirNotasDaProposta(p)}>📝 Notas</button>
                        <button className="btn-action" onClick={()=>visualizarProposta(p)}>PDF</button>
                        <button className="btn-action" onClick={()=>abrirModalEnvio(p, 'WhatsApp')}>Wpp</button>
                        <button className="btn-action" disabled={enviando===p.id} onClick={()=>abrirModalEnvio(p, 'Email')}>{enviando===p.id?'...':'E-mail'}</button>
                        {p.status !== 'fechada' && <button className="btn-action" style={{color:"#22c55e",borderColor:"#22c55e"}} onClick={()=>alterarStatusParaGanho(p)}>✓ Ganhou</button>}
                        {p.status !== 'perdida' && <button className="btn-action" style={{color:"#f87171"}} onClick={()=>abrirModalPerda(p)}>Perdeu</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}

        {aba === 'clientes' && (
          <>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", alignItems: "center" }}>
              {isComercial && <button onClick={()=>{setFormCliente({nome:"", email:"", telefone:"", whatsapp:"", documento:"", tipo:"Cliente", codigo:"", filial: perfilAtivo.filial}); setModalClienteForm(true);}} className="btn-action" style={{background:"#4A90D9",color:"#fff",border:"none", padding: "10px 20px", fontSize: 14}}>+ Novo Registo</button>}
              {isComercial && <button onClick={()=>{setFormComunicado({publico:"Cliente", assunto:"", mensagem:""}); setModalComunicado(true);}} className="btn-action" style={{background:"transparent",color:"#4A90D9",border:"1px solid #4A90D9", padding: "10px 20px", fontSize: 14}}>📢 Comunicado em Massa</button>}
              
              <div style={{flex: 1, display: "flex", justifyContent: "flex-end", gap: 10}}>
                <input 
                  className="input-modal" 
                  style={{maxWidth: "300px", margin: 0}} 
                  placeholder="Pesquisar por nome ou e-mail..." 
                  value={buscaCliente} 
                  onChange={e => setBuscaCliente(e.target.value)} 
                />
                <select className="input-modal" value={filtroTipoCliente} onChange={e=>setFiltroTipoCliente(e.target.value as any)} style={{maxWidth: "200px", margin: 0}}>
                  <option value="Todos">Todas as Categorias</option><option value="Cliente">Apenas Clientes</option><option value="Lead">Apenas Leads</option><option value="Parceiro">Apenas Parceiros</option>
                </select>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Nome / Cód</th><th>Contatos</th><th>Categoria</th><th>🔥 Score</th>{isComercial && <th>Documentos</th>}<th>Ação</th></tr></thead>
                <tbody>
                  {clientesAgrupados.map(c => (
                    <tr key={c.nome}>
                      <td><strong>{c.nome}</strong>{c.codigo && <div style={{fontSize:11, color:"var(--text-tertiary)"}}>{c.codigo}</div>}</td>
                      <td><div style={{fontSize: 12, color:"var(--text-secondary)"}}>📞 {c.telefone || c.contato || '—'}</div><div style={{fontSize: 12, color:"var(--text-secondary)"}}>💬 {c.whatsapp || '—'}</div><div style={{fontSize: 11, color:"var(--text-tertiary)", marginTop: 2}}>{c.email}</div></td>
                      <td><span className="badge-status" style={{background: c.tipo==='Cliente' ? 'rgba(34,197,94,0.1)' : c.tipo==='Parceiro' ? 'rgba(168,85,247,0.1)' : 'rgba(245,158,11,0.1)', color: c.tipo==='Cliente' ? '#22c55e' : c.tipo==='Parceiro' ? '#a855f7' : '#f59e0b'}}>{c.tipo}</span></td>
                      <td><span style={{ fontWeight: 'bold', color: (c.score || 0) >= 20 ? '#f87171' : (c.score || 0) > 0 ? '#f59e0b' : 'var(--text-secondary)' }}>{c.score || 0} pts</span></td>
                      {isComercial && <td><span style={{fontSize:12, color:"var(--text-secondary)"}}>{c.propostas.length} Props<br/>{c.contratos.filter((x:any)=>x.status==='Ativo').length} Contratos</span></td>}
                      <td style={{textAlign: "right"}}>
                        <button className="btn-action" onClick={()=>setClienteDetalhe(c)}>Ver Ficha (Diário)</button>
                        {isComercial && <button className="btn-action" onClick={()=>{
                          setFormCliente({ id: c.id, nome: c.nome, email: c.email || "", telefone: c.telefone || "", whatsapp: c.whatsapp || "", documento: c.documento || "", tipo: c.tipo || "Lead", codigo: c.codigo || "", filial: c.filial || perfilAtivo.filial });
                          setModalClienteForm(true);
                        }}>Editar</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {aba === 'contratos' && isAdmin && (
          <>
            <button onClick={()=>abrirNovoContrato()} className="btn-action" style={{marginBottom:"20px",background:"#4A90D9",color:"#fff",border:"none"}}>+ Novo Contrato</button>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Início</th><th>Cliente</th><th>Valor MRR</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {contratos.map(c => (
                    <tr key={c.id} style={{opacity:c.status==='Cancelado'?0.5:1}}>
                      <td>{new Date(c.data_inicio).toLocaleDateString('pt-BR')}</td>
                      <td><strong>{c.cliente_nome}</strong></td>
                      <td>{fmt(c.valor_mensal)}</td>
                      <td><span className="badge-status" style={{background:c.status==='Ativo'?'#22c55e22':c.status==='Cancelado'?'#f8717122':'#f59e0b22',color:c.status==='Ativo'?'#22c55e':c.status==='Cancelado'?'#f87171':'#f59e0b'}}>{c.status}</span></td>
                      <td><button className="btn-action" onClick={()=>editarContrato(c)}>Gerir Financeiro</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {aba === 'tarefas' && (
          <>
            <button onClick={()=>abrirNovaTarefa()} className="btn-action" style={{marginBottom:"20px",background:"#4A90D9",color:"#fff",border:"none"}}>+ Nova Tarefa</button>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Prazo</th><th>Tarefa</th><th>Cliente Relacionado</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>
                  {tarefas.map(t => (
                    <tr key={t.id} style={{opacity:t.status==='Concluído'?0.5:1}}>
                      <td>{new Date(t.data_vencimento).toLocaleDateString('pt-BR', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                      <td><strong>{t.titulo}</strong></td>
                      <td>{t.nome_referencia}</td>
                      <td><span className="badge-status" style={{background:t.status==='Concluído'?'#22c55e22':t.status==='Atrasado'?'#f8717122':'#f59e0b22',color:t.status==='Concluído'?'#22c55e':t.status==='Atrasado'?'#f87171':'#f59e0b'}}>{t.status}</span></td>
                      <td>
                        {t.status !== 'Concluído' && <button className="btn-action" onClick={()=>alterarStatusTarefaRapido(t.id,'Concluído')}>✓</button>}
                        <button className="btn-action" onClick={()=>editarTarefa(t)}>Editar</button>
                        {isAdmin && <button className="btn-action" style={{color:"#f87171"}} onClick={()=>excluirTarefa(t.id)}>X</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        
        {aba === 'leads' && isComercial && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Data de Entrada</th><th>Empresa Solicitante</th><th>Interesse no Site</th><th>Ações de Venda</th></tr></thead>
              <tbody>
                {leads.map(l => (
                  <tr key={l.id}>
                    <td>{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                    <td><strong>{l.empresa}</strong><br/>{l.nome}</td>
                    <td>{l.produto}</td>
                    <td>
                      <button className="btn-action" onClick={()=>enviarWhatsAppLead(l)}>Chamar no Wpp</button>
                      <button className="btn-action" onClick={()=>abrirNovaTarefa(`Contato Lead: ${l.empresa}`, l.id)}>+ Agendar Tarefa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {aba === 'templates' && isAdmin && (
          <>
            <button onClick={()=>{setFormTemplate({nome:"", tipo:"WhatsApp", conteudo:""}); setModalTemplate(true);}} className="btn-action" style={{marginBottom:"20px",background:"#4A90D9",color:"#fff",border:"none"}}>+ Novo Template</button>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Nome</th><th>Canal</th><th>Pré-visualização do Conteúdo</th><th>Ação</th></tr></thead>
                <tbody>
                  {templates.map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.nome}</strong></td>
                      <td><span className="badge-status" style={{background:"rgba(74,144,217,0.15)",color:"#4A90D9"}}>{t.tipo}</span></td>
                      <td><div style={{maxWidth:"400px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontSize:"12px",color:"var(--text-secondary)"}}>{t.conteudo}</div></td>
                      <td>
                        <button className="btn-action" onClick={()=>{setFormTemplate(t); setModalTemplate(true);}}>Editar</button>
                        <button className="btn-action" style={{color:"#f87171"}} onClick={()=>excluirTemplate(t.id)}>X</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* MODAL DE ENVIO INTELIGENTE (E-MAIL E WHATSAPP) COM TEMPLATES */}
      {modalEnvioProposta.ativo && modalEnvioProposta.prop && (
        <div className="modal-overlay" onClick={() => setModalEnvioProposta({ativo: false, tipo: 'Email', prop: null})}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Enviar {modalEnvioProposta.tipo}</h2>
            <p style={{fontSize: 13, color: "var(--text-secondary)", marginBottom: 15}}>
              Cliente: <strong>{modalEnvioProposta.prop.cliente}</strong>
            </p>
            
            <form onSubmit={confirmarEnvioMensagem} style={{display: "flex", flexDirection: "column", gap: 15}}>
              <div>
                <label style={{fontSize: 12, color: "var(--text-secondary)", marginBottom: 5, display: "block"}}>Escolha o Template</label>
                <select className="input-modal" value={formEnvioMensagem.templateId} onChange={e => setFormEnvioMensagem({...formEnvioMensagem, templateId: e.target.value})}>
                  <option value="" disabled>Selecione um template...</option>
                  {templates.filter(t => t.tipo === modalEnvioProposta.tipo).map(t => (
                    <option key={t.id} value={t.id.toString()}>{t.nome}</option>
                  ))}
                  <option value="custom">✍️ Escrever mensagem personalizada...</option>
                </select>
              </div>

              {formEnvioMensagem.templateId && (
                <div>
                  <label style={{fontSize: 12, color: "var(--text-secondary)", marginBottom: 5, display: "block"}}>
                    Conteúdo da Mensagem (Pode editar antes de enviar)
                  </label>
                  <textarea 
                    required 
                    className="input-modal" 
                    rows={8} 
                    value={formEnvioMensagem.texto} 
                    onChange={e => setFormEnvioMensagem({...formEnvioMensagem, texto: e.target.value})} 
                    placeholder="Digite a mensagem aqui..."
                  />
                </div>
              )}

              <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
                <button type="button" onClick={() => setModalEnvioProposta({ativo: false, tipo: 'Email', prop: null})} className="btn-action" style={{flex:1}}>Cancelar</button>
                <button type="submit" disabled={!formEnvioMensagem.templateId || !formEnvioMensagem.texto.trim() || enviando === modalEnvioProposta.prop.id} className="btn-action" style={{flex:1,background:"#4A90D9",color:"#fff",borderColor:"#4A90D9"}}>
                  {enviando === modalEnvioProposta.prop.id ? 'A Enviar...' : `Enviar ${modalEnvioProposta.tipo}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* A NOVA FICHA DO CLIENTE (DIÁRIO E INFORMAÇÕES) */}
      {clienteDetalhe && (
        <div className="modal-overlay" onClick={()=>setClienteDetalhe(null)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()} style={{maxWidth: 800, display: "flex", gap: 30}}>
            
            <div style={{flex: 1}}>
              <h2>{clienteDetalhe.nome} <span className="badge-status" style={{background: clienteDetalhe.tipo==='Cliente' ? 'rgba(34,197,94,0.1)' : clienteDetalhe.tipo==='Parceiro' ? 'rgba(168,85,247,0.1)' : 'rgba(245,158,11,0.1)', color: clienteDetalhe.tipo==='Cliente' ? '#22c55e' : clienteDetalhe.tipo==='Parceiro' ? '#a855f7' : '#f59e0b', marginLeft: 10}}>{clienteDetalhe.tipo}</span></h2>
              <div style={{fontSize:13, color:"var(--text-secondary)", marginTop:10, marginBottom: 20}}>
                <div>📞 {clienteDetalhe.telefone || clienteDetalhe.contato} | 💬 {clienteDetalhe.whatsapp}</div>
                <div>📧 {clienteDetalhe.email}</div>
                <div style={{color: "#f87171", fontWeight: "bold", marginTop: 5}}>🔥 Tracking Score: {clienteDetalhe.score || 0} pontos</div>
              </div>
              <hr style={{margin:"15px 0", opacity:0.1}}/>

              {isComercial && <>
                <h4 style={{color:"#4A90D9"}}>PROPOSTAS</h4>
                {clienteDetalhe.propostas.length === 0 && <div style={{fontSize:12, color:"var(--text-tertiary)"}}>Nenhuma proposta</div>}
                {clienteDetalhe.propostas.map((p:any)=><div key={p.id} style={{fontSize:"13px",padding:"5px 0"}}>{p.numero} - {fmt(p.valor)} <span style={{color: p.status==='perdida'?'#f87171':'inherit'}}>({p.status})</span></div>)}
                
                {isAdmin && <>
                  <h4 style={{marginTop:"15px", color:"#4A90D9"}}>CONTRATOS ATIVOS</h4>
                  {clienteDetalhe.contratos.length === 0 && <div style={{fontSize:12, color:"var(--text-tertiary)"}}>Sem contrato</div>}
                  {clienteDetalhe.contratos.map((c:any)=><div key={c.id} style={{fontSize:"13px",padding:"5px 0"}}>{fmt(c.valor_mensal)} - {c.status}</div>)}
                </>}
              </>}
              <h4 style={{marginTop:"15px", color:"#4A90D9"}}>CHAMADOS / TAREFAS</h4>
              {clienteDetalhe.tarefas.filter((t:any)=>t.status!=='Concluído').length === 0 && <div style={{fontSize:12, color:"var(--text-tertiary)"}}>Nenhuma pendência</div>}
              {clienteDetalhe.tarefas.filter((t:any)=>t.status!=='Concluído').map((t:any)=><div key={t.id} style={{fontSize:"13px",padding:"5px 0"}}>{t.titulo} - {new Date(t.data_vencimento).toLocaleDateString('pt-BR')}</div>)}
            </div>

            <div style={{flex: 1.2, background: "var(--bg-main)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column"}}>
              <h4 style={{marginBottom: 15}}>Diário de Bordo (Interações)</h4>
              
              <div style={{flex: 1, overflowY: "auto", marginBottom: 20, paddingRight: 10}}>
                {clienteDetalhe.interacoes.length === 0 && <div style={{fontSize:12, color:"var(--text-tertiary)", textAlign: "center", marginTop: 40}}>Nenhuma interação registada.</div>}
                {clienteDetalhe.interacoes.map((i:any) => (
                  <div key={i.id} style={{borderLeft: "2px solid #4A90D9", paddingLeft: 12, marginLeft: 5, marginBottom: 20, position: "relative"}}>
                    <div style={{position: "absolute", left: -6, top: 0, width: 10, height: 10, borderRadius: 10, background: "#4A90D9"}}></div>
                    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                      <span style={{fontSize: 11, fontWeight: "bold", color: "#4A90D9", textTransform: "uppercase"}}>{i.tipo}</span>
                      <span style={{fontSize: 10, color: "var(--text-tertiary)"}}>{new Date(i.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div style={{fontSize: 13, color: "var(--text-primary)", marginTop: 4, whiteSpace: "pre-wrap"}}>{i.descricao}</div>
                    <div style={{fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, textAlign: "right"}}>- {i.usuario_email.split('@')[0]}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={salvarInteracao} style={{display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border-light)", paddingTop: 15}}>
                <div style={{display: "flex", gap: 10}}>
                  <select className="input-modal" style={{width: 120, padding: 8}} value={formInteracao.tipo} onChange={e=>setFormInteracao({...formInteracao, tipo: e.target.value})}>
                    <option value="Nota">✏️ Nota</option><option value="Ligação">📞 Ligação</option><option value="Reunião">🤝 Reunião</option><option value="WhatsApp">💬 Wpp</option>
                  </select>
                  <textarea required className="input-modal" style={{flex: 1, padding: 8}} rows={2} placeholder="Registe o que foi conversado..." value={formInteracao.descricao} onChange={e=>setFormInteracao({...formInteracao, descricao: e.target.value})} />
                </div>
                <button type="submit" className="btn-action" style={{background: "#4A90D9", color: "#fff", border: "none"}}>Gravar no Histórico e Voltar ao Início</button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* OUTROS MODAIS MANTIDOS (Perda, ClienteForm, Contrato, Tarefa, etc) */}
      {modalPerda && (
        <div className="modal-overlay" onClick={() => setModalPerda(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Análise de Lead Perdido</h2>
            <p style={{fontSize:"13px",color:"var(--text-secondary)",marginBottom:"20px"}}>Por favor, informe o motivo da perda desta proposta.</p>
            <form onSubmit={confirmarPerda} style={{display:"flex",flexDirection:"column",gap:"15px"}}>
              <select required className="input-modal" value={formPerda.motivo} onChange={e => setFormPerda({...formPerda, motivo: e.target.value})}>
                <option value="" disabled>Selecione um motivo...</option><option value="Preço">Preço alto</option><option value="Sem interesse">Sem interesse no momento</option><option value="Concorrente">Fechou com concorrente</option><option value="Sem retorno">Cliente não deu mais retorno</option>
              </select>
              <textarea className="input-modal" rows={3} value={formPerda.obs} onChange={e => setFormPerda({...formPerda, obs: e.target.value})} placeholder="Observações opcionais..." />
              <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
                <button type="button" onClick={() => setModalPerda(false)} className="btn-action" style={{flex:1}}>Cancelar</button>
                <button type="submit" disabled={!formPerda.motivo} className="btn-action" style={{flex:1,background:"#f87171",color:"#fff",borderColor:"#f87171", opacity: !formPerda.motivo ? 0.5 : 1}}>Registar Perda</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalComunicado && (
        <div className="modal-overlay" onClick={() => !progressoEmail.ativo && setModalComunicado(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>📢 Comunicado em Massa</h2>
            {progressoEmail.ativo ? (
              <div style={{ marginTop: 20, textAlign: "center" }}>
                <p style={{ marginBottom: 10 }}>A enviar e-mails... ({progressoEmail.enviado} de {progressoEmail.total})</p>
                <div style={{ width: "100%", background: "var(--bg-main)", borderRadius: 10, height: 10, overflow: "hidden" }}><div style={{ width: `${(progressoEmail.enviado / progressoEmail.total) * 100}%`, background: "#4A90D9", height: "100%", transition: "width 0.3s" }}></div></div>
              </div>
            ) : (
              <form style={{marginTop:"15px",display:"flex",flexDirection:"column",gap:"15px"}}>
                <select className="input-modal" value={formComunicado.publico} onChange={e => setFormComunicado({...formComunicado, publico: e.target.value})}><option value="Todos">Todos (Clientes, Leads e Parceiros)</option><option value="Cliente">Apenas Clientes Ativos</option><option value="Lead">Apenas Leads</option><option value="Parceiro">Apenas Parceiros</option></select>
                <input required className="input-modal" value={formComunicado.assunto} onChange={e => setFormComunicado({...formComunicado, assunto: e.target.value})} placeholder="Assunto (Apenas para E-mail)..." />
                <textarea required className="input-modal" rows={6} value={formComunicado.mensagem} onChange={e => setFormComunicado({...formComunicado, mensagem: e.target.value})} placeholder="Escreva o comunicado aqui..." />
                <div style={{display:"flex",gap:"10px",marginTop:"10px"}}><button type="button" onClick={() => setModalComunicado(false)} className="btn-action" style={{flex:1}}>Cancelar</button><button type="button" onClick={gerarFilaWhatsapp} className="btn-action" style={{flex:1,background:"#22c55e",color:"#fff",borderColor:"#22c55e"}}>💬 Fila WhatsApp</button><button type="button" onClick={dispararEmailsMassa} className="btn-action" style={{flex:1,background:"#4A90D9",color:"#fff",borderColor:"#4A90D9"}}>📧 Disparar E-mails</button></div>
              </form>
            )}
          </div>
        </div>
      )}

      {modalClienteForm && (
        <div className="modal-overlay" onClick={() => setModalClienteForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{formCliente.id ? "Editar Registo" : "Novo Registo"}</h2>
            <form onSubmit={salvarClienteBase} style={{marginTop:"15px",display:"flex",flexDirection:"column",gap:"15px"}}>
              <div style={{display:"flex", gap:"10px"}}><input className="input-modal" style={{flex: 1}} value={formCliente.codigo} onChange={e => setFormCliente({...formCliente, codigo: e.target.value})} placeholder="Código (Opcional)..." /><select className="input-modal" style={{flex: 1}} value={formCliente.tipo} onChange={e => setFormCliente({...formCliente, tipo: e.target.value})}><option value="Cliente">Cliente</option><option value="Lead">Lead</option><option value="Parceiro">Parceiro</option></select></div>
              <input required className="input-modal" value={formCliente.nome} onChange={e => setFormCliente({...formCliente, nome: e.target.value})} placeholder="Nome da Empresa..." />
              <input className="input-modal" value={formCliente.email} onChange={e => setFormCliente({...formCliente, email: e.target.value})} placeholder="E-mail principal..." />
              <div style={{display:"flex", gap:"10px"}}><input className="input-modal" style={{flex: 1}} value={formCliente.telefone} onChange={e => setFormCliente({...formCliente, telefone: e.target.value})} placeholder="Telefone Fixo..." /><input className="input-modal" style={{flex: 1}} value={formCliente.whatsapp} onChange={e => setFormCliente({...formCliente, whatsapp: e.target.value})} placeholder="WhatsApp (com DDD)..." /></div>
              <div style={{display:"flex", gap:"10px"}}><input className="input-modal" style={{flex: 1}} value={formCliente.documento} onChange={e => setFormCliente({...formCliente, documento: e.target.value})} placeholder="CNPJ / CPF..." />{isAdmin && <input className="input-modal" style={{flex: 1}} value={formCliente.filial} onChange={e => setFormCliente({...formCliente, filial: e.target.value})} placeholder="Filial (Ex: Matriz)..." />}</div>
              <div style={{display:"flex",gap:"10px",marginTop:"10px"}}><button type="button" onClick={() => setModalClienteForm(false)} className="btn-action" style={{flex:1}}>Cancelar</button><button type="submit" className="btn-action" style={{flex:1,background:"#4A90D9",color:"#fff",borderColor:"#4A90D9"}}>Gravar Registo</button></div>
            </form>
          </div>
        </div>
      )}

      {modalTarefa && (
        <div className="modal-overlay" onClick={() => setModalTarefa(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{formTarefa.id ? "Editar Tarefa" : "Nova Tarefa"}</h2>
            <form onSubmit={salvarTarefa} style={{marginTop:"15px",display:"flex",flexDirection:"column",gap:"15px"}}>
              <input required className="input-modal" value={formTarefa.titulo} onChange={e => setFormTarefa({...formTarefa, titulo: e.target.value})} placeholder="Título da tarefa..." />
              <input type="datetime-local" required className="input-modal" value={formTarefa.data_vencimento} onChange={e => setFormTarefa({...formTarefa, data_vencimento: e.target.value})} />
              <select className="input-modal" value={formTarefa.status} onChange={e => setFormTarefa({...formTarefa, status: e.target.value})}><option value="Pendente">Pendente</option><option value="Em andamento">Em andamento</option><option value="Concluído">Concluído</option></select>
              {isAdmin && <input required className="input-modal" value={formTarefa.usuario_email} onChange={e => setFormTarefa({...formTarefa, usuario_email: e.target.value})} placeholder="Delegar para (E-mail)..." />}
              <div style={{display:"flex",gap:"10px",marginTop:"10px"}}><button type="button" onClick={() => setModalTarefa(false)} className="btn-action" style={{flex:1}}>Cancelar</button><button type="submit" className="btn-action" style={{flex:1,background:"#4A90D9",color:"#fff",borderColor:"#4A90D9"}}>Gravar Tarefa</button></div>
            </form>
          </div>
        </div>
      )}
      
      {modalContrato && (
        <div className="modal-overlay" onClick={() => setModalContrato(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{formContrato.id ? "Editar Contrato" : "Novo Contrato"}</h2>
            <form onSubmit={salvarContrato} style={{marginTop:"15px",display:"flex",flexDirection:"column",gap:"15px"}}>
              <input required className="input-modal" value={formContrato.cliente_nome} onChange={e => setFormContrato({...formContrato, cliente_nome: e.target.value})} placeholder="Nome do Cliente..." />
              <div style={{display:"flex", gap:"10px"}}><input type="number" step="0.01" required className="input-modal" style={{flex: 1}} value={formContrato.valor_mensal || ""} onChange={e => setFormContrato({...formContrato, valor_mensal: Number(e.target.value)})} placeholder="Valor Mensal..." /><input className="input-modal" style={{flex: 1}} value={formContrato.filial || ""} onChange={e => setFormContrato({...formContrato, filial: e.target.value})} placeholder="Filial (Ex: Matriz)..." /></div>
              <input type="date" required className="input-modal" value={formContrato.data_inicio} onChange={e => setFormContrato({...formContrato, data_inicio: e.target.value})} />
              <select className="input-modal" value={formContrato.status} onChange={e => setFormContrato({...formContrato, status: e.target.value})}><option value="Ativo">Ativo</option><option value="Suspenso">Suspenso</option><option value="Cancelado">Cancelado</option></select>
              {formContrato.status === 'Cancelado' && <input required className="input-modal" style={{borderColor:"#f87171"}} value={formContrato.motivo_cancelamento} onChange={e => setFormContrato({...formContrato, motivo_cancelamento: e.target.value})} placeholder="Motivo do Cancelamento..." />}
              <div style={{display:"flex",gap:"10px",marginTop:"10px"}}><button type="button" onClick={() => setModalContrato(false)} className="btn-action" style={{flex:1}}>Cancelar</button><button type="submit" className="btn-action" style={{flex:1,background:"#4A90D9",color:"#fff",borderColor:"#4A90D9"}}>Gravar Contrato</button></div>
            </form>
          </div>
        </div>
      )}

      {modalTemplate && (
        <div className="modal-overlay" onClick={() => setModalTemplate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{formTemplate.id ? "Editar Template" : "Novo Template"}</h2>
            <p style={{fontSize:"12px",color:"var(--text-secondary)",marginBottom:"15px"}}>Use as variáveis: {'{{nome}}'}, {'{{empresa}}'}, {'{{valor}}'}</p>
            <form onSubmit={salvarTemplate}>
              <input required className="input-modal" value={formTemplate.nome} onChange={e => setFormTemplate({...formTemplate, nome: e.target.value})} placeholder="Nome do Template..." />
              <select className="input-modal" value={formTemplate.tipo} onChange={e => setFormTemplate({...formTemplate, tipo: e.target.value})}><option value="WhatsApp">WhatsApp</option><option value="Email">Email</option></select>
              <textarea required className="input-modal" rows={6} value={formTemplate.conteudo} onChange={e => setFormTemplate({...formTemplate, conteudo: e.target.value})} placeholder="Olá {{nome}}..." />
              <div style={{display:"flex",gap:"10px",marginTop:"10px"}}><button type="button" onClick={() => setModalTemplate(false)} className="btn-action" style={{flex:1}}>Cancelar</button><button type="submit" className="btn-action" style={{flex:1,background:"#4A90D9",color:"#fff",borderColor:"#4A90D9"}}>Gravar Template</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
