import React from "react";

interface ModalContratoProps {
  isOpen: boolean;
  onClose: () => void;
  formContrato: any;
  setFormContrato: (val: any) => void;
  salvarContrato: (e: React.FormEvent) => Promise<void>;
}

export const ModalContrato = ({ isOpen, onClose, formContrato, setFormContrato, salvarContrato }: ModalContratoProps) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>{formContrato.id ? "📄 Editar Contrato" : "➕ Novo Contrato"}</h2>
        <form onSubmit={salvarContrato} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Nome do Cliente</label>
            <input required className="input-modal" value={formContrato.cliente_nome || ''} onChange={e => setFormContrato({ ...formContrato, cliente_nome: e.target.value })} placeholder="Empresa..." />
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Valor Mensal (MRR)</label>
              <input required type="number" step="0.01" className="input-modal" value={formContrato.valor_mensal || ''} onChange={e => setFormContrato({ ...formContrato, valor_mensal: parseFloat(e.target.value) })} placeholder="Ex: 1500.00" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Data de Início</label>
              <input required type="date" className="input-modal" value={formContrato.data_inicio || ''} onChange={e => setFormContrato({ ...formContrato, data_inicio: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Serviços Inclusos</label>
            <textarea className="input-modal" rows={2} value={formContrato.servicos_inclusos || ''} onChange={e => setFormContrato({ ...formContrato, servicos_inclusos: e.target.value })} placeholder="Descrição dos serviços..." />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Status do Contrato</label>
            <select className="input-modal" value={formContrato.status || 'Ativo'} onChange={e => setFormContrato({ ...formContrato, status: e.target.value })}>
              <option value="Ativo">Ativo</option>
              <option value="Pendente">Pendente</option>
              <option value="Cancelado">Cancelado (Churn)</option>
            </select>
          </div>
          {formContrato.status === 'Cancelado' && (
            <div>
              <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Motivo do Cancelamento</label>
              <input required className="input-modal" value={formContrato.motivo_cancelamento || ''} onChange={e => setFormContrato({ ...formContrato, motivo_cancelamento: e.target.value })} placeholder="Por que cancelou?..." />
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button type="button" onClick={onClose} className="btn-action" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn-action" style={{ flex: 1, background: "#4A90D9", color: "#fff", borderColor: "#4A90D9" }}>Gravar Contrato</button>
          </div>
        </form>
      </div>
    </div>
  );
};
