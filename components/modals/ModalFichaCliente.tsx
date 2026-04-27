import React, { useMemo } from "react";
import { fmt } from "@/utils/crmLogic";

interface ModalFichaClienteProps {
  clienteDetalhe: any;
  setClienteDetalhe: (val: any) => void;
  isComercial: boolean;
  isAdmin: boolean;
  abrirNovaTarefa: (ref?: string, leadId?: number, propId?: number, cliId?: string) => void;
  formInteracao: any;
  setFormInteracao: (val: any) => void;
  salvarInteracao: (e: any) => void;
}

export const ModalFichaCliente = ({
  clienteDetalhe, setClienteDetalhe, isComercial, isAdmin,
  abrirNovaTarefa, formInteracao, setFormInteracao, salvarInteracao
}: ModalFichaClienteProps) => {
  if (!clienteDetalhe) return null;

  // Criamos a Timeline unindo Propostas e Interações
  const timeline = useMemo(() => {
    // AQUI ESTÁ A CORREÇÃO: Avisamos o TypeScript que é um array do tipo "any"
    const eventos: any[] = [];
    
    // Adiciona Propostas à Timeline
    clienteDetalhe.propostas?.forEach((p: any) => {
      eventos.push({
        data: new Date(p.created_at),
        titulo: `Proposta: ${p.numero || 'S/N'}`,
        desc: `Valor: ${fmt(p.valor || 0)} - Status: ${p.status}`,
        tipo: 'proposta',
        icon: '📄'
      });
    });

    // Adiciona Notas/Interações à Timeline
    clienteDetalhe.interacoes?.forEach((i: any) => {
      eventos.push({
        data: new Date(i.created_at),
        titulo: i.tipo,
        desc: i.descricao,
        tipo: 'nota',
        icon: '💬'
      });
    });

    // Ordena da mais recente para a mais antiga
    return eventos.sort((a, b) => b.data.getTime() - a.data.getTime());
  }, [clienteDetalhe]);

  return (
    <div className="modal-overlay" onClick={() => setClienteDetalhe(null)}>
      <div className="modal-content" style={{ maxWidth: "800px", width: "95%" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 24, color: "var(--text-primary)" }}>{clienteDetalhe.nome}</h2>
            <p style={{ color: "var(--text-secondary)" }}>{clienteDetalhe.email} | {clienteDetalhe.telefone}</p>
          </div>
          <button className="btn-action" onClick={() => setClienteDetalhe(null)}>X</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 30 }}>
          
          {/* Lado Esquerdo: Nova Interação */}
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 15, color: "var(--text-primary)" }}>Nova Interação</h3>
            <form onSubmit={salvarInteracao}>
              <select 
                value={formInteracao.tipo} 
                onChange={e => setFormInteracao({...formInteracao, tipo: e.target.value})}
                style={{ width: "100%", padding: 10, marginBottom: 10, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-light)", color: "var(--text-primary)", borderRadius: 8 }}
              >
                <option value="Nota">📝 Nota Interna</option>
                <option value="Reunião">🤝 Reunião</option>
                <option value="Chamada">📞 Chamada Telefônica</option>
                <option value="WhatsApp">💬 Mensagem WhatsApp</option>
              </select>
              <textarea 
                placeholder="O que aconteceu nesta interação?"
                value={formInteracao.descricao}
                onChange={e => setFormInteracao({...formInteracao, descricao: e.target.value})}
                style={{ width: "100%", height: 100, padding: 10, marginBottom: 10, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-light)", color: "var(--text-primary)", borderRadius: 8 }}
                required
              />
              <button type="submit" className="btn-action" style={{ width: "100%", background: "#4A90D9", color: "white", border: "none", padding: 12 }}>Salvar Histórico</button>
            </form>
            
            <button 
              className="btn-action" 
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => abrirNovaTarefa(clienteDetalhe.nome, undefined, undefined, clienteDetalhe.id)}
            >
              📅 Agendar Próxima Ação
            </button>
          </div>

          {/* Lado Direito: Timeline Visual */}
          <div style={{ maxHeight: "400px", overflowY: "auto", paddingRight: 10 }}>
            <h3 style={{ fontSize: 16, marginBottom: 15, color: "var(--text-primary)" }}>Linha do Tempo</h3>
            <div style={{ position: "relative", borderLeft: "2px solid var(--border-light)", marginLeft: 10, paddingLeft: 20 }}>
              {timeline.length === 0 && <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Nenhum histórico registrado.</p>}
              
              {timeline.map((item, idx) => (
                <div key={idx} style={{ marginBottom: 20, position: "relative" }}>
                  <div style={{ position: "absolute", left: "-31px", top: 0, background: "#0f172a", padding: "2px", borderRadius: "50%" }}>
                    {item.icon}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {item.data.toLocaleString('pt-BR')}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{item.titulo}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};