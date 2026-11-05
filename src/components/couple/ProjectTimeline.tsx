import Link from "next/link";
import { validateInvitation } from "@/app/mon-espace/details-actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { fmt } from "@/lib/i18n/config";
import type { SiteDict } from "@/lib/i18n/dict";

export type ProjectState = {
  id: string;
  eventLabel: string;
  templateName: string;
  selfService: boolean;
  paid: boolean;
  payToken?: string;
  detailsAt: string | null;
  previewSent: boolean;
  validatedAt: string | null;
  status: string;
  responses: number;
};

type Step = { key: keyof SiteDict["order"]["tl"]; state: "done" | "current" | "todo"; text?: string; action?: React.ReactNode };

/**
 * Bande « Votre projet » de l'espace client : où en est l'invitation,
 * du choix du modèle jusqu'aux réponses des invités.
 */
export function ProjectTimeline({ p, o, date }: { p: ProjectState; o: SiteDict["order"]; date: (iso: string) => string }) {
  const live = p.status === "published";
  const formDone = !p.selfService || !!p.detailsAt;
  const validated = !!p.validatedAt || p.status === "ready" || live;
  const previewSent = p.previewSent || p.status === "pending_review" || validated;

  const steps: Step[] = [
    { key: "event", state: "done", text: fmt(o.tlEvent, { type: p.eventLabel, template: p.templateName }) },
    {
      key: "payment",
      state: p.paid ? "done" : p.selfService ? "current" : "todo",
      text: p.paid ? o.tlPaid : o.tlPayTodo,
      action: !p.paid && p.payToken && (p.selfService || validated) ? <Link href={`/paiement/${p.payToken}`} className="btn btn-primary btn-sm">{o.bannerPayButton}</Link> : null,
    },
    {
      key: "form",
      state: formDone ? "done" : p.paid ? "current" : "todo",
      text: formDone ? o.tlFormDone : o.tlFormTodo,
      action: !formDone && p.paid ? <Link href={`/mon-espace/${p.id}/informations`} className="btn btn-primary btn-sm">{o.paidButton}</Link> : null,
    },
    { key: "preview", state: previewSent ? "done" : formDone && (p.paid || !p.selfService) ? "current" : "todo", text: previewSent ? o.tlPreviewDone : formDone ? o.tlPreviewWait : undefined },
    {
      key: "changes",
      state: validated ? "done" : previewSent ? "current" : "todo",
      text: previewSent && !validated ? o.tlChanges : undefined,
      action:
        previewSent && !validated ? (
          <form action={validateInvitation}>
            <input type="hidden" name="id" value={p.id} />
            <SubmitButton className="btn btn-primary btn-sm" confirm={o.validateConfirm}>{o.validateButton}</SubmitButton>
          </form>
        ) : null,
    },
    { key: "validation", state: validated ? "done" : "todo", text: p.validatedAt ? fmt(o.tlValidated, { date: date(p.validatedAt) }) : undefined },
    { key: "final", state: live ? "done" : validated ? "current" : "todo", text: live ? o.tlFinalDone : validated ? o.tlFinalWait : undefined },
    { key: "rsvp", state: live ? "current" : "todo", text: live ? fmt(o.tlRsvp, { n: p.responses }) : undefined },
  ];

  return (
    <section aria-label={o.tlTitle} className="mt-5 rounded-sm border border-line bg-paper/60 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-stone">{o.tlTitle}</p>
      <ol className="mt-3">
        {steps.map((s, i) => (
          <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0" aria-current={s.state === "current" ? "step" : undefined}>
            {i < steps.length - 1 ? <span aria-hidden="true" className={`absolute start-[0.6875rem] top-6 h-[calc(100%-1.25rem)] w-px ${s.state === "done" ? "bg-forest" : "bg-line"}`} /> : null}
            <span
              aria-hidden="true"
              className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] ${
                s.state === "done" ? "bg-forest text-ivory" : s.state === "current" ? "border-2 border-forest bg-white text-forest" : "border border-line bg-white text-stone"
              }`}
            >
              {s.state === "done" ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${s.state === "todo" ? "text-stone" : "font-medium"}`}>
                {o.tl[s.key]} <span className="sr-only">— {o.tlState[s.state]}</span>
              </p>
              {s.text ? <p className="mt-0.5 text-sm text-stone">{s.text}</p> : null}
              {s.action ? <div className="mt-2">{s.action}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
