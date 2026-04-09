import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, senha, perfil, filial, nome } = await request.json();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let userId;

    // 1. Tenta criar o utilizador no Cofre do Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true
    });

    if (authError) {
      // Se o utilizador já existir (ex: entrou pelo Google antes), o sistema recupera-o!
      if (authError.message.includes('already') || authError.status === 422) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = listData?.users.find(u => u.email === email);
        
        if (existingUser) {
          userId = existingUser.id;
          // Atualiza a senha dele para a nova que você definiu no painel
          await supabaseAdmin.auth.admin.updateUserById(userId, { password: senha });
        } else {
          throw authError;
        }
      } else {
        throw authError;
      }
    } else {
      userId = authData.user.id;
    }

    // 2. Guarda ou Atualiza na tabela 'perfis' (UPSERT garante que nunca falha)
    const { error: dbError } = await supabaseAdmin.from('perfis').upsert([{
      id: userId,
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
