import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return NextResponse.json({ error: "Formato de requisição inválido." }, { status: 415 });
  }
  const workspaceKey = request.headers.get("x-google-maps-key")?.trim();
  const key = workspaceKey || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: "Google Maps não configurado." }, { status: 503 });

  let body: { query?: string; phone?: string; city?: string; state?: string; country?: string; regionCode?: string; leadLimit?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  for (const value of [body.query, body.city, body.state, body.country, body.regionCode]) {
    if (value !== undefined && (typeof value !== "string" || value.length > 120)) return NextResponse.json({ error: "Filtro inválido." }, { status: 400 });
  }
  const leadLimit = Math.min(100, Math.max(20, Number(body.leadLimit) || 60));
  const dialCodes: Record<string, string> = { BR: "55", PT: "351", US: "1", AR: "54", CL: "56", CO: "57", PE: "51", UY: "598", PY: "595", MX: "52", ES: "34" };
  const normalizedPhone = body.phone?.replace(/\D/g, "");
  const dialCode = dialCodes[body.regionCode || ""];
  let phoneQuery = body.phone?.trim() || "";
  if (normalizedPhone && dialCode) {
    const digits = phoneQuery.startsWith("00") ? phoneQuery.slice(2).replace(/\D/g, "") : normalizedPhone;
    const hasInternationalPrefix = phoneQuery.startsWith("+") || phoneQuery.startsWith("00");
    const effectiveDialCode = hasInternationalPrefix
      ? Object.values(dialCodes).sort((a, b) => b.length - a.length).find(code => digits.startsWith(code))
      : dialCode;
    phoneQuery = effectiveDialCode
      ? `+${effectiveDialCode} ${digits.startsWith(effectiveDialCode) ? digits.slice(effectiveDialCode.length) : digits}`
      : `+${digits}`;
  }
  const textQuery = normalizedPhone ? phoneQuery : [body.query, body.city, body.state, body.country].filter(Boolean).join(" em ");
  if ((!body.query || !body.city) && !normalizedPhone) return NextResponse.json({ error: "Informe segmento e cidade ou um número de telefone." }, { status: 400 });

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.location,places.primaryTypeDisplayName,nextPageToken",
    },
    body: JSON.stringify({ textQuery, languageCode: "pt-BR", regionCode: body.regionCode || "BR", maxResultCount: 20 }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "O Google Maps recusou a busca.";
    return NextResponse.json({ error: message }, { status: response.status });
  }
  const places = [...(payload.places ?? [])];
  let pageToken = payload.nextPageToken as string | undefined;
  for (let page = 0; page < Math.ceil(leadLimit / 20) - 1 && pageToken && places.length < leadLimit; page += 1) {
    const nextResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.location,places.primaryTypeDisplayName,nextPageToken",
      },
      body: JSON.stringify({ textQuery, languageCode: "pt-BR", regionCode: body.regionCode || "BR", pageSize: 20, pageToken }),
    });
    if (!nextResponse.ok) break;
    const nextPayload = await nextResponse.json();
    places.push(...(nextPayload.places ?? []));
    pageToken = nextPayload.nextPageToken;
  }
  const normalizedPlaces = places.slice(0, leadLimit).map((place: { nationalPhoneNumber?: string; internationalPhoneNumber?: string }) => {
    const national = place.nationalPhoneNumber?.replace(/\D/g, "");
    const international = place.internationalPhoneNumber || (national && dialCode
      ? `+${national.startsWith(dialCode) ? national : `${dialCode}${national}`}`
      : undefined);
    return international ? { ...place, internationalPhoneNumber: international, nationalPhoneNumber: international } : place;
  });
  return NextResponse.json({ places: normalizedPlaces, total: Math.min(places.length, leadLimit), requested: leadLimit });
}
