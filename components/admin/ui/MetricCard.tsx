import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  color?: string;
  borderColor?: string;
  icon?: string;
  sub?: string;
}

export const MetricCard = ({ label, value, color, borderColor, icon, sub }: MetricCardProps) => (
  <div className="metric-card" style={{ borderTop: borderColor ? `3px solid ${borderColor}` : undefined }}>
    <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
      {icon && <span>{icon}</span>}{label}
    </div>
    <div style={{ fontSize: "28px", fontWeight: 800, color: color || "var(--text-primary)", marginTop: 8 }}>{value}</div>
    {sub && <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: 4 }}>{sub}</div>}
  </div>
);
