import React, { useState } from "react";

interface Lead {
  id: string;
  tipo_formulario: "contato" | "newsletter" | "pabx-orcamento";
  origem_url: string;
  nome: string | null;
  email: string;
  telefone: string | null;
  empresa: string | null;
  assunto: string | null;
  mensagem: string | null;
  dados_adicionais: Record<string, string> | null;
  created_at: string;
}

interface LeadsViewProps {
  leads: Lead[];
  carregarTudo: () => void;
}

const BADGE: Record<string, { label: string; color: string; bg: string }> = {
  "contato":        { label: "Contato",    color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  "newsletter":     { label: "Newsletter", color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  "pabx-orcamento": { label: "Orçamento PABX", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
};

function BadgeTipo({ tipo }: { tipo: string }) {
  const b = BADGE[tipo] ?? { label: tipo, color: "#9ca3af", bg: "rgba(156,163,175,0.1)" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
      color: b.color, background: b.bg, whiteSpace: "nowrap",
    }}>
      {b.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export const LeadsView = ({ leads, carregarTudo }: LeadsViewProps) => {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [leadDetalhe, setLeadDetalhe] = useState<Lead | null>(null);

  const filtrados = leads.filter((l) => {
    const matchTipo = filtroTipo === "Todos" || l.tipo_formulario === filtroTipo;
    const q = busca.toLowerCase();
    const matchBusca =
      !q ||
      (l.nome ?? "").toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      (l.empresa ?? "").toLowerCase().includes(q);
    return matchTipo && matchBusca;
  });

  return (
    <>
      {/* ── Filtros ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <select
            className="input-modal"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{ maxWidth: 200, margin: 0, padding: "8px 12px" }}
          >
            <option value="Todos">Todos os Formulários</option>
            <option value="contato">Contato</option>
            <option value="newsletter">Newsletter</option>
            <option value="pabx-orcamento">Orçamento PABX</option>
          </select>
          <input
            className="input-modal"
            style={{ maxWidth: 260, margin: 0, padding: "8px 12px" }}
            placeholder="🔍 Pesquisar por nome, e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
        {filtrados.length} lead{filtrados.length !== 1 ? "s" : ""} encontrado{filtrados.length !== 1 ? "s" : ""}
      </div>

      {/* ── Tabela ── */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Nome / Empresa</th>
              <th>Contato</th>
              <th>Formulário</th>
              <th>Página de Origem</th>
              <th style={{ textAlign: "right" }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 32 }}>
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
            {filtrados.map((lead) => (
              <tr key={lead.id}>
                <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--text-secondary)" }}>
                  {formatDate(lead.created_at)}
                </td>
                <td>
                  <strong>{lead.nome ?? "—"}</strong>
                  {lead.empresa && (
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{lead.empresa}</div>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>✉️ {lead.email}</div>
                  {lead.telefone && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>📞 {lead.telefone}</div>
                  )}
                </td>
                <td>
                  <BadgeTipo tipo={lead.tipo_formulario} />
                  {lead.assunto && (
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{lead.assunto}</div>
                  )}
                </td>
                <td style={{ maxWidth: 220 }}>
                  <a
                    href={lead.origem_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={lead.origem_url}
                    style={{
                      fontSize: 11, color: "#4A90D9", textDecoration: "none",
                      display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {lead.origem_url || "—"}
                  </a>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn-action"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => setLeadDetalhe(lead)}
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal de Detalhe ── */}
      {leadDetalhe && (
        <div className="modal-overlay" onClick={() => setLeadDetalhe(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Detalhe do Lead</h2>
              <button onClick={() => setLeadDetalhe(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 18 }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <Row label="Formulário"><BadgeTipo tipo={leadDetalhe.tipo_formulario} /></Row>
              <Row label="Data">{formatDate(leadDetalhe.created_at)}</Row>
              <Row label="Nome">{leadDetalhe.nome ?? "—"}</Row>
              <Row label="E-mail">
                <a href={`mailto:${leadDetalhe.email}`} style={{ color: "#4A90D9" }}>{leadDetalhe.email}</a>
              </Row>
              {leadDetalhe.telefone && <Row label="Telefone">{leadDetalhe.telefone}</Row>}
              {leadDetalhe.empresa && <Row label="Empresa">{leadDetalhe.empresa}</Row>}
              {leadDetalhe.assunto && <Row label="Assunto">{leadDetalhe.assunto}</Row>}
              {leadDetalhe.mensagem && (
                <Row label="Mensagem">
                  <span style={{ whiteSpace: "pre-wrap" }}>{leadDetalhe.mensagem}</span>
                </Row>
              )}
              <Row label="Página de Origem">
                <a href={leadDetalhe.origem_url} target="_blank" rel="noopener noreferrer"
                  style={{ color: "#4A90D9", wordBreak: "break-all" }}>
                  {leadDetalhe.origem_url || "—"}
                </a>
              </Row>

              {leadDetalhe.dados_adicionais && Object.keys(leadDetalhe.dados_adicionais).length > 0 && (
                <>
                  <div style={{ borderTop: "1px solid var(--border-light)", marginTop: 8, paddingTop: 12, fontWeight: 700, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Dados Técnicos (PABX)
                  </div>
                  {Object.entries(leadDetalhe.dados_adicionais).map(([k, v]) =>
                    v ? <Row key={k} label={k}>{v}</Row> : null
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ minWidth: 130, color: "var(--text-secondary)", fontWeight: 600 }}>{label}:</span>
      <span style={{ flex: 1, color: "var(--text-primary)" }}>{children}</span>
    </div>
  );
}
