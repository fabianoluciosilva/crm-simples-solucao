"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface PropostaDB {
  id: number;
  created_at: string;
  numero: string;
  cliente: string;
  contato: string;
  telefone?: string;
  email: string;
  valor: number;
  status: string;
  status_envio: string;
  dados: any;
}

export default function AdminPage() {
  const router = useRouter();

  // --- ESTADOS DE AUTENTICAÇÃO ---
  const [session, setSession] = useState<any>(null);
  const [emailLogin, setEmailLogin] = useState("");
  const [senhaLogin, setSenhaLogin] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  const [carregandoAuth, setCarregandoAuth] = useState(true);

  // --- ESTADOS DO CRM ---
  const [aba, setAba] = useState<"propostas" | "leads">("propostas");
  const [propostas, setPropostas] = useState<PropostaDB[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroDias, setFiltroDias] = useState<number>(30); 
  const [enviando, setEnviando] = useState<number | null>(null);

  // ─── LÓGICA DE SESSÃO DO SUPABASE ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCarregandoAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregandoAuth(true);
    setErroLogin("");

    const { error } = await supabase.auth.signInWithPassword({
      email: emailLogin,
      password: senhaLogin,
    });

    if (error) {
      setErroLogin("E-mail ou senha incorretos.");
    }
    setCarregandoAuth(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ─── CARREGAMENTO DE DADOS DO CRM ─────────────────────────────────────────
  useEffect(() => {
    if (session) {
      if (aba === "propostas") carregarDados();
      if (aba === "leads") carregarLeads();
    }
  }, [session, aba]);

  const carregarDados = async () => {
    setCarregando(true);
    const { data, error } = await supabase.from('propostas').select('*').order('created_at', { ascending: false });
    if (!error && data) setPropostas(data);
    else console.error("Erro ao carregar propostas:", error);
    setCarregando(false);
  };

  const carregarLeads = async () => {
    setCarregando(true);
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!error && data) setLeads(data);
    else console.error("Erro ao carregar leads:", error);
    setCarregando(false);
  };

  // ─── AÇÕES DA TABELA ──────────────────────────────────────────────────────
  const excluirProposta = async (id: number, clienteNome: string) => {
    if (confirm(`Tem a certeza que deseja excluir permanentemente a proposta de ${clienteNome}?`)) {
      const { error } = await supabase.from('propostas').delete().eq('id', id);
      if (!error) setPropostas(prev => prev.filter(p => p.id !== id));
    }
  };

  const alterarStatus = async (id: number, novoStatus: string) => {
    const { error } = await supabase.from('propostas').update({ status: novoStatus }).eq('id', id);
    if (!error) setPropostas(prev => prev.map(p => p.id === id ? { ...p, status: novoStatus } : p));
  };

  const enviarWhatsApp = (prop: PropostaDB) => {
    const primeiroNome = prop.contato ? prop.contato.split(" ")[0] : "cliente";
    const texto = `Olá ${primeiroNome}, tudo bem?\n\nSou o Fabiano da Simples Solução TI. Conforme conversamos, estou a enviar em anexo a nossa proposta comercial (cód: ${prop.numero}) para o suporte e gestão da TI da *${prop.cliente}*, no valor mensal de ${fmt(prop.valor)}.\n\nQualquer dúvida, estou à total disposição!`;
    const link = `https://wa.me/${prop.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(texto)}`;
    window.open(link, '_blank');
  };

  const enviarWhatsAppLead = (lead: any) => {
    const msg = `Olá ${lead.nome}, tudo bem? Sou da Simples Solução TI. Vi que você se interessou pela nossa solução de ${lead.produto} pelo nosso site. Podemos conversar um pouco sobre o ambiente da ${lead.empresa}?`;
    window.open(`https://wa.me/${lead.telefone?.replace(/\D/g, "") || ''}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const enviarPorEmail = async (prop: PropostaDB) => {
    if (!prop.email) return alert("Esta proposta não possui o e-mail do cliente cadastrado.");
    if (!confirm(`Confirmar envio de proposta para ${prop.email}?`)) return;

    setEnviando(prop.id);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: prop.email,
          subject: `Proposta Comercial SSTI - ${prop.cliente}`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
              <h2 style="color: #0a1628;">Proposta Comercial - Simples Solução TI</h2>
              <p>Olá <strong>${prop.contato}</strong>,</p>
              <p>É um prazer apresentar nossa proposta de suporte técnico para a <strong>${prop.cliente}</strong>.</p>
              <p>Conforme conversamos, segue o detalhamento dos nossos serviços com foco em evolução contínua e segurança do seu ambiente de TI.</p>
              <p><strong>Valor Mensal Ofertado:</strong> ${fmt(prop.valor)}</p>
              <br />
              <p>Atenciosamente,</p>
              <p><strong>Fabiano Lucio</strong><br />Diretor Comercial | Simples Solução TI<br/>(21) 3529-7993 | www.simplessolucao.com.br</p>
            </div>
          `,
          fileName: `Proposta_${prop.numero}.pdf`
        }),
      });

      if (response.ok) {
        alert("E-mail enviado com sucesso!");
        await supabase.from('propostas').update({ status_envio: 'enviado' }).eq('id', prop.id);
        carregarDados();
      } else {
        alert("Falha ao enviar e-mail. Verifique a API.");
      }
    } catch (error) {
      alert("Erro na conexão com o servidor de e-mail.");
    } finally {
      setEnviando(null);
    }
  };

  const visualizarProposta = (prop: PropostaDB) => {
    const dataFormatada = new Date(prop.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' });
    const nomeCliente = prop.cliente || "Empresa Não Identificada";
    const nomeContato = prop.contato || "Cliente";
    const obs = prop.dados?.obs || "";
    const origin = window.location.origin;

    const w = window.open("", "_blank")!;
    w.document.write(`
      <html><head><title>Proposta Comercial - ${nomeCliente}</title>
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
          <div class="info-doc"><strong>Proposta:</strong> ${prop.numero}<br><strong>Data:</strong> ${dataFormatada}<br><strong>Empresa:</strong> ${nomeCliente}</div>
        </div>
        <h1>PROPOSTA DE SUPORTE TÉCNICO</h1>
        <p>Rio de Janeiro, ${dataFormatada}</p>
        <p>Prezada(o) <strong>${nomeContato}</strong>,</p>
        <p>Agradecemos a oportunidade de apresentar a nossa empresa e discutir possíveis caminhos para o futuro da <strong>${nomeCliente}</strong>. Agradecemos ainda pela oportunidade de propor, por meio desta, uma parceria na área de tecnologia da informação.</p>
        <p>Este documento tem como objetivo definir o escopo de trabalho a ser empregado na prestação de serviço de suporte de informática à <strong>${nomeCliente}</strong>. Esse serviço tem o objetivo de auxiliar o ambiente de TI da empresa para uma evolução contínua, minimizando problemas e possíveis riscos existentes.</p>
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
        <p>Mão de obra técnica utilizada em visitas à <strong>${nomeCliente}</strong> ou remotamente com o objetivo de prestar suporte ao usuário e atendimentos necessários.</p>
        <h4>Benefícios:</h4>
        <ul><li><strong>Garantia de Serviço:</strong> Atendimento remoto (conexão através de TeamViewer ou AnyDesk).</li><li><strong>Políticas de Backup:</strong> A única forma de garantir a qualidade dos backups é testá-los recorrentemente. Além disso, são estabelecidos prazos máximos para retorno dos serviços mais críticos.</li><li><strong>Checklists Preventivos:</strong> De acordo com periodicidades especificadas, configurações de software e hardware são checados de forma a evitar paradas subsequentes.</li><li><strong>Suporte Telefônico:</strong> Resolução ágil de problemas via telefone, evitando perda de tempo dos funcionários.</li><li><strong>Implantação de Novas Soluções:</strong> A Simples Solução TI participa da especificação e implantação de soluções diferenciadas.</li><li><strong>Manutenção de Hardware:</strong> Consertos realizados em laboratório próprio mediante aprovação prévia.</li></ul>
        <div class="page-break"></div>
        <h2>Proposta Comercial</h2>
        <p>Contrato de suporte inicial da <strong>${nomeCliente}</strong>:</p>
        <table>
          <tr><th>Descrição do Serviço</th><th style="text-align: right; width: 200px;">Valor Mensal</th></tr>
          <tr class="row-total"><td style="padding: 20px 12px;">Manutenção TI</td><td style="text-align: right; color: #4A90D9; padding: 20px 12px;">${fmt(prop.valor)}</td></tr>
        </table>
        ${obs ? `<h3>Escopo Adicional / Observações</h3><p style="background: #f8f9fa; padding: 15px; border-left: 4px solid #4A90D9;">${obs.replace(/\n/g, '<br>')}</p>` : ""}
        <h2>Considerações Finais</h2>
        <ul><li>Esta proposta é válida por 30 dias a partir da data de emissão.</li><li>Maiores informações sobre os serviços da Simples Solução TI podem ser encontradas em <strong>www.simplessolucao.com.br</strong>.</li><li>Colocamo-nos à disposição para quaisquer esclarecimentos.</li></ul>
      </div>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => { w.document.title = `Proposta_${nomeCliente.replace(/\s+/g, '_')}_${prop.numero}`; w.print(); }, 500);
  };

  const propostasFiltradas = propostas.filter(p => {
    if (filtroDias === 0) return true; 
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - filtroDias);
    return new Date(p.created_at) >= dataLimite;
  });

  const totalPropostas = propostasFiltradas.length;
  const propostasFechadas = propostasFiltradas.filter(p => p.status === 'fechada');
  const propostasPerdidas = propostasFiltradas.filter(p => p.status === 'perdida');
  
  const taxaConversao = totalPropostas > 0 ? (propostasFechadas.length / totalPropostas) * 100 : 0;
  
  const volumeFinanceiro = propostasFiltradas.reduce((acc, p) => acc + (p.valor || 0), 0);
  const receitaFechada = propostasFechadas.reduce((acc, p) => acc + (p.valor || 0), 0);
  const ticketMedio = totalPropostas > 0 ? volumeFinanceiro / totalPropostas : 0;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (carregandoAuth) {
    return <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#4A90D9", fontFamily: "sans-serif" }}>Verificando credenciais...</div>;
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap'); * { box-sizing: border-box; }`}</style>
        <div style={{ width: "100%", maxWidth: 400, background: "rgba(255,255,255,0.04)", border: `1px solid ${erroLogin ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 20, padding: "40px 36px", transition: "border-color 0.2s" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4A90D9", marginBottom: 10 }}>Simples Solução TI</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>CRM Comercial</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Painel Administrativo Restrito</div>
          </div>
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <input 
                type="email" 
                value={emailLogin} 
                onChange={e => setEmailLogin(e.target.value)} 
                placeholder="Seu E-mail Corporativo" 
                required
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 14, padding: "12px 16px", outline: "none" }} 
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <input 
                type="password" 
                value={senhaLogin} 
                onChange={e => setSenhaLogin(e.target.value)} 
                placeholder="Senha" 
                required
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: 14, padding: "12px 16px", outline: "none", letterSpacing: "0.15em" }} 
              />
            </div>
            
            {erroLogin && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 16, textAlign: "center", fontFamily: "'Outfit', sans-serif" }}>{erroLogin}</div>}

            <button type="submit" disabled={carregandoAuth} style={{ width: "100%", padding: "13px", borderRadius: 10, background: "#4A90D9", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", border: "none", cursor: carregandoAuth ? "not-allowed" : "pointer", opacity: carregandoAuth ? 0.7 : 1 }}>
              Fazer Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080f1e", color: "#fff", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        
        .tabs { display: flex; gap: 24px; margin-top: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .tab-btn { background: transparent; border: none; padding: 12px 0; color: rgba(255,255,255,0.4); font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; transition: color 0.2s; border-bottom: 2px solid transparent; }
        .tab-btn:hover { color: rgba(255,255,255,0.8); }
        .tab-btn.active { color: #4A90D9; border-bottom-color: #4A90D9; }

        .grid-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-top: 32px; margin-bottom: 40px; }
        .metric-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 8px; }
        .metric-title { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
        .metric-value { font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 800; color: #fff; }
        .metric-value.highlight { color: #4A90D9; }
        .metric-value.success { color: #22c55e; }
        
        .table-wrapper { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: rgba(255,255,255,0.4); padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); }
        td { font-family: 'Outfit', sans-serif; font-size: 14px; color: rgba(255,255,255,0.8); padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(255,255,255,0.02); }
        
        .badge-status { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-family: 'Outfit', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .badge-aberta { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
        .badge-fechada { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
        .badge-perdida { background: rgba(156,163,175,0.15); color: #9ca3af; border: 1px solid rgba(156,163,175,0.3); }
        .badge-email { background: rgba(168,85,247,0.15); color: #a855f7; border: 1px solid rgba(168,85,247,0.3); margin-top: 4px;}
        
        .btn-action { padding: 6px 12px; border-radius: 6px; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
        .btn-view { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.2); margin-right: 8px; }
        .btn-view:hover { background: rgba(255,255,255,0.2); }
        .btn-wpp { background: rgba(34,197,94,0.1); color: #22c55e; border-color: rgba(34,197,94,0.2); margin-right: 8px; }
        .btn-wpp:hover { background: rgba(34,197,94,0.2); }
        .btn-email { background: rgba(168,85,247,0.1); color: #a855f7; border-color: rgba(168,85,247,0.2); margin-right: 8px; }
        .btn-email:hover { background: rgba(168,85,247,0.2); }
        .btn-email:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-win { background: rgba(74,144,217,0.1); color: #4A90D9; border-color: rgba(74,144,217,0.2); margin-right: 8px; }
        .btn-win:hover { background: rgba(74,144,217,0.2); }
        .btn-loss { background: rgba(156,163,175,0.1); color: #9ca3af; border-color: rgba(156,163,175,0.2); margin-right: 8px; }
        .btn-loss:hover { background: rgba(156,163,175,0.2); }
        .btn-reopen { background: rgba(245,158,11,0.1); color: #f59e0b; border-color: rgba(245,158,11,0.2); margin-right: 8px; }
        .btn-reopen:hover { background: rgba(245,158,11,0.2); }
        .btn-delete { background: transparent; color: #f87171; }
        .btn-delete:hover { text-decoration: underline; }
        
        .btn-logout { background: transparent; border: 1px solid rgba(248,113,113,0.3); color: #f87171; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; margin-left: 16px; transition: 0.2s; }
        .btn-logout:hover { background: rgba(248,113,113,0.1); }
      `}</style>

      {/* HEADER */}
      <div style={{ paddingTop: "20px" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4A90D9", marginBottom: 4 }}>Gestão Comercial</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>Painel de Oportunidades</div>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
             <div style={{ textAlign: "right", marginRight: "16px", display: "block" }}>
               <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "'Outfit', sans-serif" }}>Logado como:</span><br/>
               <strong style={{ fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>{session.user.email}</strong>
            </div>
            <button onClick={() => router.push('/preco')} style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              + Nova Proposta
            </button>
            <button onClick={handleLogout} className="btn-logout">Sair</button>
          </div>
        </div>
      </div>

      <div className="container">
        {/* NAVEGAÇÃO DE ABAS */}
        <div className="tabs">
          <button className={`tab-btn ${aba === 'propostas' ? 'active' : ''}`} onClick={() => setAba('propostas')}>
            Propostas Enviadas
          </button>
          <button className={`tab-btn ${aba === 'leads' ? 'active' : ''}`} onClick={() => setAba('leads')}>
            Leads do Site
          </button>
        </div>

        {/* ===================== ABA DE PROPOSTAS ===================== */}
        {aba === "propostas" && (
          <>
            {/* FILTRO DE PERÍODO */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <select 
                value={filtroDias} 
                onChange={e => setFiltroDias(Number(e.target.value))}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff",
                  padding: "10px 16px", borderRadius: "8px", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 600, outline: "none", cursor: "pointer"
                }}
              >
                <option value={30} style={{ color: "#000" }}>Último Mês (30 dias)</option>
                <option value={90} style={{ color: "#000" }}>Últimos 3 Meses</option>
                <option value={180} style={{ color: "#000" }}>Últimos 6 Meses</option>
                <option value={365} style={{ color: "#000" }}>Último Ano</option>
                <option value={0} style={{ color: "#000" }}>Todo o Histórico</option>
              </select>
            </div>

            {/* CARDS DE MÉTRICAS */}
            <div className="grid-metrics">
              <div className="metric-card">
                <div className="metric-title">Propostas / Orçado</div>
                <div className="metric-value">{carregando ? "-" : totalPropostas} <span style={{fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: 400}}>| {fmt(volumeFinanceiro)}</span></div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Taxa de Conversão</div>
                <div className="metric-value highlight">{carregando ? "-" : taxaConversao.toFixed(1)}%</div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Novos Contratos (Fechados)</div>
                <div className="metric-value success">{carregando ? "-" : propostasFechadas.length} <span style={{fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: 400}}>| {fmt(receitaFechada)}</span></div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Ticket Médio Ofertado</div>
                <div className="metric-value" style={{ color: "#fff" }}>{carregando ? "-" : fmt(ticketMedio)}</div>
              </div>
            </div>

            {/* TABELA DE PROPOSTAS */}
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
              Pipeline de Vendas
              {carregando && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>Carregando dados...</span>}
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Empresa (Cliente)</th>
                    <th>Valor Mensal</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {propostasFiltradas.length === 0 && !carregando && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.4)" }}>
                        Nenhuma proposta encontrada neste período.
                      </td>
                    </tr>
                  )}
                  {propostasFiltradas.map(prop => (
                    <tr key={prop.id} style={{ opacity: prop.status === 'perdida' ? 0.6 : 1 }}>
                      <td>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{new Date(prop.created_at).toLocaleDateString('pt-BR')}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#4A90D9", marginTop: 2 }}>{prop.numero}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#fff" }}>{prop.cliente}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Contato: {prop.contato || "—"}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{prop.email || "Sem e-mail cadastrado"}</div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color: prop.status === 'fechada' ? '#22c55e' : prop.status === 'perdida' ? '#9ca3af' : '#fff' }}>
                        {fmt(prop.valor)}
                      </td>
                      <td>
                        <div>
                          <span className={`badge-status ${prop.status === 'fechada' ? 'badge-fechada' : prop.status === 'perdida' ? 'badge-perdida' : 'badge-aberta'}`}>
                            {prop.status === 'fechada' ? 'Venda Fechada' : prop.status === 'perdida' ? 'Perdida' : 'Aguardando'}
                          </span>
                        </div>
                        {prop.status_envio === 'enviado' && (
                          <div style={{ marginTop: 4 }}>
                            <span className="badge-status badge-email">E-mail Enviado</span>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right", minWidth: 320 }}>
                        <button className="btn-action btn-view" onClick={() => visualizarProposta(prop)}>PDF</button>
                        <button className="btn-action btn-wpp" onClick={() => enviarWhatsApp(prop)}>Wpp</button>
                        <button className="btn-action btn-email" disabled={enviando === prop.id} onClick={() => enviarPorEmail(prop)}>
                          {enviando === prop.id ? "Enviando..." : "E-mail"}
                        </button>
                        
                        {(!prop.status || prop.status === 'aberta') ? (
                          <>
                            <button className="btn-action btn-win" onClick={() => alterarStatus(prop.id, 'fechada')}>Ganho</button>
                            <button className="btn-action btn-loss" onClick={() => alterarStatus(prop.id, 'perdida')}>Perdido</button>
                          </>
                        ) : (
                          <button className="btn-action btn-reopen" onClick={() => alterarStatus(prop.id, 'aberta')}>Reabrir</button>
                        )}

                        <button className="btn-action btn-delete" onClick={() => excluirProposta(prop.id, prop.cliente)}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ===================== ABA DE LEADS ===================== */}
        {aba === "leads" && (
          <div style={{ marginTop: 24 }}>
             <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
              Capturas Recentes
              {carregando && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>Carregando dados...</span>}
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Lead</th>
                    <th>Interesse</th>
                    <th style={{ textAlign: "right" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 && !carregando && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.4)" }}>
                        Nenhum lead recebido ainda.
                      </td>
                    </tr>
                  )}
                  {leads.map(lead => (
                    <tr key={lead.id}>
                      <td>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#fff" }}>{lead.empresa}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{lead.nome} • {lead.telefone}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{lead.email}</div>
                      </td>
                      <td>
                        <span className="badge-status badge-aberta" style={{ background: "rgba(74,144,217,0.15)", color: "#4A90D9", borderColor: "rgba(74,144,217,0.3)" }}>
                          {lead.produto} - {lead.plano}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn-action btn-wpp" onClick={() => enviarWhatsAppLead(lead)}>Chamar no WhatsApp</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
