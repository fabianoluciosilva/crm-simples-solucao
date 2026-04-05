"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── CONSTANTES FINANCEIRAS OCULTAS ──────────────────────────────────────────
const CUSTO_OPERACIONAL_MENSAL = 35000;
const FATURAMENTO_ATUAL = 55000;
const CLIENTES_ATIVOS = 51;
const CUSTO_MEDIO_POR_CLIENTE = CUSTO_OPERACIONAL_MENSAL / CLIENTES_ATIVOS;

// ─── TIPOS ───────────────────────────────────────────────────────────────────
interface ItensMeta { label: string; unidade: string; }
interface Qtd {
  computador: number; servidor: number; backupLocalEst: number; backupLocalSrv: number;
  backupNuvemEst: number; backupNuvemSrv: number; firewall: number; cftv: number;
  pabx: number; tecnicoHora: number; deslocamentoKm: number; deslocamentoVisitas: number;
}
interface LicencaCustom {
  id: string; nome: string; preco: number; qtd: number;
}

const ITENS_META: Record<string, ItensMeta> = {
  computador:     { label: "Computador / Estação",     unidade: "por estação/mês"  },
  servidor:       { label: "Servidor",                 unidade: "por servidor/mês" },
  backupLocalEst: { label: "Backup local – Estações",  unidade: "por estação/mês"  },
  backupLocalSrv: { label: "Backup local – Servidor",  unidade: "por servidor/mês" },
  backupNuvemEst: { label: "Backup nuvem – Estações",  unidade: "por estação/mês"  },
  backupNuvemSrv: { label: "Backup nuvem – Servidor",  unidade: "por servidor/mês" },
  firewall:       { label: "Firewall Gerenciado",      unidade: "fixo/mês"         },
  cftv:           { label: "CFTV – Câmeras",           unidade: "por câmera/mês"   },
  pabx:           { label: "PABX em Nuvem",            unidade: "fixo/mês"         },
  tecnicoHora:    { label: "Técnico Presencial",       unidade: "por hora/mês"     },
  deslocamento:   { label: "Deslocamento (km/visita)", unidade: "R$/km ida+volta"  },
};

const PRECOS_BASE = {
  computador: 65, servidor: 300, backupLocalEst: 15, backupLocalSrv: 60,
  backupNuvemEst: 25, backupNuvemSrv: 90, firewall: 350, cftv: 25,
  pabx: 250, tecnicoHora: 120, deslocamento: 1.5,
};

const COR_TEMA = "#4A90D9";
const PRECOS = Object.fromEntries(
  Object.entries(ITENS_META).map(([k, v]) => [k, { ...v, valor: PRECOS_BASE[k as keyof typeof PRECOS_BASE] }])
);
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const CalculadoraSSTI = () => {
  const router = useRouter();

  const [cliente, setCliente] = useState("");
  const [contato, setContato] = useState("");
  const [email, setEmail] = useState(""); 
  const [precos, setPrecos] = useState<Record<string, number>>({ ...PRECOS_BASE });
  const [qtd, setQtd] = useState<Qtd>({
    computador: 0, servidor: 0, backupLocalEst: 0, backupLocalSrv: 0, backupNuvemEst: 0,
    backupNuvemSrv: 0, firewall: 0, cftv: 0, pabx: 0, tecnicoHora: 0,
    deslocamentoKm: 0, deslocamentoVisitas: 1,
  });
  
  const [licencasCustom, setLicencasCustom] = useState<LicencaCustom[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  // ─── CÁLCULOS ──────────────────────────────────────────────────────────────
  const linhas = [
    { key: "computador", qty: qtd.computador, preco: precos.computador },
    { key: "servidor", qty: qtd.servidor, preco: precos.servidor },
    { key: "backupLocalEst", qty: qtd.backupLocalEst, preco: precos.backupLocalEst },
    { key: "backupLocalSrv", qty: qtd.backupLocalSrv, preco: precos.backupLocalSrv },
    { key: "backupNuvemEst", qty: qtd.backupNuvemEst, preco: precos.backupNuvemEst },
    { key: "backupNuvemSrv", qty: qtd.backupNuvemSrv, preco: precos.backupNuvemSrv },
    { key: "firewall", qty: qtd.firewall, preco: precos.firewall },
    { key: "cftv", qty: qtd.cftv, preco: precos.cftv },
    { key: "pabx", qty: qtd.pabx, preco: precos.pabx },
    { key: "tecnicoHora", qty: qtd.tecnicoHora, preco: precos.tecnicoHora },
  ].map(l => ({ ...l, subtotal: l.qty * l.preco }));

  const custoDeslocamento = qtd.deslocamentoKm * precos.deslocamento * 2 * qtd.deslocamentoVisitas;
  const subtotalLicencas = licencasCustom.reduce((acc, lic) => acc + ((lic.preco || 0) * (lic.qtd || 0)), 0);
  
  const subtotalServicos = linhas.reduce((a, l) => a + l.subtotal, 0) + custoDeslocamento + subtotalLicencas;
  const valorDesconto = subtotalServicos * (desconto / 100);
  const valorFinal = subtotalServicos - valorDesconto;
  
  const custoRateado = CUSTO_MEDIO_POR_CLIENTE;
  const lucroAbsoluto = valorFinal - custoRateado;
  const margemPct = valorFinal > 0 ? (lucroAbsoluto / valorFinal) * 100 : 0;
  const sinalMargem = margemPct >= 40 ? "excelente" : margemPct >= 25 ? "ok" : "atencao";
  const margemCor = sinalMargem === "excelente" ? "#22c55e" : sinalMargem === "ok" ? "#f59e0b" : "#ef4444";

  // ─── SALVAR E IMPRIMIR ────────────────────────────────────────────────────
  const imprimirESalvar = useCallback(async () => {
    setSalvando(true);
    const d = new Date();
    const numeroProposta = `SSTI-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`;
    const dataFormatada = d.toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' });
    const nomeCliente = cliente || "Empresa Não Identificada";
    const nomeContato = contato || "Cliente";

    const { error } = await supabase
      .from('propostas')
      .insert([{
        numero: numeroProposta,
        cliente: nomeCliente,
        contato: nomeContato,
        email: email, 
        valor: valorFinal,
        status: 'aberta',
        origem: 'calculadora',
        dados: { qtd, precos, desconto, obs, licencasCustom } 
      }]);

    if (error) {
      alert("ERRO AO SALVAR: " + error.message);
      setSalvando(false);
      return;
    }

    setSalvando(false);

    // Geração do PDF
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
          <div class="info-doc"><strong>Proposta:</strong> ${numeroProposta}<br><strong>Data:</strong> ${dataFormatada}<br><strong>Empresa:</strong> ${nomeCliente}</div>
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
          <tr class="row-total"><td style="padding: 20px 12px;">Manutenção TI</td><td style="text-align: right; color: #4A90D9; padding: 20px 12px;">${fmt(valorFinal)}</td></tr>
        </table>
        ${obs ? `<h3>Escopo Adicional / Observações</h3><p style="background: #f8f9fa; padding: 15px; border-left: 4px solid #4A90D9;">${obs.replace(/\n/g, '<br>')}</p>` : ""}
        <h2>Considerações Finais</h2>
        <ul><li>Esta proposta é válida por 30 dias a partir da data de emissão.</li><li>Maiores informações sobre os serviços da Simples Solução TI podem ser encontradas em <strong>www.simplessolucao.com.br</strong>.</li><li>Colocamo-nos à disposição para quaisquer esclarecimentos.</li></ul>
      </div>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => { w.document.title = `Proposta_${nomeCliente.replace(/\s+/g, '_')}_${numeroProposta}`; w.print(); }, 500);
  }, [cliente, contato, email, obs, valorFinal, qtd, precos, desconto, licencasCustom]);

  const setQ = (key: string, val: string) => setQtd(q => ({ ...q, [key]: Math.max(0, Number(val)) }));
  const setP = (key: string, val: string) => setPrecos(p => ({ ...p, [key]: Math.max(0, Number(val)) }));

  const addLicenca = () => { setLicencasCustom([...licencasCustom, { id: Math.random().toString(36).substr(2, 9), nome: "", preco: 0, qtd: 1 }]); };
  const updateLicenca = (id: string, field: keyof LicencaCustom, value: string | number) => { setLicencasCustom(prev => prev.map(lic => lic.id === id ? { ...lic, [field]: value } : lic)); };
  const removeLicenca = (id: string) => { setLicencasCustom(prev => prev.filter(lic => lic.id !== id)); };

  const inputStyle: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: 14, padding: "8px 12px", width: "100%", outline: "none", transition: "border-color 0.2s" };
  const labelStyle: React.CSSProperties = { fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 6, display: "block" };

  const renderRow = (key: string, label: string, sub: string = "") => (
    <div className="item-row" key={key}>
      <div><div className="item-label">{label}</div><div className="item-sub">{sub || ITENS_META[key].unidade}</div></div>
      <div><label style={{ ...labelStyle, fontSize: 10, marginBottom: 4 }}>Valor (R$)</label><input type="number" min="0" step="1" style={{...inputStyle, color: COR_TEMA}} value={precos[key] ?? ""} onChange={e => setP(key, e.target.value)} /></div>
      <div><label style={{ ...labelStyle, fontSize: 10, marginBottom: 4 }}>Qtd</label><input type="number" min="0" style={inputStyle} value={qtd[key as keyof Qtd] || ""} placeholder="0" onChange={e => setQ(key, e.target.value)} /></div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080f1e", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #080f1e; } ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }
        input:focus, textarea:focus { border-color: rgba(74,144,217,0.6) !important; } input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        .calc-grid { display: grid; grid-template-columns: 1fr 380px; gap: 24px; max-width: 1200px; margin: 0 auto; padding: 32px 24px 60px; }
        @media(max-width:900px){ .calc-grid { grid-template-columns: 1fr; } }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .section-title { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #4A90D9; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; justify-content: space-between; }
        .section-title::after { content: ''; flex: 1; height: 1px; background: rgba(74,144,217,0.2); margin-left: 8px;}
        .item-row { display: grid; grid-template-columns: 1fr 100px 90px; gap: 12px; align-items: end; margin-bottom: 16px; }
        .item-label { font-family: 'Outfit', sans-serif; font-size: 14px; color: rgba(255,255,255,0.8); }
        .item-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .desloc-row { display: grid; grid-template-columns: 1fr 80px 80px; gap: 12px; align-items: end; margin-bottom: 14px; }
        .resumo-linha { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-family: 'Outfit', sans-serif; font-size: 14px; }
        .resumo-linha:last-child { border-bottom: none; }
        .resumo-key { color: rgba(255,255,255,0.6); }
        .resumo-val { color: #fff; font-family: 'DM Mono', monospace; font-weight: 500; }
        .resumo-val.destaque { color: #4A90D9; font-size: 22px; font-weight: 600; }
        .btn { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 14px 20px; border-radius: 10px; border: none; cursor: pointer; transition: all 0.2s; width: 100%; margin-bottom: 12px; }
        .btn-primary { background: #4A90D9; color: #fff; box-shadow: 0 4px 15px rgba(74,144,217,0.3); } .btn-primary:hover { background: #3a7bc8; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-outline { background: transparent; color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.15); } .btn-outline:hover { border-color: rgba(255,255,255,0.4); color: #fff; }
        .tag-item { display: inline-flex; align-items: center; gap: 6px; background: rgba(74,144,217,0.1); border: 1px solid rgba(74,144,217,0.2); border-radius: 6px; padding: 4px 12px; font-family: 'DM Mono', monospace; font-size: 12px; color: #7db8f0; margin: 3px; }
        .margem-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; }
        .tooltip { position: relative; cursor: help; } .tooltip:hover .tip { display: block; }
        .tip { display: none; position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); background: #1e3a5f; color: #fff; font-size: 11px; padding: 6px 10px; border-radius: 6px; white-space: nowrap; font-family: 'Outfit', sans-serif; z-index: 10; }
        
        .client-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        @media(max-width:768px){ .client-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* HEADER SIMPLIFICADO */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1200, margin: "0 auto" }}>
        <div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4A90D9", marginBottom: 4 }}>Simples Solução TI</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: "#fff" }}>Gerador de Propostas</div>
        </div>
        <button onClick={() => router.push('/admin')} style={{ background: "transparent", color: "#4A90D9", border: "1px solid rgba(74,144,217,0.3)", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "rgba(74,144,217,0.1)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
          Voltar ao Admin
        </button>
      </div>

      <div className="calc-grid">
        {/* COLUNA ESQUERDA - FORMULÁRIO */}
        <div>
          <div className="card">
            <div className="section-title">Dados do Cliente</div>
            <div className="client-grid">
              <div><label style={labelStyle}>Nome da Empresa</label><input style={{ ...inputStyle, fontSize: 15, fontFamily: "'Outfit', sans-serif" }} placeholder="Ex: Empresa Gerastar Ltda." value={cliente} onChange={e => setCliente(e.target.value)} /></div>
              <div><label style={labelStyle}>Nome do Contato</label><input style={{ ...inputStyle, fontSize: 15, fontFamily: "'Outfit', sans-serif" }} placeholder="Ex: João Silva" value={contato} onChange={e => setContato(e.target.value)} /></div>
              <div><label style={labelStyle}>E-mail do Cliente</label><input type="email" style={{ ...inputStyle, fontSize: 15, fontFamily: "'Outfit', sans-serif" }} placeholder="Ex: joao@empresa.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
            </div>
          </div>

          <div className="card"><div className="section-title">Infraestrutura</div>{renderRow("computador", "Computadores / Estações", "Gestão + suporte por estação")}{renderRow("servidor", "Servidores", "Gestão por servidor")}</div>
          
          <div className="card">
            <div className="section-title">Licenciamento de Software</div>
            {licencasCustom.map(lic => (
              <div className="item-row" key={lic.id} style={{ gridTemplateColumns: "1fr 100px 90px 30px" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10, marginBottom: 4 }}>Nome / Versão</label>
                  <input type="text" style={{ ...inputStyle, fontFamily: "'Outfit', sans-serif" }} placeholder="Ex: Office 365..." value={lic.nome} onChange={e => updateLicenca(lic.id, "nome", e.target.value)} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10, marginBottom: 4 }}>Valor (R$)</label>
                  <input type="number" min="0" step="1" style={{ ...inputStyle, color: COR_TEMA }} value={lic.preco || ""} onChange={e => updateLicenca(lic.id, "preco", Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10, marginBottom: 4 }}>Qtd</label>
                  <input type="number" min="0" style={inputStyle} value={lic.qtd || ""} placeholder="0" onChange={e => updateLicenca(lic.id, "qtd", Number(e.target.value))} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 8 }}>
                  <button onClick={() => removeLicenca(lic.id)} style={{ background: "transparent", border: "none", color: "rgba(248,113,113,0.8)", cursor: "pointer", fontSize: 24, lineHeight: 1 }}>×</button>
                </div>
              </div>
            ))}
            <button className="btn btn-outline" style={{ marginTop: 10, padding: "10px", fontSize: 11, marginBottom: 0, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.2)" }} onClick={addLicenca}>
              + Adicionar Software/Licença
            </button>
          </div>

          <div className="card"><div className="section-title">Backup</div>{renderRow("backupLocalEst", "Backup Local – Estações")}{renderRow("backupLocalSrv", "Backup Local – Servidores")}{renderRow("backupNuvemEst", "Backup Nuvem – Estações")}{renderRow("backupNuvemSrv", "Backup Nuvem – Servidores")}</div>
          <div className="card">
            <div className="section-title">Serviços Adicionais</div>
            {renderRow("firewall", "Firewall Gerenciado")}{renderRow("cftv", "CFTV – Câmeras")}{renderRow("pabx", "PABX em Nuvem")}{renderRow("tecnicoHora", "Técnico Presencial", "Horas mensais avulsas")}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="item-label" style={{ ...labelStyle, marginBottom: 10, color: "#fff" }}>Deslocamento</div>
              <div className="desloc-row">
                <div><div style={{ ...labelStyle, fontSize: 11 }}>Dist. (km ida)</div><input type="number" min="0" style={inputStyle} value={qtd.deslocamentoKm || ""} placeholder="0" onChange={e => setQ("deslocamentoKm", e.target.value)} /></div>
                <div><div style={{ ...labelStyle, fontSize: 11 }}>Visitas/mês</div><input type="number" min="1" style={inputStyle} value={qtd.deslocamentoVisitas || ""} placeholder="1" onChange={e => setQ("deslocamentoVisitas", e.target.value)} /></div>
                <div><div style={{ ...labelStyle, fontSize: 11 }}>R$/km</div><input type="number" min="0" step="0.1" style={{...inputStyle, color: COR_TEMA}} value={precos.deslocamento || ""} placeholder="1.5" onChange={e => setP("deslocamento", e.target.value)} /></div>
              </div>
              {qtd.deslocamentoKm > 0 && (<div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>{qtd.deslocamentoKm}km × 2 × {qtd.deslocamentoVisitas}x = {qtd.deslocamentoKm * 2 * qtd.deslocamentoVisitas}km totais · {fmt(custoDeslocamento)}</div>)}
            </div>
          </div>
          <div className="card">
            <div className="section-title">Ajustes Finais</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div><label style={labelStyle}>Desconto (%)</label><input type="number" min="0" max="50" style={inputStyle} value={desconto || ""} placeholder="0" onChange={e => setDesconto(Math.min(50, Math.max(0, Number(e.target.value))))} /></div>
              <div style={{ display: "flex", alignItems: "flex-end" }}><div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: desconto > 0 ? "#f87171" : "rgba(255,255,255,0.3)", padding: "9px 0" }}>{desconto > 0 ? `− ${fmt(valorDesconto)} no total` : "Sem desconto aplicado"}</div></div>
            </div>
            <label style={labelStyle}>Observações / Escopo adicional</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: "'Outfit', sans-serif", fontSize: 13 }} placeholder="Ex: inclui suporte ao sistema ERP..." value={obs} onChange={e => setObs(e.target.value)} />
          </div>
        </div>

        {/* COLUNA DIREITA - RESUMO E AÇÕES */}
        <div style={{ position: "sticky", top: 24, alignSelf: "start" }}>
          
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Resumo do Contrato</div>
            <div style={{ marginBottom: 16, minHeight: 30 }}>
              {linhas.filter(l => l.qty > 0).map(l => (<span key={l.key} className="tag-item">{PRECOS[l.key].label.split("–")[0].trim()} ×{l.qty}</span>))}
              {licencasCustom.filter(l => l.qtd > 0 && l.nome.trim() !== "").map(l => (<span key={l.id} className="tag-item">{l.nome} ×{l.qtd}</span>))}
              {qtd.deslocamentoKm > 0 && <span className="tag-item">Deslocamento</span>}
              {linhas.every(l => l.qty === 0) && licencasCustom.every(l => l.qtd === 0) && qtd.deslocamentoKm === 0 && (<span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Nenhum item adicionado ainda</span>)}
            </div>
            <div style={{ marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
              <div className="resumo-linha"><span className="resumo-key">Subtotal serviços</span><span className="resumo-val">{fmt(subtotalServicos)}</span></div>
              {desconto > 0 && (<div className="resumo-linha"><span className="resumo-key">Desconto ({desconto}%)</span><span className="resumo-val" style={{ color: "#f87171" }}>− {fmt(valorDesconto)}</span></div>)}
              <div className="resumo-linha" style={{ paddingTop: 14, paddingBottom: 14 }}><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff" }}>Valor Mensal</span><span className="resumo-val destaque">{fmt(valorFinal)}</span></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Análise Interna (Margem)</div>
            <div className="resumo-linha"><span className="resumo-key tooltip">Custo rateado<span className="tip">Custo operacional ÷ nº de clientes</span></span><span className="resumo-val">{fmt(custoRateado)}</span></div>
            <div className="resumo-linha"><span className="resumo-key">Lucro estimado</span><span className="resumo-val" style={{ color: lucroAbsoluto >= 0 ? "#22c55e" : "#f87171" }}>{fmt(lucroAbsoluto)}</span></div>
            <div className="resumo-linha" style={{ paddingTop: 14 }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>Margem</span>
              <span className="margem-badge" style={{ background: `${margemCor}18`, border: `1px solid ${margemCor}40`, color: margemCor }}>{margemPct.toFixed(1)}% {sinalMargem === "excelente" && " ✓ Excelente"} {sinalMargem === "ok" && " ⚠ Aceitável"} {sinalMargem === "atencao" && " ✕ Atenção"}</span>
            </div>
          </div>

          <button className="btn btn-primary" onClick={imprimirESalvar} disabled={salvando}>
            {salvando ? "Processando..." : "↓ Gerar Proposta & Salvar"}
          </button>
          
          <button className="btn btn-outline" onClick={() => { setCliente(""); setContato(""); setEmail(""); setDesconto(0); setObs(""); setLicencasCustom([]); setQtd({ computador: 0, servidor: 0, backupLocalEst: 0, backupLocalSrv: 0, backupNuvemEst: 0, backupNuvemSrv: 0, firewall: 0, cftv: 0, pabx: 0, tecnicoHora: 0, deslocamentoKm: 0, deslocamentoVisitas: 1 }); }}>
            ↺ Limpar Gerador
          </button>
        </div>
      </div>
    </div>
  );
};
