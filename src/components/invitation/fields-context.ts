"use client";

import { createContext } from "react";
import type { FieldValues } from "@/lib/invitation/fields";

/** Valeurs des champs automatiques ({prenom1}…) de l'invitation affichée */
export const FieldsContext = createContext<FieldValues | null>(null);
