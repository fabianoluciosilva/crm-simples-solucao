"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Senha de acesso ao painel
const SENHA_ADMIN = "Simples@923";

export default function AdminPage() {
  const [aba, setAba] = useState<"propostas" | "leads">("propostas");
  const [autenticado, setAutenticado] = useState(false);
  const [inputSenha, setInputSenha] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [enviando, setEnviando] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Carregar dados automaticamente quando autenticar ou trocar de aba
  useEffect(() => {
    if (autenticado) {
      if (aba === "leads") carregarLeads();
      else carregarPropostas();
    }
  }, [aba, autenticado]);

  async function carregarLeads() {
    setCarregando(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) console.error("Erro leads:", error);
    if (data) setLeads(data);
    setCarregando(false);
  }

  async function carregarPropostas() {
    setCarregando(true);
    const { data, error } = await supabase
      .from("propostas")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) console.error("Erro propostas:", error);
    if (data) setPropostas(data);
    setCarregando(false);
  }

  const enviarEmail = async (prop: any) => {
    if (!prop.email) return alert("Esta proposta não possui e-mail cadastrado.");
    
    const confirmar = confirm(`Enviar proposta para ${prop.email}?`);
    if (!confirmar) return;

    setEnviando(prop.id);

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: prop.email,
          subject: `Proposta Comercial SSTI - ${prop.cliente}`,
          html: `
            <div style="font-family: sans-serif; line-height: 1.6;">
              <h2>Olá, ${prop.contato}!</h2>
              <p>Segue a proposta comercial da <strong>Simples Solução TI</strong> referente ao suporte técnico para a <strong>${prop.cliente}</strong>.</p>
              <p>Valor total da proposta: <strong>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prop.valor)}</strong></p>
              <p>Ficamos à disposição para dúvidas.</p>
              <br/>
              <p>Atenciosamente,<br/><strong>Equipe Simples Solução TI</strong></p>
            </div>
          `,
          fileName: `Proposta_${prop.numero}.pdf`
        }),
      });

      if (response.ok) {
        alert("E-mail enviado com sucesso!");
        await supabase.from('propostas').update({ status_envio: 'enviado' }).eq('id', prop.id);
        carregarPropostas();
      } else {
        alert("Erro ao enviar e-mail. Verifique os logs da Vercel.");
      }
    } catch (err) {
      alert("Erro de conexão com a API de e-mail.");
    } finally {
      setEnviando(null);
    }
  };

  const enviarWpp = (prop: any) => {
    const msg = `Olá ${prop.contato}, aqui é da Simples Solução TI. Acabei de gerar a proposta ${prop.numero} para a ${prop.cliente}. Posso te enviar por aqui ou prefere por e-mail?`;
    window.open(`https://wa.me/${prop.telefone?.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (!autenticado) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080f1e]">
        <div className="bg-white/5 p-8 rounded-2xl border border-white/10 text-center shadow-2xl">
          <h2 className="text-[#4A90D9] font-bold mb-6 tracking-widest uppercase">SSTI Admin</h2>
          <input 
            type="password" 
            placeholder="Senha de Acesso" 
            className="p-3 rounded bg-white/10 text-white outline-none border border-white/20 focus:border-[#4A90D9] transition-all w-64" 
            onKeyDown={(e) => e.key === "Enter" && (inputSenha === SENHA_ADMIN ? setAutenticado(true) : alert("Senha Incorreta"))}
            onChange={(e) => setInputSenha(e.target.value)} 
          />
          <button 
            onClick={() => inputSenha === SENHA_ADMIN ? setAutenticado(true) : alert("Senha Incorreta")}
            className="block w-full mt-4 bg-[#4A90D9] py-2 rounded font-bold hover:bg-blue-600 transition-colors"
          >
            Acessar Painel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080f1e] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/10 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white">CRM Comercial</h1>
            <nav className="flex gap-8 mt-6">
              <button 
                onClick={() => setAba("propostas")} 
                className={`pb-2 font-bold uppercase text-xs tracking-widest transition ${aba === "propostas" ? "text-[#4A90D9] border-b-2 border-[#4A90D9]" : "text-gray-500 hover:text-gray-300"}`}
              >
                Propostas ({propostas.length})
              </button>
              <button 
                onClick={() => setAba("leads")} 
                className={`pb-2 font-bold uppercase text-xs tracking-widest transition ${aba === "leads" ? "text-[#4A90D9] border-b-2 border-[#4A90D9]" : "text-gray-500 hover:text-gray-300"}`}
              >
                Leads do Site ({leads.length})
              </button>
            </nav>
          </div>
          <button 
            onClick={() => window.location.href = '/preco'} 
            className="bg-[#4A90D9] px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform"
          >
            + Nova Proposta
          </button>
        </header>

        {carregando ? (
          <div className="text-center py-20 text-gray-500 animate-pulse">Carregando dados do servidor...</div>
        ) : aba === "leads" ? (
          <div className="grid gap-4">
            {leads.length === 0 && <p className="text-gray-500 italic">Nenhum lead encontrado.</p>}
            {leads.map(lead => (
              <div key={lead.id} className="p-5 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center hover:bg-white/[0.08] transition shadow-sm">
                <div>
                  <div className="text-[#4A90D9] text-[10px] font-bold uppercase tracking-tighter mb-1">{lead.produto || 'Consultoria'}</div>
                  <h3 className="text-lg font-bold">{lead.empresa}</h3>
                  <p className="text-sm text-gray-400">{lead.nome} • {lead.telefone}</p>
                </div>
                <button onClick={() => window.open(`https://wa.me/${lead.telefone?.replace(/\D/g, "")}`, "_blank")} className="bg-green-600/10 text-green-500 border border-green-600/20 px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-all">WhatsApp</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white/5 text-gray-400 text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="p-4 border-b border-white/10">Cliente / Proposta</th>
                    <th className="p-4 border-b border-white/10">Valor</th>
                    <th className="p-4 border-b border-white/10">Status</th>
                    <th className="p-4 border-b border-white/10 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {propostas.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-gray-500">Nenhuma proposta salva.</td></tr>}
                  {propostas.map(prop => (
                    <tr key={prop.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white">{prop.cliente}</div>
                        <div className="text-[10px] text-gray-500">{prop.numero} • {new Date(prop.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="p-4 font-mono text-[#4A90D9] font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prop.valor)}
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase border ${prop.status_envio === 'enviado' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                          {prop.status_envio === 'enviado' ? 'Enviado' : 'Pendente'}
                        </span>
                      </td>
                      <td className="p-4 text-right flex gap-2 justify-end">
                        <button 
                          onClick={() => enviarEmail(prop)} 
                          disabled={enviando === prop.id}
                          className="bg-white/5 hover:bg-white/20 border border-white/10 px-3 py-2 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                        >
                          {enviando === prop.id ? "..." : "E-MAIL"}
                        </button>
                        <button 
                          onClick={() => enviarWpp(prop)}
                          className="bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white border border-green-600/20 px-3 py-2 rounded-lg text-[10px] font-bold transition-all"
                        >
                          WPP
                        </button>
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
