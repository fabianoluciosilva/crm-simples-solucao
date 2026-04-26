import React from "react";
import { BadgeStatus } from "@/components/BadgeStatus";
import { fmt } from "@/utils/crmLogic";

interface ContratosViewProps {
  abrirNovoContrato: () => void;
  mrrAtivo: number;
  contratos: any[];
  editarContrato: (c: any) => void;
}

export const ContratosView = ({ abrirNovoContrato, mrrAtivo, contratos, editarContrato }: ContratosViewProps) => {
  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={abrirNovoContrato} className="btn-action" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "9px 18px", fontSize: 13, margin: 0 }}>+ Novo Contrato</button>
        <div style={{ flex: 1 }} />
        <div className="metric-card" style={{ padding: "10px 20px", marginBottom: 0, display: "flex", gap: 20, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>MRR Total:</span>
          <span style={{ fontWeight: 800, color: "#22c55e", fontSize: 16 }}>{fmt(mrrAtivo)}</span>
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead><tr><th>Início</th><th>Cliente</th><th>Valor MRR</th><th>Serviços</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {contratos.map(c => (
              <tr key={c.id} style={{ opacity: c.status === 'Cancelado' ? 0.5 : 1 }}>
                <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{new Date(c.data_inicio).toLocaleDateString('pt-BR')}</td>
                <td><strong>{c.cliente_nome}</strong></td>
                <td style={{ fontWeight: 700, color: "#22c55e", whiteSpace: "nowrap" }}>{fmt(c.valor_mensal)}</td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 200 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.servicos_inclusos || '—'}</div></td>
                <td><BadgeStatus status={c.status} /></td>
                <td style={{ whiteSpace: "nowrap" }}><button className="btn-action" style={{ margin: 0 }} onClick={() => editarContrato(c)}>Gerir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
