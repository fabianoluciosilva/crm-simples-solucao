"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ⚠️ MESMA SENHA DA CALCULADORA
const SENHA = "Simples@923";

interface PropostaDB {
  id: number;
  created_at: string;
  numero: string;
  cliente: string;
  contato: string;
  email: string;
  valor: number;
  status: string;
  status_envio: string;
  dados: any;
}

export default function AdminPage() {
  const [input, setInput] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [erro, setErro] = useState(false);

  const [aba, setAba] = useState<"propostas" | "leads">("propostas");
  const [propostas, setPropostas] = useState<PropostaDB[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroDias, setFiltroDias] = useState<number>(30); // Filtro inicial: 30 dias
  const [enviando, setEnviando] = useState<number | null>(null);

  // ─── LOGIN E CARREGAMENTO ──────────────────────────────────────────────────
  const handleLogin = () => {
    if (input === SENHA) {
      setAutenticado(true);
      setErro(false);
    } else {
      setErro(true);
      setInput("");
    }
  };

  useEffect(() => {
    if (autenticado) {
      if (aba === "propostas") carregarDados();
      if (aba === "leads") carregarLeads();
    }
  }, [autenticado, aba]);

  const carregarDados = async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('propostas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setPropostas(data);
    else console.error("Erro ao carregar propostas:", error);
    setCarregando(false);
  };

  const carregarLeads = async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

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

  // ─── DISPARO DE E-MAIL (NOVO) ─────────────────────────────────────────────
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

  // ─── VISUALIZAR PDF ───────────────────────────────────────────────────────
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

  // ─── LÓGICA DE FILTRAGEM TEMPORAL ─────────────────────────────────────────
  const propostasFiltradas = propostas.filter(p => {
    if (fil
