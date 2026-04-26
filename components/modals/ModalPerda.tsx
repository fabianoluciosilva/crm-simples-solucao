import React from "react";

interface ModalPerdaProps {
  isOpen: boolean;
  onClose: () => void;
  formPerda: any;
  setFormPerda: (val: any) => void;
  confirmarPerda: (e: React.FormEvent) => Promise<void>;
}

export const ModalPerda = ({ isOpen, onClose, formPerda, setFormPerda, confirmarPerda }: ModalPerdaProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>📊 Análise de Lead Perdido</h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, marginTop: 8 }}>Informe o motivo da perda para melhorar a análise.</p>
        <form onSubmit={confirmarPerda} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <select required className="input-modal" value={formPerda.motivo} onChange={e => setFormPerda({ ...formPerda, motivo: e.target.value })}>
            <option value="" disabled>Selecione um motivo...</option>
            <option value="Preço">💰 Preço alto</option>
            <option value="Sem interesse">🤷 Sem interesse no momento</option>
            <option value="Concorrente">⚔️ Fechou com concorrente</option>
            <option value="Sem retorno">📵 Cliente não deu mais retorno</option>
            <option value="Fora do perfil">🎯 Fora do perfil de cliente</option>
            <option value="Orçamento indisponível">📅 Orçamento indisponível agora</option>
          </select>
          <textarea className="input-modal" rows={3} value={formPerda.obs} onChange={e => setFormPerda({ ...formPerda, obs: e.target.value })} placeholder="Observações adicionais (opcional)..." />
          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            <button type="button" onClick={onClose} className="btn-action" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={!formPerda.motivo} className="btn-action" style={{ flex: 1, background: "#f87171", color: "#fff", borderColor: "#f87171", opacity: !formPerda.motivo ? 0.5 : 1 }}>Registar Perda</button>
          </div>
        </form>
      </div>
    </div>
  );
};
