import React from "react";
import { BadgeStatus } from "@/components/BadgeStatus";
import { fmt } from "@/utils/crmLogic";

interface PropostasViewProps {
  vistaPropostas: "kanban" | "tabela";
  propostasAbertas: any[];
  propostasEnviadas: any[];
  propostasFechadas: any[];
  propostasPerdidas: any[];
  pFiltradas: any[];
  tarefaArrastando: number | null;
  handleDragStart: (e: any, prop: any) => void;
  handleDragEnd: () => void;
  handleDragOver: (e: any) => void;
  handleDropStatus: (e: any, status: string) => void;
  diasSemInteracao: (prop: any) => number;
  abrirModalEnvio: (prop: any, tipo: 'Email' | 'WhatsApp') => void;
  abrirNotasDaProposta: (prop: any) => void;
  setModalEditarValor: (val: any) => void;
  isAdmin: boolean;
  excluirProposta: (id: number, nome: string) => void;
  visualizarProposta: (prop: any) => void;
  enviando: number | null;
  alterarStatusParaGanho: (prop: any) => void;
  abrirModalPerda: (prop: any) => void;
  reabrirProposta: (id: number) => void;
}

export const PropostasView = ({
  vistaPropostas, propostasAbertas, propostasEnviadas, propostasFechadas, propostasPerdidas, pFiltradas,
  tarefaArrastando, handleDragStart, handleDragEnd, handleDragOver, handleDropStatus,
  diasSemInteracao, abrirModalEnvio, abrirNotasDaProposta, setModalEditarValor,
  isAdmin, excluirProposta, visualizarProposta, enviando, alterarStatusParaGanho, abrirModalPerda, reabrirProposta
}: PropostasViewProps) => {
  
  const LIMIAR_FRIO = 5; // Começa a avisar
  const LIMIAR_CRITICO = 7; // Começa a pulsar em vermelho

  return (
    <>
      {/* Estilos específicos para animação de urgência */}
      <style>{`
        @keyframes pulse-border {
          0% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.4); border-color: #f87171; }
          70% { box-shadow: 0 0 0 10px rgba(248, 113, 113, 0); border-color: #f87171; }
          100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0); border-color: var(--border-light); }
        }
        .esfriando-critico {
          animation: pulse-border 2s infinite;
          border: 2px solid #f87171 !important;
          background: rgba(248, 113, 113, 0.05) !important;
        }
      `}</style>

      {vistaPropostas === 'kanban' && (
        <div className="kanban-board">
          {[
            { status: 'aberta', label: 'Novas', cor: 'var(--text-secondary)', propostas: propostasAbertas },
            { status: 'negociacao', label: 'Em Negociação', cor: '#4A90D9', propostas: propostasEnviadas },
            { status: 'fechada', label: '🎉 Ganhou', cor: '#22c55e', propostas: propostasFechadas },
            { status: 'perdida', label: '❌ Perdeu', cor: '#f87171', propostas: propostasPerdidas },
          ].map(col => (
            <div key={col.status} className="kanban-col" onDragOver={handleDragOver} onDrop={e => handleDropStatus(e, col.status)}>
              <div className="kanban-header" style={{ color: col.cor }}>
                <span>{col.label}</span>
                <span style={{ background: `${col.cor}22`, color: col.cor, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{col.propostas.length}</span>
              </div>
              <div className="kanban-body">
                {col.propostas.map(p => {
                  const diasFrio = diasSemInteracao(p);
                  const isCritico = diasFrio >= LIMIAR_CRITICO && col.status !== 'fechada' && col.status !== 'perdida';
                  
                  return (
                    <div 
                      key={p.id} 
                      className={`kanban-card ${tarefaArrastando === p.id ? 'dragging' : ''} ${isCritico ? 'esfriando-critico' : ''}`} 
                      style={{ borderLeft: col.status !== 'aberta' && !isCritico ? `3px solid ${col.cor}` : undefined, opacity: col.status === 'perdida' ? 0.7 : 1 }} 
                      draggable={true} 
                      onDragStart={e => handleDragStart(e, p)} 
                      onDragEnd={handleDragEnd}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</div>
                        {diasFrio >= LIMIAR_FRIO && col.status !== 'fechada' && col.status !== 'perdida' && (
                          <span style={{ fontSize: 10, background: isCritico ? "#f87171" : "#f59e0b", color: "#fff", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>
                            {isCritico ? '🚨 CRÍTICO' : `❄️ ${diasFrio}d`}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14, marginBottom: 2 }}>{p.cliente}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>{p.contato}</div>
                      <div style={{ fontWeight: 800, color: "#4A90D9", marginBottom: 12, fontSize: 16 }}>{fmt(p.valor)}</div>
                      
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0 }} onClick={() => abrirModalEnvio(p, 'WhatsApp')}>💬 Wpp</button>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0 }} onClick={() => abrirModalEnvio(p, 'Email')}>📧 E-mail</button>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, background: "rgba(74,144,217,0.08)", color: "#4A90D9", margin: 0 }} onClick={() => abrirNotasDaProposta(p)}>📝 Notas</button>
                      </div>
                      
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0 }} onClick={() => setModalEditarValor({ativo: true, prop: p, novoValor: p.valor.toString()})}>💰 Valor</button>
                        {isAdmin && <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0, color: "#f87171" }} onClick={() => excluirProposta(p.id, p.cliente)}>🗑️</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {vistaPropostas === 'tabela' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Status</th><th style={{ textAlign: "right" }}>Ações</th></tr>
            </thead>
            <tbody>
              {pFiltradas.map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                  <td><strong>{p.cliente}</strong></td>
                  <td>{fmt(p.valor)}</td>
                  <td><BadgeStatus status={p.status || 'aberta'} /></td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn-action" onClick={() => abrirNotasDaProposta(p)}>📝</button>
                    <button className="btn-action" onClick={() => visualizarProposta(p)}>PDF</button>
                    {p.status !== 'fechada' && <button className="btn-action" style={{ color: "#22c55e" }} onClick={() => alterarStatusParaGanho(p)}>✓</button>}
                    {p.status !== 'perdida' && <button className="btn-action" style={{ color: "#f87171" }} onClick={() => abrirModalPerda(p)}>✗</button>}
                    {(p.status === 'fechada' || p.status === 'perdida') && (
                      <button className="btn-action" style={{ color: "#f59e0b" }} onClick={() => reabrirProposta(p.id)}>↩️</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};