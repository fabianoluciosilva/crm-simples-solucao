"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const PRECOS_BASE = {
  computador: 65, servidor: 300, backupLocalEst: 15, backupLocalSrv: 60,
  backupNuvemEst: 25, backupNuvemSrv: 90, firewall: 350, cftv: 25,
  pabx: 250, tecnicoHora: 120, deslocamento: 1.5,
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const CalculadoraSSTI = () => {
  const [cliente, setCliente] = useState("");
  const [contato, setContato] = useState("");
  const [email, setEmail] = useState(""); // Novo campo
  const [precos, setPrecos] = useState<Record<string, number>>({ ...PRECOS_BASE });
  const [qtd, setQtd] = useState<any>({
    computador: 0, servidor: 0, backupLocalEst: 0, backupLocalSrv: 0, backupNuvemEst: 0,
    backupNuvemSrv: 0, firewall: 0, cftv: 0, pabx: 0, tecnicoHora: 0,
    deslocamentoKm: 0, deslocamentoVisitas: 1,
  });
  const [licencasCustom, setLicencasCustom] = useState<any[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [obs, setObs] = useState("");

  const subtotalServicos = (qtd.computador * precos.computador) + (qtd.servidor * precos.servidor) + 
    (qtd.firewall * precos.firewall) + (qtd.pabx * precos.pabx) + 
    (qtd.deslocamentoKm * precos.deslocamento * 2 * qtd.deslocamentoVisitas) +
    licencasCustom.reduce((acc: number, lic: any) => acc + (lic.preco * lic.qtd), 0);
  
  const valorFinal = subtotalServicos * (1 - desconto / 100);

  const salvarProposta = useCallback(async () => {
    const d = new Date();
    const numeroProposta = `SSTI-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`;

    const { error } = await supabase
      .from('propostas')
      .insert([{
        numero: numeroProposta,
        cliente: cliente || "Empresa Não Identificada",
        contato: contato || "Cliente",
        email: email, // Salvando o e-mail no banco
        valor: valorFinal,
        status: 'aberta',
        origem: 'calculadora',
        dados: { qtd, precos, desconto, obs, licencasCustom }
      }]);

    if (error) alert("Erro ao salvar: " + error.message);
    else alert("Proposta " + numeroProposta + " salva com sucesso!");
  }, [cliente, contato, email, valorFinal, qtd, precos, desconto, obs, licencasCustom]);

  return (
    <div className="p-8 max-w-4xl mx-auto bg-[#080f1e] text-white rounded-xl border border-white/10">
      <h2 className="text-2xl font-bold mb-6">Gerador de Propostas Commercial</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <input placeholder="Empresa" className="bg-white/5 p-3 rounded border border-white/10" value={cliente} onChange={e => setCliente(e.target.value)} />
        <input placeholder="Contato" className="bg-white/5 p-3 rounded border border-white/10" value={contato} onChange={e => setContato(e.target.value)} />
        <input placeholder="E-mail do Cliente" className="bg-white/5 p-3 rounded border border-white/10" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      
      {/* Resumo Simplificado para teste */}
      <div className="text-xl font-bold text-[#4A90D9] mb-4">Total Mensal: {fmt(valorFinal)}</div>
      <button onClick={salvarProposta} className="w-full bg-[#4A90D9] p-4 rounded-lg font-bold hover:bg-blue-600 transition">
        Salvar Proposta no Banco
      </button>
    </div>
  );
};
