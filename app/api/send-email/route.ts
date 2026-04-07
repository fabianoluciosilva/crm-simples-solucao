import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, html, pdfBase64, fileName } = body;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json({ error: "As variáveis SMTP_USER e SMTP_PASS não estão configuradas na Vercel neste projeto." }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER.trim(),
        pass: process.env.SMTP_PASS.trim(),
      },
    });

    // Força a validação para capturar erros de senha ou bloqueio do Google
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
    console.error("Erro interno SMTP:", error);
    return NextResponse.json({ error: error.message || "Erro na conexão SMTP." }, { status: 500 });
  }
}
