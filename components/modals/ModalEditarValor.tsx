import React from "react";

interface ModalEditarValorProps {
  isOpen: boolean;
  onClose: () => void;
  modalEditarValor: any;
  setModalEditarValor: (val: any) => void;
  salvarNovoValorProposta: (e: React.FormEvent) => Promise<void>;
}

export const ModalEditarValor = ({ isOpen, onClose, modalEditarValor, setModalEditarValor, salvarNovoValorProposta }: ModalEditarValorProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>💰 Alterar Valor da Negociação</h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
          Cliente: <strong>{modalEditarValor.prop?.cliente}</strong>
        </p>
        <form onSubmit={salvarNovoValorProposta} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
              Novo Valor (R$)
            </label>
            <input required type="number" step="0.01" className="input-modal" value={modalEditarValor.novoValor} onChange={e => setModalEditarValor({ ...modalEditarValor, novoValor: e.target.value })} placeholder="Ex: 1500.50" />
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn-action" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn-action" style={{ flex: 1, background: "#22c55e", color: "#fff", borderColor: "#22c55e" }}>Salvar Valor</button>
          </div>
        </form>
      </div>
    </div>
  );
};
