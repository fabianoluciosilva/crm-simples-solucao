"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Utilizando a senha que você já configurou
const SENHA_ADMIN = "Simples@923"; 

export default function AdminPage() {
  const [aba, setAba] = useState<"propostas" | "leads">("propostas");
  const [autenticado, setAutenticado] = useState(false);
  const [inputSenha, setInputSenha] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [propostas, setPropostas] = useState<any[]>([]);

  // Carregar dados conforme a aba ativa
  useEffect(() => {
    if (autenticado) {
      if (aba === "leads") carregarLeads();
      else carregarPropostas();
    }
  }, [aba, autenticado]);

  async function carregarLeads() {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (data) setLeads(data);
  }

  async function carregarPropostas() {
    const { data } = await supabase.from("propostas").select("*").order("created_at", { ascending: false });
    if (data) setPropostas(data);
  }

  const enviarWppLead = (lead: any) => {
    const msg = `Olá ${lead.nome}, tudo bem? Vi que você se interessou pela nossa solução de ${lead.produto} na modalidade ${lead.plano} pelo nosso site. Gostaria de entender melhor a sua necessidade.`;
    window.open(`https://wa.me/${lead.telefone?.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (!autenticado) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080f1e]">
        <input 
          type="password" 
          placeholder="Senha Admin" 
          className="p-3 rounded bg-white/10 text-white"
          onKeyDown={(e) => e.key === "Enter" && (inputSenha === SENHA_ADMIN ? setAutenticado(true) : alert("Erro"))}
          onChange={(e) => setInputSenha(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080f1e] text-white p-8">
      <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
        <button onClick={() => setAba("propostas")} className={`px-4 py-2 ${aba === "propostas" ? "text-[#4A90D9] border-b-2 border-[#4A90D9]" : "text-gray-400"}`}>Propostas</button>
        <button onClick={() => setAba("leads")} className={`px-4 py-2 ${aba === "leads" ? "text-[#4A90D9] border-b-2 border-[#4A90D9]" : "text-gray-gray-400"}`}>Leads do Site</button>
      </div>

      {aba === "leads" ? (
        <div className="grid gap-4">
          {leads.map(lead => (
            <div key={lead.id} className="p-4 bg-white/5 border border-white/10 rounded-lg flex justify-between items-center">
              <div>
                <h3 className="font-bold">{lead.empresa} - {lead.nome}</h3>
                <p className="text-sm text-gray-400">{lead.produto} ({lead.plano}) | {lead.telefone}</p>
              </div>
              <button onClick={() => enviarWppLead(lead)} className="bg-green-600 px-4 py-2 rounded text-sm">WhatsApp</button>
            </div>
          ))}
        </div>
      ) : (
        /* Renderize aqui a tabela de propostas que você já tinha no arquivo original */
        <div>Listagem de Propostas (Seu código original aqui)</div>
      )}
    </div>
  );
}
