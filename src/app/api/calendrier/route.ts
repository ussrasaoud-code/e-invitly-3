import { NextResponse, type NextRequest } from "next/server";
import { buildIcs } from "@/lib/ics";

/** Ajout au calendrier depuis une invitation (fichier .ics, ouvert par l'agenda du téléphone). */
export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const title = (q.get("t") ?? "").slice(0, 160) || "Mariage";
  const local = q.get("d") ?? "";
  const tz = q.get("z") ?? "Europe/Paris";
  const location = (q.get("l") ?? "").slice(0, 300);
  let timeZone = "Europe/Paris";
  try {
    new Intl.DateTimeFormat("fr", { timeZone: tz });
    timeZone = tz;
  } catch {}
  const ics = buildIcs({ title, local, timeZone, location });
  if (!ics) return new NextResponse("Date invalide", { status: 400 });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="invitation.ics"',
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
