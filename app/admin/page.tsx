"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface PropostaDB { id: number; created_at: string; numero: string; cliente: string; contato: string; telefone?: string; email: string; valor: number; status: string; status_envio: string; dados: any; }
interface TarefaDB { id: number; titulo: string; descricao: string; data_vencimento: string; status: string; usuario_email: string; lead_id?: number; proposta_id?: number; nome_referencia?: string; data_conclusao?: string; created_at: string; }
interface ContratoDB { id: number; proposta_id?: number; cliente_nome: string; servicos_inclusos?: string; valor_mensal: number; status: string; data_inicio: string; data_fim?: string; motivo_cancelamento?: string; created_at: string; }
interface TemplateDB { id: number; nome: string; tipo: string; conteudo: string; created_at: string; }

export default function AdminPage() {
  const router = useRouter();

  // --- ESTADOS GERAIS E NOTIFICAÇÕES ---
  const [session, setSession] = useState<any>(null);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const [toast, setToast] = useState<{msg: string, tipo: 'sucesso' | 'erro' | 'info'} | null>(null);
  const isAdmin = session?.user?.email === 'fabiano@simplessolucao.com.br';

  const showToast = (msg: string, tipo: 'sucesso' | 'erro' | 'info' = 'sucesso') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  // --- ESTADOS DO CRM ---
  const [aba, setAba] = useState<"propostas" | "clientes" | "contratos" | "tarefas" | "leads" | "templates">("propostas");
  const [propostas, setPropostas] = useState<PropostaDB[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<TarefaDB[]>([]);
  const [contratos, setContratos] = useState<ContratoDB[]>([]);
  const [templates, setTemplates] = useState<TemplateDB[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroDias, setFiltroDias] = useState<number>(30);
  const [enviando, setEnviando] = useState<number | null>(null);

  // --- ESTADOS DE MODAIS ---
  const [modalTarefa, setModalTarefa] = useState(false);
  const [formTarefa, setFormTarefa] = useState<Partial<TarefaDB>>({ titulo: "", descricao: "", data_vencimento: "", status: "Pendente", usuario_email: "", nome_referencia: "" });
  const [modalContrato, setModalContrato] = useState(false);
  const [formContrato, setFormContrato] = useState<Partial<ContratoDB>>({ cliente_nome: "", valor_mensal: 0, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: "", motivo_cancelamento: "" });
  const [modalTemplate, setModalTemplate] = useState(false);
  const [formTemplate, setFormTemplate] = useState<Partial<TemplateDB>>({ nome: "", tipo: "WhatsApp", conteudo: "" });
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

  // ─── CARREGAMENTO DE DADOS E AUTOMAÇÕES ────────────────────────────────────
  const verificarAutomacoesDeTempo = async (listaLeads: any[], listaContratos: any[]) => {
    try {
      const hoje = new Date();
      const doisDiasAtras = new Date(); doisDiasAtras.setDate(hoje.getDate() - 2);
      const onzeMesesAtras = new Date(); onzeMesesAtras.setMonth(hoje.getMonth() - 11);

      for (const lead of listaLeads) {
        if (new Date(lead.created_at) < doisDiasAtras) {
          const { data: log } = await supabase.from('automacoes_log').select('id').eq('tipo_regra', 'LEAD_SEM_RESPOSTA_2_DIAS').eq('referencia_id', lead.id);
          if (!log || log.length === 0) {
            await supabase.from('automacoes_log').insert([{ tipo_regra: 'LEAD_SEM_RESPOSTA_2_DIAS', referencia_id: lead.id, tabela_referencia: 'leads', acao_executada: 'Tarefa de Resgate Criada' }]);
            await supabase.from('tarefas').insert([{ titulo: `🔥 Resgatar Lead Frio: ${lead.empresa}`, descricao: `Lead sem interação há mais de 48h.`, data_vencimento: new Date().toISOString(), status: 'Pendente', usuario_email: session.user.email, nome_referencia: lead.empresa, lead_id: lead.id }]);
          }
        }
      }

      for (const contrato of listaContratos) {
        if (contrato.status === 'Ativo' && new Date(contrato.data_inicio) <= onzeMesesAtras) {
          const { data: log } = await supabase.from('automacoes_log').select('id').eq('tipo_regra', 'REAJUSTE_CONTRATO_11M').eq('referencia_id', contrato.id);
          if (!log || log.length === 0) {
            await supabase.from('automacoes_log').insert([{ tipo_regra: 'REAJUSTE_CONTRATO_11M', referencia_id: contrato.id, tabela_referencia: 'contratos', acao_executada: 'Tarefa de Reajuste Criada' }]);
            await supabase.from('tarefas').insert([{ titulo: `📈 Preparar Reajuste Contratual: ${contrato.cliente_nome}`, descricao: `O contrato fará 1 ano no próximo mês. Preparar documentação de reajuste.`, data_vencimento: new Date().toISOString(), status: 'Pendente', usuario_email: session.user.email, nome_referencia: contrato.cliente_nome }]);
          }
        }
      }
    } catch (e) {}
  };

  const carregarTudo = async () => {
    if (!session) return;
    setCarregando(true);
    const [p, l, t, c, tpl] = await Promise.all([
      supabase.from('propostas').select('*').order('created_at', { ascending: false }),
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('tarefas').select('*').order('data_vencimento', { ascending: true }),
      supabase.from('contratos').select('*').order('created_at', { ascending: false }),
      supabase.from('templates').select('*').order('created_at', { ascending: false })
    ]);
    
    if (p.data) setPropostas(p.data);
    if (l.data) setLeads(l.data);
    if (c.data) setContratos(c.data);
    if (tpl.data) setTemplates(tpl.data);
    if (t.data) setTarefas(isAdmin ? t.data : t.data.filter(x => x.usuario_email === session.user.email));
    
    setCarregando(false);
    if (l.data && c.data) verificarAutomacoesDeTempo(l.data, c.data);
  };

  useEffect(() => { carregarTudo(); }, [session, filtroDias]);

  // ─── MOTOR DE TEMPLATES ───────────────────────────────────────────────────
  const processarTemplate = (conteudo: string, nome: string, empresa: string, valor: number) => {
    if (!conteudo) return "";
    return conteudo
      .replace(/\{\{nome\}\}/g, nome || "Cliente")
      .replace(/\{\{empresa\}\}/g, empresa || "Empresa")
      .replace(/\{\{valor\}\}/g, fmt(valor));
  };

  // ─── GERADOR DE PDF DE PROPOSTA PROFISSIONAL (RESTAURADO) ─────────────────
  const visualizarProposta = (prop: PropostaDB) => {
    const dataFormatada = new Date(prop.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' });
    const origin = window.location.origin;
    const obs = prop.dados?.obs || "";
    
    const html = `
      <html><head><title>Proposta Comercial - ${prop.cliente}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');
        body { font-family: 'Montserrat', Arial, sans-serif; color: #333; padding: 0; margin: 0; font-size: 14px; line-height: 1.6; }
        .page { max-width: 800px; margin: 0 auto; padding: 40px; }
        h1 { color: #0a1628; font-size: 26px; border-bottom: 2px solid #4A90D9; padding-bottom: 10px; }
        h2 { color: #4A90D9; font-size: 20px; margin-top: 40px; margin-bottom: 15px; }
        h3 { color: #0a1628; font-size: 16px; margin-top: 25px; }
        p { margin-bottom: 15px; text-align: justify; }
        ul { margin-bottom: 20px; }
        li { margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; font-size: 14px; }
        th { background: #0a1628; color: #fff; padding: 12px; text-align: left; }
        td { padding: 10px 12px; border-bottom: 1px solid #ddd; }
        .row-total td { font-size: 18px; font-weight: bold; background: #f8f9fa; border-top: 2px solid #0a1628; border-bottom: 2px solid #0a1628; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 50px; }
        .info-doc { text-align: right; font-size: 12px; color: #666; }
        .assinatura { margin-top: 60px; font-weight: bold; }
        .assinatura-dados { font-weight: normal; font-size: 13px; color: #555; }
        .logos { display: flex; gap: 30px; flex-wrap: wrap; margin-top: 15px; align-items: center; }
        .logos img { max-height: 50px; max-width: 140px; object-fit: contain; filter: grayscale(100%); transition: filter 0.3s; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page-break { page-break-before: always; } .logos img { filter: grayscale(0%); } }
      </style></head><body>

      <div class="page">
        <div class="header">
          <div><h2 style="margin: 0; color: #0a1628;">Simples Solução TI</h2></div>
          <div class="info-doc"><strong>Proposta:</strong> ${prop.numero}<br><strong>Data:</strong> ${dataFormatada}<br><strong>Empresa:</strong> ${prop.cliente}</div>
        </div>
        <h1>PROPOSTA DE SUPORTE TÉCNICO</h1>
        <p>Rio de Janeiro, ${dataFormatada}</p>
        <p>Prezada(o) <strong>${prop.contato || 'Cliente'}</strong>,</p>
        <p>Agradecemos a oportunidade de apresentar a nossa empresa e discutir possíveis caminhos para o futuro da <strong>${prop.cliente}</strong>. Agradecemos ainda pela oportunidade de propor, por meio desta, uma parceria na área de tecnologia da informação.</p>
        <p>Este documento tem como objetivo definir o escopo de trabalho a ser empregado na prestação de serviço de suporte de informática à <strong>${prop.cliente}</strong>. Esse serviço tem o objetivo de auxiliar o ambiente de TI da empresa para uma evolução contínua, minimizando problemas e possíveis riscos existentes.</p>
        <p>Agradecemos a oportunidade e nos colocamos à sua inteira disposição para eventuais esclarecimentos que forem necessários.</p>
        <div class="assinatura">Fabiano Lucio<br><span class="assinatura-dados">Diretor Comercial<br>(21) 3529-7993 | (21) 3197-0198<br>fabiano@simplessolucao.com.br<br>www.simplessolucao.com.br</span></div>
        <div class="page-break"></div>
        <h2>A Empresa</h2>
        <p>A Simples Solução TI é uma integradora de tecnologia que oferece soluções de apoio à área de TI dos seus clientes. Estamos localizados estrategicamente no Shopping Nova América.</p>
        <p>Contamos com uma sólida infraestrutura de atendimento, com sistema de help desk, inventário e ainda temos dois links de internet para redundância. Com isso garantimos um atendimento ininterrupto a toda nossa base de clientes.</p>
        <p>Possuímos um corpo técnico de qualidade, com profissionais experientes. Nossa equipe conta com especialistas nas mais diversas tecnologias:</p>
        <ul><li>Suporte a Desktops, plataforma Microsoft, Linux, Mac e servidores Windows;</li><li>Suporte para detecção de problemas com Hardware, computadores, impressoras e nobreaks;</li><li>Conhecimento em Banco de Dados Oracle, SQL Server, MySQL, Sybase e PostgreSQL.</li></ul>
        <p>Tendo iniciado as operações atendendo ao mercado das PMEs (pequenas e médias empresas) e atualmente atendendo clientes de todos os portes, procuramos aliar a alta qualidade exigida pelas grandes empresas a preços competitivos e serviços de alto valor agregado.</p>
        <h3>Alguns Clientes e Parceiros</h3>
        <p>Temos orgulho de atender e firmar parcerias com grandes marcas do mercado, como:</p>
        <div class="logos">
          <img src="${origin}/PLL - Logo Verde - Fundo transparente.png" alt="PLL" />
          <img src="${origin}/LogoAgribio.jpg" alt="Agribio" />
          <img src="${origin}/SAVIOR LOGO.jpg" alt="Savior" />
          <img src="${origin}/logo_Cbsm.jpg" alt="CBSM" />
        </div>
        <div class="page-break"></div>
        <h2>Detalhamento dos Serviços</h2>
        <p>No primeiro mês do contrato faremos uma validação do ambiente que produzirá uma documentação resumida do ambiente de TI, produzindo os seguintes artefatos:</p>
        <ul><li>Inventário de Hardware e Software;</li><li>Documentação da estrutura de Rede;</li><li>Documentação e Validação/Implantação de rotinas de backup;</li><li>Validação do Parque de máquinas e sugestão de investimentos;</li><li>Revisão de backlog de chamados;</li><li>Validação das políticas de segurança e antivírus.</li></ul>
        <h3>Suporte Continuado</h3>
        <p>Mão de obra técnica utilizada em visitas à <strong>${prop.cliente}</strong> ou remotamente com o objetivo de prestar suporte ao usuário e atendimentos necessários.</p>
        <h4>Benefícios:</h4>
        <ul><li><strong>Garantia de Serviço:</strong> Atendimento remoto (conexão através de TeamViewer ou AnyDesk).</li><li><strong>Políticas de Backup:</strong> A única forma de garantir a qualidade dos backups é testá-los recorrentemente. Além disso, são estabelecidos prazos máximos para retorno dos serviços mais críticos.</li><li><strong>Checklists Preventivos:</strong> De acordo com periodicidades especificadas, configurações de software e hardware são checados de forma a evitar paradas subsequentes.</li><li><strong>Suporte Telefônico:</strong> Resolução ágil de problemas via telefone, evitando perda de tempo dos funcionários.</li><li><strong>Implantação de Novas Soluções:</strong> A Simples Solução TI participa da especificação e implantação de soluções diferenciadas.</li><li><strong>Manutenção de Hardware:</strong> Consertos realizados em laboratório próprio mediante aprovação prévia.</li></ul>
        <div class="page-break"></div>
        <h2>Proposta Comercial</h2>
        <p>Contrato de suporte inicial da <strong>${prop.cliente}</strong>:</p>
        <table>
          <tr><th>Descrição do Serviço</th><th style="text-align: right; width: 200px;">Valor Mensal</th></tr>
          <tr class="row-total"><td style="padding: 20px 12px;">Manutenção TI</td><td style="text-align: right; color: #4A90D9; padding: 20px 12px;">${fmt(prop.valor)}</td></tr>
        </table>
        ${obs ? `<h3>Escopo Adicional / Observações</h3><p style="background: #f8f9fa; padding: 15px; border-left: 4px solid #4A90D9;">${obs.replace(/\n/g, '<br>')}</p>` : ""}
        <h2>Considerações Finais</h2>
        <ul><li>Esta proposta é válida por 30 dias a partir da data de emissão.</li><li>Maiores informações sobre os serviços da Simples Solução TI podem ser encontradas em <strong>www.simplessolucao.com.br</strong>.</li><li>Colocamo-nos à disposição para quaisquer esclarecimentos.</li></ul>
      </div>
      </body></html>
    `;

    const w = window.open("", "_blank")!;
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.document.title = `Proposta_${prop.cliente.replace(/\s+/g, '_')}_${prop.numero}`; w.print(); }, 500);
  };

  // ─── AÇÕES DE PROPOSTAS (E-MAIL E WPP) ────────────────────────────────────
  const enviarPorEmail = async (prop: PropostaDB) => {
    if (!prop.email) return showToast("E-mail não registado nesta proposta.", "erro");
    
    setEnviando(prop.id); 
    
    const tplEmail = templates.find(t => t.tipo === 'Email');
    let corpoEmail = `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;"><h2 style="color: #0a1628;">Proposta Comercial - Simples Solução TI</h2><p>Olá <strong>${prop.contato}</strong>,</p><p>É um prazer apresentar a nossa proposta de suporte técnico para a <strong>${prop.cliente}</strong>.</p><p><strong>Valor Mensal Ofertado:</strong> ${fmt(prop.valor)}</p><br /><p>Atenciosamente,</p><p><strong>Equipa Comercial | Simples Solução TI</strong><br/>(21) 3529-7993 | www.simplessolucao.com.br</p></div>`;
    
    if (tplEmail && tplEmail.conteudo) {
      const htmlDoTemplate = processarTemplate(tplEmail.conteudo, prop.contato, prop.cliente, prop.valor).replace(/\n/g, '<br/>');
      corpoEmail = `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">${htmlDoTemplate}</div>`;
    }

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: prop.email,
          subject: `Proposta Comercial SSTI - ${prop.cliente}`,
          html: corpoEmail,
          fileName: `Proposta_${prop.numero}.pdf`
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await supabase.from('propostas').update({ status_envio: 'enviado' }).eq('id', prop.id);
        try {
          const { data: log } = await supabase.from('automacoes_log').select('id').eq('tipo_regra', 'PROPOSTA_ENVIADA_FOLLOWUP').eq('referencia_id', prop.id);
          if (!log || log.length === 0) {
            await supabase.from('automacoes_log').insert([{ tipo_regra: 'PROPOSTA_ENVIADA_FOLLOWUP', referencia_id: prop.id, tabela_referencia: 'propostas', acao_executada: 'Tarefa de Follow-up Criada' }]);
            const dataVenc = new Date(); dataVenc.setDate(dataVenc.getDate() + 3); dataVenc.setHours(10, 0, 0, 0);
            await supabase.from('tarefas').insert([{ titulo: `📞 Follow-up: ${prop.cliente}`, descricao: `Validar o retorno da proposta ${prop.numero} enviada por e-mail.`, data_vencimento: dataVenc.toISOString(), status: 'Pendente', usuario_email: session.user.email, nome_referencia: prop.cliente, proposta_id: prop.id }]);
          }
        } catch (autoErr) { console.error(autoErr); }

        showToast("E-mail enviado com sucesso e Follow-up agendado!", "sucesso");
        carregarTudo();
      } else {
        showToast(`Erro na API: ${data.error}`, "erro");
      }
    } catch (e) { 
      showToast("Erro de conexão ao tentar enviar o e-mail.", "erro"); 
    } finally { 
      setEnviando(null); 
    }
  };

  const enviarWhatsApp = (prop: PropostaDB) => {
    const tplWpp = templates.find(t => t.tipo === 'WhatsApp');
    let texto = `Olá ${prop.contato}, envio a nossa proposta (cód: ${prop.numero}) no valor de ${fmt(prop.valor)} mensais.`;
    if (tplWpp && tplWpp.conteudo) { texto = processarTemplate(tplWpp.conteudo, prop.contato, prop.cliente, prop.valor); }
    window.open(`https://wa.me/${prop.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(texto)}`, '_blank');
  };
  
  const alterarStatusComAutomacao = async (prop: PropostaDB, novoStatus: string) => {
    await supabase.from('propostas').update({ status: novoStatus }).eq('id', prop.id);
    if (novoStatus === 'fechada') {
      try {
        const { data: log } = await supabase.from('automacoes_log').select('id').eq('tipo_regra', 'ONBOARDING_PROPOSTA_GANHA').eq('referencia_id', prop.id);
        if (!log || log.length === 0) {
          await supabase.from('automacoes_log').insert([{ tipo_regra: 'ONBOARDING_PROPOSTA_GANHA', referencia_id: prop.id, tabela_referencia: 'propostas', acao_executada: 'Onboarding Inicializado' }]);
          await supabase.from('contratos').insert([{ proposta_id: prop.id, cliente_nome: prop.cliente, valor_mensal: prop.valor, status: 'Ativo', data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: 'Gerado automaticamente (Onboarding)' }]);
          await supabase.from('tarefas').insert([{ titulo: `🚀 Onboarding Técnico: ${prop.cliente}`, descricao: `Novo cliente fechado! Iniciar inventário da rede.`, data_vencimento: new Date().toISOString(), status: 'Pendente', usuario_email: session.user.email, nome_referencia: prop.cliente, proposta_id: prop.id }]);
          showToast("Negócio Fechado! Contrato ativado e Onboarding iniciado.", "sucesso");
        }
      } catch (e) { console.error(e) }
    } else {
      showToast(`Proposta marcada como ${novoStatus}.`, "info");
    }
    carregarTudo();
  };

  const excluirProposta = async (id: number, nome: string) => { if (confirm(`Excluir permanentemente ${nome}?`)) { await supabase.from('propostas').delete().eq('id', id); showToast("Proposta excluída.", "info"); carregarTudo(); }};

  // ─── AÇÕES DE CONTRATOS, TAREFAS E TEMPLATES ──────────────────────────────
  const abrirNovoContrato = (prop?: PropostaDB) => { if (prop) setFormContrato({ proposta_id: prop.id, cliente_nome: prop.cliente, valor_mensal: prop.valor, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: `Originado da Proposta ${prop.numero}`, motivo_cancelamento: "" }); else setFormContrato({ cliente_nome: "", valor_mensal: 0, status: "Ativo", data_inicio: new Date().toISOString().split('T')[0], servicos_inclusos: "", motivo_cancelamento: "" }); setModalContrato(true); };
  const editarContrato = (c: ContratoDB) => { setFormContrato({ ...c }); setModalContrato(true); };
  const salvarContrato = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (formContrato.status === 'Cancelado' && !formContrato.motivo_cancelamento) return showToast("Motivo do cancelamento é obrigatório.", "erro"); 
    const payload = { ...formContrato, updated_at: new Date().toISOString() }; 
    if (formContrato.id) { await supabase.from('contratos').update(payload).eq('id', formContrato.id); showToast("Contrato atualizado.", "sucesso"); }
    else { await supabase.from('contratos').insert([payload]); showToast("Novo contrato ativado.", "sucesso"); }
    setModalContrato(false); carregarTudo(); 
  };

  const abrirNovaTarefa = (referencia?: string, leadId?: number, propostaId?: number) => { setFormTarefa({ titulo: "", descricao: "", data_vencimento: "", status: "Pendente", usuario_email: session?.user?.email || "", nome_referencia: referencia || "", lead_id: leadId, proposta_id: propostaId }); setModalTarefa(true); };
  const editarTarefa = (t: TarefaDB) => { const dataFormatada = new Date(t.data_vencimento).toISOString().slice(0, 16); setFormTarefa({ ...t, data_vencimento: dataFormatada }); setModalTarefa(true); };
  const salvarTarefa = async (e: React.FormEvent) => { e.preventDefault(); const payload = { ...formTarefa, updated_at: new Date().toISOString() }; if (formTarefa.id) await supabase.from('tarefas').update(payload).eq('id', formTarefa.id); else await supabase.from('tarefas').insert([payload]); showToast("Tarefa gravada.", "sucesso"); setModalTarefa(false); carregarTudo(); };
  const excluirTarefa = async (id: number) => { if (confirm("Excluir tarefa?")) { await supabase.from('tarefas').delete().eq('id', id); showToast("Tarefa apagada.", "info"); carregarTudo(); } };
  const alterarStatusTarefaRapido = async (id: number, novoStatus: string) => { await supabase.from('tarefas').update({ status: novoStatus, data_conclusao: novoStatus === 'Concluído' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id); showToast(`Tarefa marcada como ${novoStatus}.`, "sucesso"); carregarTudo(); };

  const enviarWhatsAppLead = (lead: any) => { window.open(`https://wa.me/${lead.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(`Olá ${lead.nome}, tudo bem? Sou da Simples Solução TI.`)}`, '_blank'); };

  const salvarTemplate = async (e: React.FormEvent) => { e.preventDefault(); if (formTemplate.id) await supabase.from('templates').update(formTemplate).eq('id', formTemplate.id); else await supabase.from('templates').insert([formTemplate]); showToast("Template salvo.", "sucesso"); setModalTemplate(false); carregarTudo(); };
  const excluirTemplate = async (id: number) => { if (confirm("Excluir template?")) { await supabase.from('templates').delete().eq('id', id); showToast("Template excluído.", "info"); carregarTudo(); }};

  // ─── CÁLCULOS DO DASHBOARD E AGRUPAMENTOS ──────────────────────────────
  const limiteFiltro = new Date(); if (filtroDias > 0) limiteFiltro.setDate(limiteFiltro.getDate() - filtroDias);
  const pFiltradas = propostas.filter(p => filtroDias === 0 || new Date(p.created_at) >= limiteFiltro);
  const totalPropostas = pFiltradas.length;
  const propostasFechadas = pFiltradas.filter(p => p.status === 'fechada');
  const propostasPerdidas = pFiltradas.filter(p => p.status === 'perdida');
  
  const taxaConversao = totalPropostas > 0 ? (propostasFechadas.length / totalPropostas) * 100 : 0;
  const mrrAtivo = contratos.filter(c => c.status === 'Ativo').reduce((acc, c) => acc + Number(c.valor_mensal), 0);

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
      <style>{`:root{--bg-main:${tema==='dark'?'#080f1e':'#f4f7f9'};--bg-sidebar:${tema==='dark'?'#050a14':'#ffffff'};--bg-card:${tema==='dark'?'rgba(255,255,255,0.02)':'#ffffff'};--text-primary:${tema==='dark'?'#ffffff':'#0f172a'};--text-secondary:${tema==='dark'?'rgba(255,255,255,0.5)':'#64748b'};--border-light:${tema==='dark'?'rgba(255,255,255,0.05)':'#e2e8f0'}} *{box-sizing:border-box;margin:0;padding:0} body{background:var(--bg-main);color:var(--text-primary);font-family:'Outfit',sans-serif}.sidebar{width:260px;background:var(--bg-sidebar);border-right:1px solid var(--border-light);position:fixed;top:0;bottom:0;left:0;display:flex;flex-direction:column;z-index:10}.main-content{flex:1;margin-left:260px;padding:40px}.nav-menu{padding:20px;flex:1;display:flex;flex-direction:column;gap:8px}.nav-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;color:var(--text-secondary);cursor:pointer;border:none;background:transparent;font-weight:600;width:100%;text-align:left}.nav-item.active{background:rgba(74,144,217,0.1);color:#4A90D9}.grid-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:40px}.metric-card{background:var(--bg-card);border:1px solid var(--border-light);border-radius:16px;padding:24px}.table-wrapper{background:var(--bg-card);border:1px solid var(--border-light);border-radius:16px;overflow:hidden;margin-bottom:30px;}table{width:100%;border-collapse:collapse}th{background:rgba(0,0,0,0.1);padding:16px;font-size:12px;text-transform:uppercase;color:var(--text-secondary);text-align:left}td{padding:16px;border-bottom:1px solid var(--border-light);font-size:14px}.badge-status{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase}.btn-action{padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--border-light);background:rgba(255,255,255,0.05);color:var(--text-primary);margin-right:4px;margin-bottom:4px}.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100}.modal-content{background:var(--bg-sidebar);padding:30px;border-radius:20px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto}.input-modal{width:100%;background:var(--bg-main);border:1px solid var(--border-light);color:var(--text-primary);padding:12px;border-radius:8px;margin-bottom:15px;font-family:'Outfit',sans-serif} .toast{position:fixed;bottom:30px;right:30px;padding:16px 24px;border-radius:12px;color:#fff;font-weight:600;z-index:9999;box-shadow:0 10px 25px rgba(0,0,0,0.2);animation:slideIn .3s forwards;display:flex;align-items:center;gap:10px;} @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

      {/* TOAST FLUTUANTE */}
      {toast && (
        <div className="toast" style={{ background: toast.tipo === 'sucesso' ? '#22c55e' : toast.tipo === 'erro' ? '#f87171' : '#4A90D9' }}>
          {toast.tipo === 'sucesso' ? '✅' : toast.tipo === 'erro' ? '❌' : 'ℹ️'} {toast.msg}
        </div>
      )}

      <aside className="sidebar">
        <div style={{padding:"30px",textAlign:"center"}}><img src={tema==='dark'?'/Logo-negativo.webp':'/logo-ssti.webp'} style={{maxHeight:"40px"}}/></div>
        <nav className="nav-menu">
          <button className={`nav-item ${aba==='propostas'?'active':''}`} onClick={()=>setAba('propostas')}>📊 Dashboard</button>
          <button className={`nav-item ${aba==='clientes'?'active':''}`} onClick={()=>setAba('clientes')}>👥 Clientes 360º</button>
          <button className={`nav-item ${aba==='contratos'?'active':''}`} onClick={()=>setAba('contratos')}>📄 Contratos (MRR)</button>
          <button className={`nav-item ${aba==='tarefas'?'active':''}`} onClick={()=>setAba('tarefas')}>✅ Tarefas</button>
          <button className={`nav-item ${aba==='leads'?'active':''}`} onClick={()=>setAba('leads')}>🎯 Leads do Site</button>
          <button className={`nav-item ${aba==='templates'?'active':''}`} onClick={()=>setAba('templates')}>📝 Templates</button>
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
                <option value={30}>30 dias</option><option value={90}>3 Meses</option><option value={0}>Sempre</option>
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
              <div className="metric-card"><div style={{fontSize:"12px",color:"var(--text-secondary)"}}>PROPOSTAS GANHAS</div><div style={{fontSize:"24px",fontWeight:800,color:"#22c55e"}}>{propostasFechadas.length}</div></div>
              <div className="metric-card"><div style={{fontSize:"12px",color:"var(--text-secondary)"}}>PROPOSTAS PERDIDAS</div><div style={{fontSize:"24px",fontWeight:800,color:"#f87171"}}>{propostasPerdidas.length}</div></div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Status</th><th style={{minWidth:"300px", textAlign:"right"}}>Ações</th></tr></thead>
                <tbody>
                  {pFiltradas.map(p => (
                    <tr key={p.id}>
                      <td>{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                      <td><strong>{p.cliente}</strong><br/><small>{p.contato}</small></td>
                      <td>{fmt(p.valor)}</td>
                      <td><span className="badge-status" style={{background:p.status==='fechada'?'#22c55e22':p.status==='perdida'?'#f8717122':'#f59e0b22',color:p.status==='fechada'?'#22c55e':p.status==='perdida'?'#f87171':'#f59e0b'}}>{p.status||'aberta'}</span></td>
                      <td style={{textAlign:"right"}}>
                        <button className="btn-action" onClick={()=>visualizarProposta(p)}>PDF</button>
                        <button className="btn-action" onClick={()=>enviarWhatsApp(p)}>Wpp</button>
                        <button className="btn-action" disabled={enviando===p.id} onClick={()=>enviarPorEmail(p)}>{enviando===p.id?'A enviar...':'E-mail'}</button>
                        {p.status !== 'fechada' && <button className="btn-action" style={{color:"#22c55e",borderColor:"#22c55e"}} onClick={()=>alterarStatusComAutomacao(p,'fechada')}>✓ Ganhou</button>}
                        {p.status !== 'perdida' && <button className="btn-action" style={{color:"#f87171"}} onClick={()=>alterarStatusComAutomacao(p,'perdida')}>Perdeu</button>}
                        <button className="btn-action" style={{color:"#f87171", border:"none"}} onClick={()=>excluirProposta(p.id,p.cliente)}>X</button>
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

        {/* CONTRATOS */}
        {aba === 'contratos' && (
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
                      <td><button className="btn-action" onClick={()=>editarContrato(c)}>Gerir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TAREFAS */}
        {aba === 'tarefas' && (
          <>
            <button onClick={()=>abrirNovaTarefa()} className="btn-action" style={{marginBottom:"20px",background:"#4A90D9",color:"#fff",border:"none"}}>+ Nova Tarefa</button>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Prazo</th><th>Tarefa</th><th>Cliente</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>
                  {tarefas.map(t => (
                    <tr key={t.id} style={{opacity:t.status==='Concluído'?0.5:1}}>
                      <td>{new Date(t.data_vencimento).toLocaleDateString('pt-BR', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                      <td><strong>{t.titulo}</strong></td>
                      <td>{t.nome_referencia}</td>
                      <td>{t.status}</td>
                      <td>
                        {t.status !== 'Concluído' && <button className="btn-action" onClick={()=>alterarStatusTarefaRapido(t.id,'Concluído')}>✓</button>}
                        <button className="btn-action" onClick={()=>editarTarefa(t)}>Editar</button>
                        <button className="btn-action" style={{color:"#f87171"}} onClick={()=>excluirTarefa(t.id)}>X</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
                    <td>
                      <button className="btn-action" onClick={()=>enviarWhatsAppLead(l)}>Wpp</button>
                      <button className="btn-action" onClick={()=>abrirNovaTarefa(`Contato Lead: ${l.empresa}`, l.id)}>+ Tarefa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TEMPLATES */}
        {aba === 'templates' && (
          <>
            <button onClick={()=>{setFormTemplate({nome:"", tipo:"WhatsApp", conteudo:""}); setModalTemplate(true);}} className="btn-action" style={{marginBottom:"20px",background:"#4A90D9",color:"#fff",border:"none"}}>+ Novo Template</button>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Nome</th><th>Tipo</th><th>Conteúdo</th><th>Ação</th></tr></thead>
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

      {/* MODAL DETALHE CLIENTE */}
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

      {/* MODAL TAREFAS E CONTRATOS */}
      {modalTarefa && (
        <div className="modal-overlay" onClick={() => setModalTarefa(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{formTarefa.id ? "Editar Tarefa" : "Nova Tarefa"}</h2>
            <form onSubmit={salvarTarefa} style={{marginTop:"15px",display:"flex",flexDirection:"column",gap:"15px"}}>
              <input required className="input-modal" value={formTarefa.titulo} onChange={e => setFormTarefa({...formTarefa, titulo: e.target.value})} placeholder="Título da tarefa..." />
              <input type="datetime-local" required className="input-modal" value={formTarefa.data_vencimento} onChange={e => setFormTarefa({...formTarefa, data_vencimento: e.target.value})} />
              <select className="input-modal" value={formTarefa.status} onChange={e => setFormTarefa({...formTarefa, status: e.target.value})}>
                <option value="Pendente">Pendente</option><option value="Em andamento">Em andamento</option><option value="Concluído">Concluído</option>
              </select>
              <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
                <button type="button" onClick={() => setModalTarefa(false)} className="btn-action" style={{flex:1}}>Cancelar</button>
                <button type="submit" className="btn-action" style={{flex:1,background:"#4A90D9",color:"#fff",borderColor:"#4A90D9"}}>Gravar</button>
              </div>
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
              <input type="number" step="0.01" required className="input-modal" value={formContrato.valor_mensal || ""} onChange={e => setFormContrato({...formContrato, valor_mensal: Number(e.target.value)})} placeholder="Valor Mensal..." />
              <input type="date" required className="input-modal" value={formContrato.data_inicio} onChange={e => setFormContrato({...formContrato, data_inicio: e.target.value})} />
              <select className="input-modal" value={formContrato.status} onChange={e => setFormContrato({...formContrato, status: e.target.value})}>
                <option value="Ativo">Ativo</option><option value="Suspenso">Suspenso</option><option value="Cancelado">Cancelado</option>
              </select>
              {formContrato.status === 'Cancelado' && (
                <input required className="input-modal" style={{borderColor:"#f87171"}} value={formContrato.motivo_cancelamento} onChange={e => setFormContrato({...formContrato, motivo_cancelamento: e.target.value})} placeholder="Motivo do Cancelamento..." />
              )}
              <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
                <button type="button" onClick={() => setModalContrato(false)} className="btn-action" style={{flex:1}}>Cancelar</button>
                <button type="submit" className="btn-action" style={{flex:1,background:"#4A90D9",color:"#fff",borderColor:"#4A90D9"}}>Gravar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TEMPLATES */}
      {modalTemplate && (
        <div className="modal-overlay" onClick={() => setModalTemplate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{formTemplate.id ? "Editar Template" : "Novo Template"}</h2>
            <p style={{fontSize:"12px",color:"var(--text-secondary)",marginBottom:"15px"}}>Use as variáveis: {'{{nome}}'}, {'{{empresa}}'}, {'{{valor}}'}</p>
            <form onSubmit={salvarTemplate}>
              <input required className="input-modal" value={formTemplate.nome} onChange={e => setFormTemplate({...formTemplate, nome: e.target.value})} placeholder="Nome do Template..." />
              <select className="input-modal" value={formTemplate.tipo} onChange={e => setFormTemplate({...formTemplate, tipo: e.target.value})}>
                <option value="WhatsApp">WhatsApp</option><option value="Email">Email</option>
              </select>
              <textarea required className="input-modal" rows={6} value={formTemplate.conteudo} onChange={e => setFormTemplate({...formTemplate, conteudo: e.target.value})} placeholder="Olá {{nome}}..." />
              <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
                <button type="button" onClick={() => setModalTemplate(false)} className="btn-action" style={{flex:1}}>Cancelar</button>
                <button type="submit" className="btn-action" style={{flex:1,background:"#4A90D9",color:"#fff",borderColor:"#4A90D9"}}>Gravar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
