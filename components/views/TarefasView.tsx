import React from "react";
import { BadgeStatus } from "@/components/BadgeStatus";
import { calcDiasAtraso } from "@/utils/crmLogic";

interface TarefasViewProps {
  abrirNovaTarefa: () => void;
  filtroStatusTarefa: string;
  setFiltroStatusTarefa: (val: any) => void;
  tarefasComAtraso: any[];
  tarefasFiltradas: any[];
  alterarStatusTarefaRapido: (id: number, status: string) => void;
  editarTarefa: (t: any) => void;
  isAdmin: boolean;
  excluirTarefa: (id: number) => void;
}

export const TarefasView = ({
  abrirNovaTarefa, filtroStatusTarefa, setFiltroStatusTarefa, tarefasComAtraso,
  tarefasFiltradas, alterarStatusTarefaRapido, editarTarefa, isAdmin, excluirTarefa
}: TarefasViewProps) => {
  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={abrirNovaTarefa} className="btn-action" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "9px 18px", fontSize: 13, margin: 0 }}>+ Nova Tarefa</button>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
          {(["Todos", "Pendente", "Em Andamento", "Concluído", "Atrasado"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFiltroStatusTarefa(s)}
              className="btn-action"
              style={{
                background: filtroStatusTarefa === s ? 'rgba(74,144,217,0.2)' : 'transparent',
                color: filtroStatusTarefa === s ? '#4A90D9' : 'var(--text-secondary)',
                borderColor: filtroStatusTarefa === s ? '#4A90D9' : 'var(--border-light)',
                fontSize: 12, margin: 0
              }}
            >
              {s === 'Atrasado' ? '⚠️ ' : ''}{s}
              {s === 'Atrasado' && tarefasComAtraso.filter(t => t.status === 'Atrasado').length > 0 && (
                <span className="notificacao-badge" style={{ marginLeft: 4 }}>{tarefasComAtraso.filter(t => t.status === 'Atrasado').length}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead><tr><th>Prazo</th><th>Tarefa</th><th>Cliente</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>
            {tarefasFiltradas.map(t => {
              const diasAtraso = t.status !== 'Concluído' ? calcDiasAtraso(t.data_vencimento) : 0;
              return (
                <tr key={t.id} style={{ opacity: t.status === 'Concluído' ? 0.5 : 1 }}
                  className={t.prioridade === 'Alta' ? 'prioridade-alta' : t.prioridade === 'Baixa' ? 'prioridade-baixa' : ''}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 13 }}>{new Date(t.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                    {diasAtraso > 0 && t.status !== 'Concluído' && (
                      <div style={{ fontSize: 10, color: "#f87171", fontWeight: 700 }}>⚠️ {diasAtraso}d atrasado</div>
                    )}
                  </td>
                  <td>
                    <strong style={{ fontSize: 14 }}>{t.titulo}</strong>
                    {t.descricao && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{t.descricao.substring(0, 60)}{t.descricao.length > 60 ? '...' : ''}</div>}
                  </td>
                  <td style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{t.nome_referencia || '—'}</td>
                  <td><BadgeStatus status={t.status} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {t.status !== 'Concluído' && (
                      <button className="btn-action" style={{ color: "#22c55e", borderColor: "#22c55e" }} onClick={() => alterarStatusTarefaRapido(t.id, 'Concluído')}>✓</button>
                    )}
                    {t.status !== 'Em Andamento' && t.status !== 'Concluído' && (
                      <button className="btn-action" style={{ color: "#4A90D9" }} onClick={() => alterarStatusTarefaRapido(t.id, 'Em Andamento')}>▶</button>
                    )}
                    <button className="btn-action" onClick={() => editarTarefa(t)}>Editar</button>
                    {isAdmin && <button className="btn-action" style={{ color: "#f87171", margin: 0 }} onClick={() => excluirTarefa(t.id)}>🗑️</button>}
                  </td>
                </tr>
              );
            })}
            {tarefasFiltradas.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>Nenhuma tarefa para o filtro selecionado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};
