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
  const LIMIAR_ESFRIANDO = 5;

  return (
    <>
      {vistaPropostas === 'kanban' && (
        <div className="kanban-board">
          {[
            { status: 'aberta', label: 'Novas', cor: 'var(--text-secondary)', propostas: propostasAbertas },
            { status: 'negociacao', label: 'Em Negociação', cor: '#4A90D9', propostas: propostasEnviadas },
            { status: 'fechada', label: '🎉 Ganhou', cor: '#22c55e', propostas: propostasFechadas },
            { status: 'perdida', label: '❌ Perdeu', cor: '#f87171', propostas: propostasPerdidas },
          ].map(col => (
            <div key={col.status} className="kanban-col" style={{ borderColor: col.status !== 'aberta' ? `${col.cor}33` : undefined }} onDragOver={handleDragOver} onDrop={e => handleDropStatus(e, col.status)} onDragEnter={e => e.currentTarget.classList.add('drag-over')} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.classList.remove('drag-over'); }}>
              <div className="kanban-header" style={{ color: col.cor }}>
                <span>{col.label}</span>
                <span style={{ background: `${col.cor}22`, color: col.cor, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{col.propostas.length}</span>
              </div>
              <div className="kanban-body">
                {col.propostas.map(p => {
                  const diasFrio = diasSemInteracao(p);
                  const esfriando = diasFrio >= LIMIAR_ESFRIANDO;
                  return (
                    <div key={p.id} className={`kanban-card ${tarefaArrastando === p.id ? 'dragging' : ''}`} style={{ borderLeft: col.status !== 'aberta' ? `3px solid ${col.cor}` : undefined, opacity: col.status === 'perdida' ? 0.7 : 1 }} draggable={true} onDragStart={e => handleDragStart(e, p)} onDragEnd={handleDragEnd}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{new Date(p.created_at).toLocaleDateString('pt-BR')} · {p.filial || 'Matriz'}</div>
                        {esfriando && col.status !== 'fechada' && col.status !== 'perdida' && (
                          <span title={`${diasFrio} dias sem interação`} style={{ fontSize: 10, background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "1px 6px", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap" }}>❄️ {diasFrio}d frio</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14, marginBottom: 2 }}>{p.cliente}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{p.contato}</div>
                      {p.origem && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 6 }}>🎯 {p.origem}</div>}
                      <div style={{ fontWeight: 800, color: "#4A90D9", marginBottom: 10, fontSize: 16 }}>{fmt(p.valor)}</div>
                      {p.motivo_perda && <div style={{ fontSize: 11, color: "#f87171", marginBottom: 8, padding: "4px 8px", background: "rgba(248,113,113,0.08)", borderRadius: 6 }}>{p.motivo_perda}</div>}
                      
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0 }} onClick={() => abrirModalEnvio(p, 'WhatsApp')}>💬 Wpp</button>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0 }} onClick={() => abrirModalEnvio(p, 'Email')}>📧 E-mail</button>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, background: "rgba(74,144,217,0.08)", color: "#4A90D9", borderColor: "rgba(74,144,217,0.3)", margin: 0 }} onClick={() => abrirNotasDaProposta(p)}>📝 Notas</button>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
                        <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0, background: "rgba(34,197,94,0.08)", color: "#22c55e", borderColor: "rgba(34,197,94,0.3)" }} onClick={() => setModalEditarValor({ativo: true, prop: p, novoValor: p.valor.toString()})}>💰 Alterar Valor</button>
                        {isAdmin && <button className="btn-action" style={{ flex: 1, padding: "5px 4px", fontSize: 11, margin: 0, background: "rgba(248,113,113,0.08)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }} onClick={() => excluirProposta(p.id, p.cliente)}>🗑️ Excluir</button>}
                      </div>
                    </div>
                  );
                })}
                {col.propostas.length === 0 && <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: 12, padding: 20 }}>Arraste propostas aqui</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {vistaPropostas === 'tabela' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Data</th><th>Cliente / Contato</th><th>Filial</th><th>Valor</th><th>Origem</th><th>Status</th><th style={{ textAlign: "right" }}>Ações</th></tr>
            </thead>
            <tbody>
              {pFiltradas.map(p => (
                <tr key={p.id} style={{ opacity: p.status === 'perdida' ? 0.6 : 1 }}>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                  <td><strong>{p.cliente}</strong><br /><small style={{ color: "var(--text-secondary)" }}>{p.contato}</small></td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.filial || 'Matriz'}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(p.valor)}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.origem || '—'}</td>
                  <td title={p.motivo_perda ? `Motivo: ${p.motivo_perda}` : ""}>
                    <BadgeStatus status={p.status || 'aberta'} />
                    {p.motivo_perda && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3 }}>{p.motivo_perda}</div>}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn-action" onClick={() => abrirNotasDaProposta(p)}>📝</button>
                    <button className="btn-action" onClick={() => visualizarProposta(p)}>PDF</button>
                    <button className="btn-action" onClick={() => abrirModalEnvio(p, 'WhatsApp')}>💬</button>
                    <button className="btn-action" disabled={enviando === p.id} onClick={() => abrirModalEnvio(p, 'Email')}>{enviando === p.id ? '...' : '📧'}</button>
                    {p.status !== 'fechada' && <button className="btn-action" style={{ color: "#22c55e", borderColor: "#22c55e" }} onClick={() => alterarStatusParaGanho(p)}>✓</button>}
                    {p.status !== 'perdida' && <button className="btn-action" style={{ color: "#f87171" }} onClick={() => abrirModalPerda(p)}>✗</button>}
                    {(p.status === 'fechada' || p.status === 'perdida') && (
                      <button className="btn-action" style={{ color: "#f59e0b", borderColor: "#f59e0b" }} onClick={() => reabrirProposta(p.id)}>↩️</button>
                    )}
                    {isAdmin && <button className="btn-action" style={{ color: "#f87171" }} onClick={() => excluirProposta(p.id, p.cliente)}>🗑️</button>}
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
