import React from "react";
import { BadgeStatus } from "@/components/BadgeStatus";
import { fmt, calcularChurnRisk, gerarSugestaoIA } from "@/utils/crmLogic";

interface ModalFichaClienteProps {
  clienteDetalhe: any;
  setClienteDetalhe: (val: any) => void;
  isComercial: boolean;
  isAdmin: boolean;
  abrirNovaTarefa: (ref?: string, leadId?: number, propId?: number, cliId?: string) => void;
  formInteracao: any;
  setFormInteracao: (val: any) => void;
  salvarInteracao: (e: React.FormEvent) => Promise<void>;
}

export const ModalFichaCliente = ({
  clienteDetalhe,
  setClienteDetalhe,
  isComercial,
  isAdmin,
  abrirNovaTarefa,
  formInteracao,
  setFormInteracao,
  salvarInteracao
}: ModalFichaClienteProps) => {
  if (!clienteDetalhe) return null;

  return (
    <div className="modal-overlay" onClick={() => setClienteDetalhe(null)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 860, display: "flex", flexWrap: "wrap", gap: 24 }}>
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 20 }}>{clienteDetalhe.nome}</h2>
              <BadgeStatus status={clienteDetalhe.tipo} />
            </div>
            <button onClick={() => setClienteDetalhe(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 20, padding: 4 }}>✕</button>
          </div>

          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
            <span>📞 {clienteDetalhe.telefone || clienteDetalhe.contato || '—'}</span><br />
            <span>💬 {clienteDetalhe.whatsapp || '—'}</span><br />
            <span>📧 {clienteDetalhe.email || '—'}</span>
            {clienteDetalhe.documento && <><br /><span>📋 {clienteDetalhe.documento}</span></>}
            <br />
            <span style={{ color: "#f87171", fontWeight: "bold" }}>🔥 Score: {clienteDetalhe.score || 0} pts</span>
          </div>

          {(() => {
            const risk = calcularChurnRisk(clienteDetalhe);
            return (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: `${risk.cor}15`, border: `1px solid ${risk.cor}40` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{risk.emoji}</span>
                  <span style={{ fontWeight: 700, color: risk.cor, fontSize: 14 }}>
                    Risco de Churn: {risk.nivel} ({risk.score}/100)
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{risk.recomendacao}</div>
              </div>
            );
          })()}

          {(() => {
            const sugestao = gerarSugestaoIA(clienteDetalhe);
            return (
              <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, background: 'rgba(74,144,217,0.08)', border: '1px solid rgba(74,144,217,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{sugestao.emoji}</span>
                  <span style={{ fontWeight: 700, color: '#4A90D9', fontSize: 14 }}>Sugestão da IA</span>
                  <span style={{ 
                    marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 9999,
                    background: sugestao.prioridade === 'Alta' ? '#f8717122' : sugestao.prioridade === 'Média' ? '#f59e0b22' : '#22c55e22',
                    color: sugestao.prioridade === 'Alta' ? '#f87171' : sugestao.prioridade === 'Média' ? '#f59e0b' : '#22c55e',
                    fontWeight: 600
                  }}>
                    {sugestao.prioridade}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{sugestao.titulo}</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 6 }}>{sugestao.acao}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{sugestao.motivo}</div>
              </div>
            );
          })()}

          <hr style={{ margin: "12px 0", opacity: 0.1 }} />
          
          {isComercial && (
            <>
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ color: "#4A90D9", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Propostas</h4>
                {clienteDetalhe.propostas.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Nenhuma proposta</div>
                ) : (
                  clienteDetalhe.propostas.map((p: any) => (
                    <div key={p.id} style={{ fontSize: 13, padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
                      <span>{p.numero}</span>
                      <span style={{ fontWeight: 700, color: p.status === 'fechada' ? '#22c55e' : p.status === 'perdida' ? '#f87171' : 'var(--text-primary)' }}>{fmt(p.valor)}</span>
                      <BadgeStatus status={p.status || 'aberta'} />
                    </div>
                  ))
                )}
              </div>
              {isAdmin && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ color: "#4A90D9", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Contratos</h4>
                  {clienteDetalhe.contratos.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Sem contrato</div>
                  ) : (
                    clienteDetalhe.contratos.map((c: any) => (
                      <div key={c.id} style={{ fontSize: 13, padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#22c55e", fontWeight: 700 }}>{fmt(c.valor_mensal)}/mês</span>
                        <BadgeStatus status={c.status} />
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
          <div>
            <h4 style={{ color: "#4A90D9", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Tarefas Pendentes</h4>
            {clienteDetalhe.tarefas.filter((t: any) => t.status !== 'Concluído').length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Nenhuma pendência</div>
            ) : (
              clienteDetalhe.tarefas.filter((t: any) => t.status !== 'Concluído').map((t: any) => (
                <div key={t.id} style={{ fontSize: 13, padding: "4px 0" }}>
                  {t.titulo} — <span style={{ color: "var(--text-secondary)" }}>{new Date(t.data_vencimento).toLocaleDateString('pt-BR')}</span>
                </div>
              ))
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn-action" style={{ width: "100%", background: "rgba(74,144,217,0.1)", color: "#4A90D9", borderColor: "rgba(74,144,217,0.3)", padding: 10 }} 
              onClick={() => { abrirNovaTarefa(clienteDetalhe.nome, undefined, undefined, clienteDetalhe.id); setClienteDetalhe(null); }}>
              + Criar Tarefa para este Cliente
            </button>
          </div>
        </div>

        <div style={{ flex: "1 1 300px", background: "var(--bg-main)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <h4 style={{ marginBottom: 16, fontSize: 14 }}>📒 Diário de Bordo</h4>
          <div style={{ flex: 1, overflowY: "auto", marginBottom: 16, paddingRight: 8, maxHeight: 380 }}>
            {clienteDetalhe.interacoes.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", marginTop: 40 }}>Nenhuma interação registada.<br />Comece pelo formulário abaixo.</div>
            ) : (
              clienteDetalhe.interacoes.map((i: any) => (
                <div key={i.id} style={{ borderLeft: "2px solid #4A90D9", paddingLeft: 12, marginLeft: 5, marginBottom: 18, position: "relative" }}>
                  <div style={{ position: "absolute", left: -6, top: 3, width: 10, height: 10, borderRadius: 10, background: "#4A90D9" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: "bold", color: "#4A90D9", textTransform: "uppercase", letterSpacing: "0.05em" }}>{i.tipo}</span>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{new Date(i.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{i.descricao}</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, textAlign: "right" }}>— {i.usuario_email.split('@')[0]}</div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={salvarInteracao} style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border-light)", paddingTop: 14 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <select className="input-modal" style={{ width: 130, padding: 8, fontSize: 13 }} value={formInteracao.tipo} onChange={e => setFormInteracao({ ...formInteracao, tipo: e.target.value })}>
                <option value="Nota">✏️ Nota</option>
                <option value="Ligação">📞 Ligação</option>
                <option value="Reunião">🤝 Reunião</option>
                <option value="WhatsApp">💬 Wpp</option>
                <option value="E-mail">📧 E-mail</option>
                <option value="Visita">🏢 Visita</option>
              </select>
              <textarea required className="input-modal" style={{ flex: 1, padding: 8, fontSize: 13, resize: "vertical" }} rows={3} placeholder="Registe o que foi conversado..." value={formInteracao.descricao} onChange={e => setFormInteracao({ ...formInteracao, descricao: e.target.value })} />
            </div>
            <button type="submit" className="btn-action" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: 10 }}>Gravar Interação</button>
          </form>
        </div>
      </div>
    </div>
  );
};
