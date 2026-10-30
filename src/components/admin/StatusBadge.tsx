import { TONE_CLASSES, type Tone } from "@/lib/status";

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`badge border-transparent ${TONE_CLASSES[tone]}`}>{label}</span>;
}
