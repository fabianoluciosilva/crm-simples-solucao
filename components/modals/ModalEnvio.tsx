import React from "react";

interface ModalEnvioProps {
  modalEnvioProposta: any;
  setModalEnvioProposta: (val: any) => void;
  formEnvioMensagem: any;
  setFormEnvioMensagem: (val: any) => void;
  confirmarEnvioMensagem: (e: React.FormEvent) => Promise<void>;
  templates: any[];
  enviando: number | null;
}

export const ModalEnvio = ({
  modalEnvioProposta,
  setModalEnvioProposta,
  formEnvioMensagem,
  setFormEnvioMensagem,
  confirmarEnvioMensagem,
  templates,
  enviando
}: ModalEnvioProps) => {
  if (!modalEnvioProposta.ativo || !modalEnvioProposta.prop) return null;

  return (
    <div className="modal-overlay" onClick={() => setModalEnvioProposta({ ativo: false, tipo: 'Email', prop: null, numeroWpp: '' })}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 6 }}>Enviar {modalEnvioProposta.tipo === 'Email' ? '📧 E-mail' : '💬 WhatsApp'}</h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Para: <strong>{modalEnvioProposta.prop.cliente}</strong></p>
        <form onSubmit={confirmarEnvioMensagem} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {modalEnvioProposta.tipo === 'WhatsApp' && (
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Número de Destino (Com DDD e código do país)</label>
              <input required className="input-modal" value={modalEnvioProposta.numeroWpp} onChange={e => setModalEnvioProposta({ ...modalEnvioProposta, numeroWpp: e.target.value })} placeholder="Ex: 5521999999999" />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Template</label>
            <select className="input-modal" value={formEnvioMensagem.templateId} onChange={e => setFormEnvioMensagem({ ...formEnvioMensagem, templateId: e.target.value })}>
              <option value="" disabled>Selecione um template...</option>
              {templates.filter(t => t.tipo === modalEnvioProposta.tipo).map(t => (
                <option key={t.id} value={t.id.toString()}>{t.nome}</option>
              ))}
              <option value="custom">✍️ Mensagem personalizada...</option>
            </select>
          </div>
          {formEnvioMensagem.templateId && modalEnvioProposta.tipo === 'Email' && (
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Assunto</label>
              <input required className="input-modal" value={formEnvioMensagem.assunto} onChange={e => setFormEnvioMensagem({ ...formEnvioMensagem, assunto: e.target.value })} placeholder="Assunto do e-mail..." />
            </div>
          )}
          {formEnvioMensagem.templateId && (
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Mensagem (pode editar antes de enviar)</label>
              <textarea required className="input-modal" rows={8} value={formEnvioMensagem.texto} onChange={e => setFormEnvioMensagem({ ...formEnvioMensagem, texto: e.target.value })} placeholder="Digite a mensagem..." />
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            <button type="button" onClick={() => setModalEnvioProposta({ ativo: false, tipo: 'Email', prop: null, numeroWpp: '' })} className="btn-action" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={!formEnvioMensagem.templateId || !formEnvioMensagem.texto.trim() || enviando === modalEnvioProposta.prop.id} className="btn-action" style={{ flex: 1, background: "#4A90D9", color: "#fff", borderColor: "#4A90D9" }}>
              {enviando === modalEnvioProposta.prop.id ? '⏳ A enviar...' : `Enviar ${modalEnvioProposta.tipo}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
