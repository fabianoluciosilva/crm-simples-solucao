import React from "react";

interface ModalComunicadoProps {
  isOpen: boolean;
  onClose: () => void;
  progressoEmail: any;
  formComunicado: any;
  setFormComunicado: (val: any) => void;
  gerarFilaWhatsapp: () => void;
  dispararEmailsMassa: () => Promise<void>;
}

export const ModalComunicado = ({ isOpen, onClose, progressoEmail, formComunicado, setFormComunicado, gerarFilaWhatsapp, dispararEmailsMassa }: ModalComunicadoProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={() => !progressoEmail.ativo && onClose()}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>📢 Comunicado em Massa</h2>
        {progressoEmail.ativo ? (
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <p style={{ marginBottom: 12, fontSize: 14 }}>A enviar e-mails... ({progressoEmail.enviado} de {progressoEmail.total})</p>
            <div style={{ width: "100%", background: "var(--bg-main)", borderRadius: 10, height: 10, overflow: "hidden" }}>
              <div style={{ width: `${(progressoEmail.enviado / progressoEmail.total) * 100}%`, background: "#4A90D9", height: "100%", transition: "width 0.3s" }} />
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 12 }}>{Math.round((progressoEmail.enviado / progressoEmail.total) * 100)}% concluído</p>
          </div>
        ) : (
          <form style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Público alvo</label>
              <select className="input-modal" value={formComunicado.publico} onChange={e => setFormComunicado({ ...formComunicado, publico: e.target.value })}>
                <option value="Todos">Todos (Clientes, Leads e Parceiros)</option>
                <option value="Cliente">Apenas Clientes Ativos</option>
                <option value="Lead">Apenas Leads</option>
                <option value="Parceiro">Apenas Parceiros</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Assunto (para E-mail)</label>
              <input required className="input-modal" value={formComunicado.assunto} onChange={e => setFormComunicado({ ...formComunicado, assunto: e.target.value })} placeholder="Assunto do e-mail..." />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Mensagem</label>
              <textarea required className="input-modal" rows={6} value={formComunicado.mensagem} onChange={e => setFormComunicado({ ...formComunicado, mensagem: e.target.value })} placeholder="Escreva o comunicado aqui..." />
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
              <button type="button" onClick={onClose} className="btn-action" style={{ flex: 1 }}>Cancelar</button>
              <button type="button" onClick={gerarFilaWhatsapp} className="btn-action" style={{ flex: 1, background: "#22c55e", color: "#fff", borderColor: "#22c55e" }}>💬 Fila WhatsApp</button>
              <button type="button" onClick={dispararEmailsMassa} className="btn-action" style={{ flex: 1, background: "#4A90D9", color: "#fff", borderColor: "#4A90D9" }}>📧 Disparar E-mails</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
