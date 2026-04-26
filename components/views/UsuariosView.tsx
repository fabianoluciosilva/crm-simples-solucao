import React from "react";

interface UsuariosViewProps {
  setFormUsuario: (val: any) => void;
  setModalUsuario: (val: boolean) => void;
  perfilAtivo: any;
  usuarios: any[];
  session: any;
  excluirUsuario: (id?: string, email?: string) => void;
}

export const UsuariosView = ({ setFormUsuario, setModalUsuario, perfilAtivo, usuarios, session, excluirUsuario }: UsuariosViewProps) => {
  return (
    <>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={() => { setFormUsuario({ id: undefined, email: '', nome: '', senha: '', perfil: 'Comercial', filial: perfilAtivo.filial }); setModalUsuario(true); }} className="btn-action" style={{ background: "#4A90D9", color: "#fff", border: "none", padding: "9px 18px", fontSize: 13 }}>+ Pré-registar Membro</button>
      </div>
      <div className="table-wrapper">
        <table>
          <thead><tr><th>Nome / E-mail</th><th>Perfil</th><th>Filial</th><th style={{ textAlign: "right" }}>Ações</th></tr></thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.email}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <strong>{u.nome || "Não definido"}</strong>
                  {u.email === session?.user?.email && <span style={{ marginLeft: 8, fontSize: 10, color: "#4A90D9", background: "rgba(74,144,217,0.1)", padding: "2px 6px", borderRadius: 10 }}>Você</span>}
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{u.email}</div>
                </td>
                <td><span className="badge-status" style={{ background: "rgba(74,144,217,0.1)", color: "#4A90D9" }}>{u.perfil}</span></td>
                <td>{u.filial}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn-action" onClick={() => { setFormUsuario(u); setModalUsuario(true); }}>Editar Acesso</button>
                  {u.email !== session?.user?.email && <button className="btn-action" style={{ color: "#f87171", margin: 0 }} onClick={() => excluirUsuario(u.id, u.email)}>Remover</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
