import { NextResponse } from "next/server";

const encoder = new TextEncoder();
const normalize = (value: string) => value.trim().toLowerCase();

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  let body: { email?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const email = normalize(body.email || "");
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL;
  const secret = process.env.AUTH_VERIFICATION_SECRET;
  if (!resendKey || !from || !secret) return NextResponse.json({ error: "O envio de e-mail ainda não foi configurado no ambiente." }, { status: 503 });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = Date.now() + 10 * 60 * 1000;
  const signature = await sign(`${email}:${code}:${expires}`, secret);
  const token = btoa(`${email}|${code}|${expires}|${signature}`);
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [email], subject: "Seu código VxLeads", html: `<div style="font-family:Arial,sans-serif;background:#08090b;color:#f5f5f6;padding:32px;border-radius:14px"><div style="color:#ff6a2b;font-size:13px;letter-spacing:2px;font-weight:700">VXLEADS</div><h1 style="font-size:26px;margin:20px 0 8px">Confirme seu e-mail</h1><p style="color:#a3a8b2">Use este código para concluir seu workspace. Ele expira em 10 minutos.</p><div style="font-size:34px;letter-spacing:9px;font-weight:800;color:#ff6a2b;margin:28px 0">${code}</div><p style="color:#ffb08f;font-size:13px;font-weight:700">Não encontrou? Verifique a pasta Spam ou Lixo eletrônico.</p><p style="color:#777d88;font-size:12px">Se você não solicitou este código, ignore esta mensagem.</p></div>` }) });
  if (!response.ok) return NextResponse.json({ error: "Não foi possível enviar o código agora." }, { status: 502 });
  const result = NextResponse.json({ sent: true });
  result.cookies.set("vxleads_verification", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  return result;
}
