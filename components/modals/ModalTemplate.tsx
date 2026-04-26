import React from "react";

interface ModalTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  formTemplate: any;
  setFormTemplate: (val: any) => void;
  salvarTemplate: (e: React.FormEvent) => Promise<void>;
}

export const ModalTemplate = ({ isOpen, onClose, formTemplate, setFormTemplate, salvarTemplate }: ModalTemplateProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>{formTemplate.id ? "📝 Editar Template" : "➕ Novo Template"}</h2>
        <form onSubmit={salvarTemplate} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 2 }}>
              <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Nome do Template</label>
              <input required className="input-modal" value={formTemplate.nome || ''} onChange={e => setFormTemplate({ ...formTemplate, nome: e.target.value })} placeholder="Ex: Proposta Inicial..." />
            </div>
            <div style={{ flex: 1 }}>
              <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Canal</label>
              <select className="input-modal" value={formTemplate.tipo || 'WhatsApp'} onChange={e => setFormTemplate({ ...formTemplate, tipo: e.target.value })}>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">E-mail</option>
              </select>
            </div>
          </div>
          {formTemplate.tipo === 'Email' && (
            <div>
              <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Assunto do E-mail</label>
              <input required className="input-modal" value={formTemplate.assunto || ''} onChange={e => setFormTemplate({ ...formTemplate, assunto: e.target.value })} placeholder="Assunto (Pode usar {{nome}}, {{empresa}})..." />
            </div>
          )}
          <div>
            <label className="block mb-1 text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Mensagem</label>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>
              Variáveis disponíveis: <code style={{color: '#4A90D9'}}>{`{{nome}}`}</code>, <code style={{color: '#4A90D9'}}>{`{{empresa}}`}</code>, <code style={{color: '#4A90D9'}}>{`{{valor}}`}</code>
            </div>
            <textarea required className="input-modal" rows={8} value={formTemplate.conteudo || ''} onChange={e => setFormTemplate({ ...formTemplate, conteudo: e.target.value })} placeholder="Olá {{nome}}, a sua proposta para a {{empresa}} está pronta..." />
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button type="button" onClick={onClose} className="btn-action" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn-action" style={{ flex: 1, background: "#4A90D9", color: "#fff", borderColor: "#4A90D9" }}>Gravar Template</button>
          </div>
        </form>
      </div>
    </div>
  );
};
