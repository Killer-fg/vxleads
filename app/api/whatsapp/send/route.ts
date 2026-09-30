import { NextResponse } from "next/server";

type Body = { to?: string; text?: string };

export async function POST(request: Request) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v23.0";
  if (!token || !phoneNumberId) return NextResponse.json({ error: "WhatsApp Business ainda não configurado. Adicione WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID na Vercel." }, { status: 503 });
  let body: Body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const to = (body.to || "").replace(/\D/g, "");
  const text = (body.text || "").trim();
  if (to.length < 8 || text.length < 1 || text.length > 4096) return NextResponse.json({ error: "Número ou mensagem inválida." }, { status: 400 });
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text } }) });
  const payload = await response.json() as { error?: { message?: string }; messages?: Array<{ id?: string }> };
  if (!response.ok) return NextResponse.json({ error: payload?.error?.message || "A API do WhatsApp recusou o envio." }, { status: response.status });
  return NextResponse.json({ ok: true, messageId: payload?.messages?.[0]?.id || null });
}

