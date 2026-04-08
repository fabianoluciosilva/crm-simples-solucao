"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/admin/layout/Sidebar";
import { Header } from "@/components/admin/layout/Header";
import { DashboardTab } from "@/components/admin/modules/DashboardTab";
import { PropostasTab } from "@/components/admin/modules/PropostasTab";
// import { ClientesTab } from "@/components/admin/modules/ClientesTab";

export default function AdminPage() {
  const [aba, setAba] = useState<string>("dashboard");
  const [perfilAtivo, setPerfilAtivo] = useState<any>(null);
  const [dados, setDados] = useState<any>({ propostas: [], clientes: [], tarefas: [] });

  // Lógica de carregar dados usando os novos Services
  // ...

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* 1. O Menu Lateral */}
      <Sidebar aba={aba} setAba={setAba} perfil={perfilAtivo} />

      <main className="main-content">
        {/* 2. O Cabeçalho */}
        <Header titulo={aba} />

        {/* 3. O Roteador de Abas */}
        {aba === 'dashboard' && (
          <DashboardTab 
            isAdmin={perfilAtivo?.perfil === 'Admin'} 
            propostas={dados.propostas} 
            // passar o resto das props...
          />
        )}

        {aba === 'propostas' && (
          <PropostasTab 
            propostas={dados.propostas} 
            carregarTudo={carregarTudo} 
            // passar o resto das props...
          />
        )}

        {/* {aba === 'clientes' && <ClientesTab ... />} */}

      </main>
    </div>
  );
}
