"use client";

import { useMemo, useState, useTransition } from "react";
import { submitRsvp } from "@/app/[slug]/rsvp-action";
import { EVENT_TYPE_LABELS, type InvitationEvent } from "@/lib/invitation/schema";
import type { PublicRsvpConfig, RsvpResult } from "@/lib/rsvp";
import type { Labels } from "./i18n";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
      );

/** Formulaire RSVP réel d'une invitation publiée. */
export function LiveRsvpForm({
  slug,
  config,
  events,
  labels,
}: {
  slug: string;
  config: PublicRsvpConfig;
  events: InvitationEvent[];
  labels: Labels;
}) {
  const f = config.fields;
  const [key, setKey] = useState(newKey);
  const [attending, setAttending] = useState<"yes" | "no" | "">("");
  const [companions, setCompanions] = useState(0);
  const [result, setResult] = useState<RsvpResult | null>(null);
  const [lastAttending, setLastAttending] = useState(true);
  const [pending, start] = useTransition();
  const showEvents = f.events && events.length > 1;
  const errorFields = useMemo(() => new Set(result && !result.ok ? result.fields ?? [] : []), [result]);

  if (!config.open) {
    return (
      <p className="mx-auto max-w-[300px] text-center leading-relaxed" style={{ color: "var(--inv-ink)" }}>
        {config.closedReason === "deadline" ? labels.errorDeadline : labels.errorClosed}
      </p>
    );
  }

  if (result?.ok) {
    return (
      <div role="status" className="mx-auto max-w-[300px] text-center">
        <p className="leading-relaxed" style={{ color: "var(--inv-ink)" }}>
          {result.updated ? labels.thanksUpdated : lastAttending ? labels.thanksYes : labels.thanksNo}
        </p>
        {config.mode === "open" ? (
          <button
            type="button"
            className="mt-6 text-sm underline underline-offset-4"
            style={{ color: "var(--inv-accent)" }}
            onClick={() => {
              setResult(null);
              setAttending("");
              setCompanions(0);
              setKey(newKey());
            }}
          >
            {labels.another}
          </button>
        ) : null}
      </div>
    );
  }

  const inputStyle = { color: "var(--inv-ink)", backgroundColor: "var(--inv-bg)" };
  const fieldCls = (name: string) =>
    `${errorFields.has(name) ? "border-[#a1453a]" : "inv-border-soft"} mt-1 block w-full min-h-11 border px-3 py-2 text-base outline-none focus:ring-2`;
  const labelCls = "block text-xs";
  const muted = { color: "var(--inv-muted)" };
  const max = config.maxCompanions;

  const errorMessage =
    result && !result.ok
      ? {
          invalid: labels.errorRequired,
          code: labels.errorCode,
          closed: labels.errorClosed,
          deadline: labels.errorDeadline,
          rate: labels.errorRate,
          unavailable: labels.errorServer,
          server: labels.errorServer,
        }[result.error]
      : null;

  return (
    <form
      className="mx-auto max-w-[320px] space-y-4"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        const answers: Record<string, string> = {};
        for (const q of config.questions) answers[q.id] = String(fd.get(`q_${q.id}`) ?? "");
        const isYes = attending === "yes";
        if (!attending) {
          setResult({ ok: false, error: "invalid", fields: ["attending"] });
          return;
        }
        setLastAttending(isYes);
        start(async () => {
          const res = await submitRsvp({
            slug,
            idempotencyKey: key,
            website: String(fd.get("website") ?? ""),
            code: String(fd.get("code") ?? ""),
            firstName: String(fd.get("firstName") ?? ""),
            lastName: String(fd.get("lastName") ?? ""),
            attending: isYes,
            companionsCount: companions,
            companionNames: Array.from({ length: companions }, (_, i) => String(fd.get(`companion_${i}`) ?? "")),
            events: fd.getAll("events").map(String),
            dietary: String(fd.get("dietary") ?? ""),
            childMenus: Number(fd.get("childMenus") ?? 0),
            comment: String(fd.get("comment") ?? ""),
            answers,
          }).catch((): RsvpResult => ({ ok: false, error: "server" }));
          setResult(res);
        });
      }}
    >
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {config.mode === "code" ? (
        <label className={labelCls} style={muted}>
          {labels.code} <span className="opacity-70">· {labels.codeHint}</span>
          <input name="code" required autoComplete="off" autoCapitalize="characters" className={`${fieldCls("code")} uppercase tracking-[0.2em]`} style={inputStyle} />
        </label>
      ) : null}

      <div className={f.lastName ? "grid grid-cols-2 gap-3" : ""}>
        <label className={labelCls} style={muted}>
          {labels.firstName}
          <input name="firstName" required autoComplete="given-name" className={fieldCls("firstName")} style={inputStyle} aria-invalid={errorFields.has("firstName") || undefined} />
        </label>
        {f.lastName ? (
          <label className={labelCls} style={muted}>
            {labels.lastName}
            <input name="lastName" required autoComplete="family-name" className={fieldCls("lastName")} style={inputStyle} aria-invalid={errorFields.has("lastName") || undefined} />
          </label>
        ) : null}
      </div>

      <fieldset>
        <legend className="text-xs" style={muted}>{labels.attending}</legend>
        <div className="mt-2 grid gap-2">
          {(["yes", "no"] as const).map((v) => (
            <label
              key={v}
              className={`${attending === v ? "inv-border-accent" : errorFields.has("attending") ? "border-[#a1453a]" : "inv-border-soft"} flex min-h-11 cursor-pointer items-center gap-3 border px-3 text-sm`}
              style={inputStyle}
            >
              <input type="radio" name="attending" value={v} checked={attending === v} onChange={() => setAttending(v)} style={{ accentColor: "var(--inv-accent)" }} />
              {v === "yes" ? labels.yes : labels.no}
            </label>
          ))}
        </div>
      </fieldset>

      {attending === "yes" ? (
        <>
          {f.companions && max > 0 ? (
            <label className={labelCls} style={muted}>
              {labels.companions} (0–{max})
              <select value={companions} onChange={(e) => setCompanions(Number(e.target.value))} className={fieldCls("companionsCount")} style={inputStyle}>
                {Array.from({ length: max + 1 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </label>
          ) : null}
          {f.companions && f.companionNames && companions > 0 ? (
            <div className="space-y-2">
              {Array.from({ length: companions }, (_, i) => (
                <label key={i} className={labelCls} style={muted}>
                  {labels.companionName} {companions > 1 ? i + 1 : ""}
                  <input name={`companion_${i}`} className={fieldCls("companionNames")} style={inputStyle} />
                </label>
              ))}
            </div>
          ) : null}
          {showEvents ? (
            <fieldset>
              <legend className="text-xs" style={muted}>{labels.whichEvents}</legend>
              <div className="mt-2 space-y-1">
                {events.map((e) => (
                  <label key={e.id} className="flex min-h-9 items-center gap-3 text-sm" style={{ color: "var(--inv-ink)" }}>
                    <input type="checkbox" name="events" value={e.id} defaultChecked style={{ accentColor: "var(--inv-accent)" }} />
                    {e.title || EVENT_TYPE_LABELS[e.type]}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {f.childMenus ? (
            <label className={labelCls} style={muted}>
              {labels.childMenus}
              <select name="childMenus" defaultValue={0} className={fieldCls("childMenus")} style={inputStyle}>
                {Array.from({ length: companions + 2 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </label>
          ) : null}
          {f.dietary ? (
            <label className={labelCls} style={muted}>
              {labels.dietary}
              <input name="dietary" maxLength={300} className={fieldCls("dietary")} style={inputStyle} />
            </label>
          ) : null}
          {config.questions.map((q) => (
            <label key={q.id} className={labelCls} style={muted}>
              {q.label}
              {q.required ? <span className="opacity-70"> · {labels.requiredMark}</span> : null}
              {q.type === "text" ? (
                <input name={`q_${q.id}`} maxLength={300} className={fieldCls(`q:${q.id}`)} style={inputStyle} />
              ) : (
                <select name={`q_${q.id}`} defaultValue="" className={fieldCls(`q:${q.id}`)} style={inputStyle}>
                  <option value="">{labels.choose}</option>
                  {q.type === "yesno" ? (
                    <>
                      <option value="oui">{labels.yesAnswer}</option>
                      <option value="non">{labels.noAnswer}</option>
                    </>
                  ) : (
                    q.options.map((o) => <option key={o} value={o}>{o}</option>)
                  )}
                </select>
              )}
            </label>
          ))}
        </>
      ) : null}

      {f.comment ? (
        <label className={labelCls} style={muted}>
          {labels.message}
          <textarea name="comment" rows={3} maxLength={1000} className={`${fieldCls("comment")} min-h-20`} style={inputStyle} />
        </label>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="text-center text-sm" style={{ color: "#a1453a" }}>{errorMessage}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex min-h-12 w-full items-center justify-center text-[0.75rem] uppercase tracking-[0.22em] transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: "var(--inv-accent)", color: "var(--inv-bg)" }}
      >
        {pending ? labels.sending : labels.send}
      </button>
      <p className="text-center text-xs" style={muted}>{labels.privacy}</p>
    </form>
  );
}
