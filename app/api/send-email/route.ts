import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, html, pdfBase64, fileName } = body;

    // Verifica se as variáveis de ambiente existem na Vercel
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json({ error: "As variáveis SMTP_USER e SMTP_PASS não estão configuradas na Vercel." }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER.trim(), // O trim() remove espaços acidentais
        pass: process.env.SMTP_PASS.trim(),
      },
    });

    // Força a validação da conexão para capturarmos o erro exato do Google
    await transporter.verify();

    await transporter.sendMail({
      from: `"Simples Solução TI" <${process.env.SMTP_USER.trim()}>`,
      to,
      subject,
      html,
      attachments: pdfBase64 ? [{ filename: fileName, content: pdfBase64, encoding: 'base64' }] : [],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro interno do Nodemailer:", error);
    // Devolve para o front-end a mensagem de erro exata que o Google gerou
    return NextResponse.json({ error: error.message || "Erro desconhecido na conexão SMTP." }, { status: 500 });
  }
}
