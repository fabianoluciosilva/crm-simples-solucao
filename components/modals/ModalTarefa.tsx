import React from "react";

interface ModalTarefaProps {
  isOpen: boolean;
  onClose: () => void;
  formTarefa: any;
  setFormTarefa: (val: any) => void;
  salvarTarefa: (e: React.FormEvent) => Promise<void>;
}

export const ModalTarefa = ({ isOpen, onClose, formTarefa, setFormTarefa, salvarTarefa }: ModalTarefaProps) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>{formTarefa.id ? "✏️ Editar Tarefa" : "➕ Nova Tarefa"}</h2>
        <form onSubmit={salvarTarefa} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Título da Tarefa</label>
            <input required className="input-modal" value={formTarefa.titulo || ''} onChange={e => setFormTarefa({ ...formTarefa, titulo: e.target.value })} placeholder="Ex: Ligar para cliente..." />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Descrição</label>
            <textarea className="input-modal" rows={3} value={formTarefa.descricao || ''} onChange={e => setFormTarefa({ ...formTarefa, descricao: e.target.value })} placeholder="Detalhes da tarefa..." />
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Data de Vencimento</label>
              <input required type="datetime-local" className="input-modal" value={formTarefa.data_vencimento || ''} onChange={e => setFormTarefa({ ...formTarefa, data_vencimento: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Prioridade</label>
              <select className="input-modal" value={formTarefa.prioridade || 'Normal'} onChange={e => setFormTarefa({ ...formTarefa, prioridade: e.target.value })}>
                <option value="Baixa">Baixa</option>
                <option value="Normal">Normal</option>
                <option value="Alta">Alta ⚠️</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Status</label>
              <select className="input-modal" value={formTarefa.status || 'Pendente'} onChange={e => setFormTarefa({ ...formTarefa, status: e.target.value })}>
                <option value="Pendente">Pendente</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Referência (Cliente/Empresa)</label>
              <input className="input-modal" value={formTarefa.nome_referencia || ''} onChange={e => setFormTarefa({ ...formTarefa, nome_referencia: e.target.value })} placeholder="Ex: Cartola Filmes..." />
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button type="button" onClick={onClose} className="btn-action" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn-action" style={{ flex: 1, background: "#4A90D9", color: "#fff", borderColor: "#4A90D9" }}>Gravar Tarefa</button>
          </div>
        </form>
      </div>
    </div>
  );
};
