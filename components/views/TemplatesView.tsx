import React from "react";

interface TemplatesViewProps {
  setFormTemplate: (val: any) => void;
  setModalTemplate: (val: boolean) => void;
  templates: any[];
  excluirTemplate: (id: number) => void;
}

export const TemplatesView = ({ setFormTemplate, setModalTemplate, templates, excluirTemplate }: TemplatesViewProps) => {
  return (
    <>
      <button onClick={() => { setFormTemplate({ nome: "", tipo: "WhatsApp", conteudo: "", assunto: "" }); setModalTemplate(true); }} className="btn-action" style={{ marginBottom: "20px", background: "#4A90D9", color: "#fff", border: "none", padding: "9px 18px" }}>+ Novo Template</button>
      <div className="table-wrapper">
        <table>
          <thead><tr><th>Nome</th><th>Canal</th><th>Pré-visualização</th><th style={{ textAlign: "right" }}>Ação</th></tr></thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.id}>
                <td style={{ whiteSpace: "nowrap" }}><strong>{t.nome}</strong></td>
                <td><span className="badge-status" style={{ background: t.tipo === 'WhatsApp' ? 'rgba(34,197,94,0.15)' : 'rgba(74,144,217,0.15)', color: t.tipo === 'WhatsApp' ? '#22c55e' : '#4A90D9' }}>{t.tipo}</span></td>
                <td><div style={{ maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "12px", color: "var(--text-secondary)" }}>{t.conteudo}</div></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn-action" onClick={() => { setFormTemplate(t); setModalTemplate(true); }}>Editar</button>
                  <button className="btn-action" style={{ color: "#f87171", margin: 0 }} onClick={() => excluirTemplate(t.id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
