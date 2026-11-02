import type { SiteLang } from "../config";
import { ar } from "./ar";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { nl } from "./nl";

/** Même structure que le français, avec des textes libres. */
type Widen<T> = T extends string ? string : T extends readonly (infer U)[] ? Widen<U>[] : { [K in keyof T]: Widen<T[K]> };
export type SiteDict = Widen<typeof fr>;

export const DICTS: Record<SiteLang, SiteDict> = { fr, en, ar, es, it, de, nl };
