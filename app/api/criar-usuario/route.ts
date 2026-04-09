import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, senha, perfil, filial, nome } = await request.json();

    // Cria um cliente Supabase com "Poderes de Administrador" para poder criar a senha
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Cria o utilizador no Cofre-Forte do Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true // Já entra verificado
    });

    if (authError) throw authError;

    // 2. Guarda o Perfil, Nome e Filial na nossa tabela do CRM
    const { error: dbError } = await supabaseAdmin.from('perfis').insert([{
      id: authData.user.id,
      email: email,
      perfil: perfil,
      filial: filial,
      nome: nome
    }]);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
