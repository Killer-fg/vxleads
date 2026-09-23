import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const encoder = new TextEncoder();

async function verifySignature(value: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = new Uint8Array(signature.match(/.{2}/g)?.map(part => parseInt(part, 16)) || []);
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(value));
}

export async function POST(request: Request) {
  let body: { email?: string; code?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const stored = (await cookies()).get("vxleads_verification")?.value;
  const parts = stored ? atob(stored).split("|") : [];
  const email = (body.email || "").trim().toLowerCase();
  const secret = process.env.AUTH_VERIFICATION_SECRET;
  const code = (body.code || "").trim();
  const expires = Number(parts[2]);
  const validSignature = parts.length === 4 && !!secret ? await verifySignature(`${parts[0]}:${parts[1]}:${parts[2]}`, parts[3], secret) : false;
  if (parts.length !== 4 || parts[0] !== email || parts[1] !== code || !/^\d{6}$/.test(code) || Date.now() > expires || !validSignature) return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 400 });
  const response = NextResponse.json({ verified: true });
  response.cookies.delete("vxleads_verification");
  return response;
}
