import React from "react";

interface ModalClienteFormProps {
  isOpen: boolean;
  onClose: () => void;
  formCliente: any;
  setFormCliente: (val: any) => void;
  salvarClienteBase: (e: React.FormEvent) => Promise<void>;
  isAdmin: boolean;
}

export const ModalClienteForm = ({ 
  isOpen, 
  onClose, 
  formCliente, 
  setFormCliente, 
  salvarClienteBase, 
  isAdmin 
}: ModalClienteFormProps) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>{formCliente.id ? "✏️ Editar Registo" : "➕ Novo Registo"}</h2>
        <form onSubmit={salvarClienteBase} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <input 
              className="input-modal" 
              style={{ flex: 1, marginBottom: 0 }} 
              value={formCliente.codigo || ''} 
              onChange={e => setFormCliente({ ...formCliente, codigo: e.target.value })} 
              placeholder="Código (Opcional)..." 
            />
            <select 
              className="input-modal" 
              style={{ flex: 1, marginBottom: 0 }} 
              value={formCliente.tipo || 'Cliente'} 
              onChange={e => setFormCliente({ ...formCliente, tipo: e.target.value })}
            >
              <option value="Cliente">Cliente</option>
              <option value="Lead">Lead</option>
              <option value="Parceiro">Parceiro</option>
            </select>
          </div>
          <input 
            required 
            className="input-modal" 
            style={{ marginBottom: 0 }} 
            value={formCliente.nome || ''} 
            onChange={e => setFormCliente({ ...formCliente, nome: e.target.value })} 
            placeholder="Nome da Empresa *" 
          />
          <input 
            className="input-modal" 
            style={{ marginBottom: 0 }} 
            value={formCliente.email || ''} 
            onChange={e => setFormCliente({ ...formCliente, email: e.target.value })} 
            placeholder="E-mail principal..." 
            type="email" 
          />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input 
              className="input-modal" 
              style={{ flex: "1 1 120px", marginBottom: 0 }} 
              value={formCliente.telefone || ''} 
              onChange={e => setFormCliente({ ...formCliente, telefone: e.target.value })} 
              placeholder="Telefone Fixo..." 
            />
            <input 
              className="input-modal" 
              style={{ flex: "1 1 120px", marginBottom: 0 }} 
              value={formCliente.whatsapp || ''} 
              onChange={e => setFormCliente({ ...formCliente, whatsapp: e.target.value })} 
              placeholder="WhatsApp (com DDD)..." 
            />
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input 
              className="input-modal" 
              style={{ flex: "1 1 120px", marginBottom: 0 }} 
              value={formCliente.documento || ''} 
              onChange={e => setFormCliente({ ...formCliente, documento: e.target.value })} 
              placeholder="CNPJ / CPF..." 
            />
            {isAdmin && (
              <input 
                className="input-modal" 
                style={{ flex: "1 1 120px", marginBottom: 0 }} 
                value={formCliente.filial || ''} 
                onChange={e => setFormCliente({ ...formCliente, filial: e.target.value })} 
                placeholder="Filial (Ex: Matriz)..." 
              />
            )}
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button type="button" onClick={onClose} className="btn-action" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn-action" style={{ flex: 1, background: "#4A90D9", color: "#fff", borderColor: "#4A90D9" }}>
              Gravar Registo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
