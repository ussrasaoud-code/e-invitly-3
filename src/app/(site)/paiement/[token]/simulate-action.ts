"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { loadPaymentByToken, markPaymentPaid } from "@/lib/payments";

/**
 * Test du parcours client sans payer : réservé à l'équipe (rôle vérifié en base).
 * Le paiement est enregistré comme « manuel » avec la référence SIMULATION.
 */
export async function simulatePayment(form: FormData) {
  const user = await requireStaff();
  const token = z.string().regex(/^[A-Za-z0-9_-]{24,64}$/).parse(form.get("token"));
  const ctx = await loadPaymentByToken(token);
  if (!ctx || ctx.payment.status !== "pending") return;
  await markPaymentPaid(ctx, { method: "manual", providerRef: "SIMULATION", payerEmail: null, actorId: user.id });
  revalidatePath(`/paiement/${token}`);
  revalidatePath(`/admin/invitations/${ctx.payment.invitation_id}`);
}
