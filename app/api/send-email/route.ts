import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  const { to, subject, html, pdfBase64, fileName } = await request.json();

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Simples Solução TI" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments: pdfBase64 ? [{ filename: fileName, content: pdfBase64, encoding: 'base64' }] : [],
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Falha no envio" }, { status: 500 });
  }
}
