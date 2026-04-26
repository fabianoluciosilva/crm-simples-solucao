import React from "react";

interface ModalUsuarioProps {
  isOpen: boolean;
  onClose: () => void;
  formUsuario: any;
  setFormUsuario: (val: any) => void;
  salvarUsuario: (e: React.FormEvent) => Promise<void>;
}

export const ModalUsuario = ({ isOpen, onClose, formUsuario, setFormUsuario, salvarUsuario }: ModalUsuarioProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>{formUsuario.id ? "🔐 Editar Permissões" : "➕ Registar Novo Membro"}</h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
          {formUsuario.id 
            ? "Altere o nível de acesso e a filial deste membro da equipa."
            : "Crie uma conta para o seu novo membro. Ele usará este E-mail e Senha para entrar no CRM."}
        </p>
        <form onSubmit={salvarUsuario} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Nome do Colaborador</label>
            <input required className="input-modal" value={formUsuario.nome || ''} onChange={e => setFormUsuario({ ...formUsuario, nome: e.target.value })} placeholder="Ex: Gabriel" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>E-mail de Acesso</label>
            <input required type="email" className="input-modal" value={formUsuario.email || ''} onChange={e => setFormUsuario({ ...formUsuario, email: e.target.value.toLowerCase() })} disabled={!!formUsuario.id} style={{ opacity: formUsuario.id ? 0.6 : 1 }} placeholder="exemplo@simplessolucao.com.br" />
          </div>
          {!formUsuario.id && (
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Senha Temporária * (Mín. 6 caracteres)</label>
              <input required type="password" className="input-modal" value={formUsuario.senha || ''} onChange={e => setFormUsuario({ ...formUsuario, senha: e.target.value })} placeholder="******" />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Nível de Acesso (Perfil)</label>
            <select className="input-modal" value={formUsuario.perfil || 'Comercial'} onChange={e => setFormUsuario({ ...formUsuario, perfil: e.target.value })}>
              <option value="Admin">Admin — Acesso Total e Financeiro</option>
              <option value="Comercial">Comercial — Propostas e Clientes</option>
              <option value="Suporte">Suporte — Apenas Tarefas</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Filial</label>
            <input required className="input-modal" value={formUsuario.filial || ''} onChange={e => setFormUsuario({ ...formUsuario, filial: e.target.value })} placeholder="Ex: Matriz, São Paulo..." />
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn-action" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn-action" style={{ flex: 1, background: "#4A90D9", color: "#fff", borderColor: "#4A90D9" }}>{formUsuario.id ? "Salvar Acessos" : "Registar Membro"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
