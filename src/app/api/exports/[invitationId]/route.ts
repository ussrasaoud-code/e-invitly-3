import { NextResponse, type NextRequest } from "next/server";
import writeExcelFile from "write-excel-file/node";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { exportRows, loadRsvpOverview } from "@/lib/rsvp-data";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

/**
 * Export des réponses RSVP d'une invitation (Excel ou CSV).
 * Lu avec la session de l'utilisateur : l'équipe voit tout, un couple
 * uniquement ses invitations (règles de la base). Régimes et allergies
 * ne sont inclus que si on le demande (?regimes=1).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(invitationId)) return new NextResponse("Introuvable", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/connexion", request.url));
  const supabase = await createClient();
  if (!supabase) return new NextResponse("Service non configuré", { status: 503 });

  const overview = await loadRsvpOverview(supabase, invitationId);
  if (!overview) return new NextResponse("Introuvable", { status: 404 });

  const includeDietary = request.nextUrl.searchParams.get("regimes") === "1";
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const rows = exportRows(overview, includeDietary);
  const base = `rsvp-${slugify(overview.title) || "invitation"}-${new Date().toISOString().slice(0, 10)}`;

  await logActivity({
    actorId: user.id,
    action: "rsvp.exported",
    resourceType: "invitation",
    resourceId: invitationId,
    summary: `Export ${format.toUpperCase()} des réponses de ${overview.title}${includeDietary ? " (avec régimes)" : ""}`,
  });

  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  if (format === "csv") {
    // Séparateur « ; » et BOM UTF-8 : s'ouvre directement dans Excel en français.
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
    return new NextResponse(csv, {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` },
    });
  }
  const sheet = rows.map((r, i) => r.map((v) => (i === 0 ? { value: String(v), fontWeight: "bold" as const } : v === "" ? null : v)));
  const buffer = await writeExcelFile(sheet as never, { sheet: "Réponses", stickyRowsCount: 1 } as never).toBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
    },
  });
}
