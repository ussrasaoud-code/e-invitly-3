import type { Language } from "./schema";

/** Intitulés des moments d'un mariage maghrébin, dans la langue de l'invitation. */
export type MaghrebMoment = "hammam" | "henna" | "chant" | "hennaDinner" | "reception" | "bride" | "tea" | "dinner" | "cake" | "end" | "fatiha" | "lendemain";

export const MAGHREB_TITLES: Record<Language, Record<MaghrebMoment, string> & { teaDetail: string; brideDetail: string }> = {
  fr: {
    hammam: "Hammam de la mariée", henna: "Cérémonie du henné", chant: "Chants du henné", hennaDinner: "Dîner", reception: "Accueil des invités",
    bride: "Entrée de la mariée", tea: "Goûter", dinner: "Dîner", cake: "Pièce montée", end: "Fin de la soirée", fatiha: "Fatiha", lendemain: "Brunch du lendemain",
    teaDetail: "Pâtisseries, salés, thé et jus", brideDetail: "La mariée dans ses différentes tenues",
  },
  en: {
    hammam: "Bride's hammam", henna: "Henna ceremony", chant: "Henna songs", hennaDinner: "Dinner", reception: "Guest welcome",
    bride: "Bride's entrance", tea: "Afternoon tea", dinner: "Dinner", cake: "Wedding cake", end: "End of the evening", fatiha: "Fatiha", lendemain: "Day-after brunch",
    teaDetail: "Pastries, savoury bites, tea and juice", brideDetail: "The bride in her different outfits",
  },
  ar: {
    hammam: "حمّام العروس", henna: "حفل الحناء", chant: "أغاني الحناء", hennaDinner: "العشاء", reception: "استقبال الضيوف",
    bride: "دخول العروس", tea: "الحلويات والشاي", dinner: "العشاء", cake: "كعكة العرس", end: "نهاية الحفل", fatiha: "الفاتحة", lendemain: "صبحية اليوم التالي",
    teaDetail: "حلويات ومملحات وشاي وعصير", brideDetail: "العروس بأزيائها المختلفة",
  },
  es: {
    hammam: "Hammam de la novia", henna: "Ceremonia de la henna", chant: "Cantos de la henna", hennaDinner: "Cena", reception: "Recepción de los invitados",
    bride: "Entrada de la novia", tea: "Merienda", dinner: "Cena", cake: "Tarta nupcial", end: "Fin de la fiesta", fatiha: "Fatiha", lendemain: "Brunch del día siguiente",
    teaDetail: "Pasteles, salados, té y zumos", brideDetail: "La novia con sus diferentes vestidos",
  },
  it: {
    hammam: "Hammam della sposa", henna: "Cerimonia dell'henné", chant: "Canti dell'henné", hennaDinner: "Cena", reception: "Accoglienza degli ospiti",
    bride: "Ingresso della sposa", tea: "Merenda", dinner: "Cena", cake: "Torta nuziale", end: "Fine della serata", fatiha: "Fatiha", lendemain: "Brunch del giorno dopo",
    teaDetail: "Dolci, salati, tè e succhi", brideDetail: "La sposa nei suoi diversi abiti",
  },
  de: {
    hammam: "Hammam der Braut", henna: "Henna-Zeremonie", chant: "Henna-Lieder", hennaDinner: "Abendessen", reception: "Empfang der Gäste",
    bride: "Einzug der Braut", tea: "Tee & Gebäck", dinner: "Abendessen", cake: "Hochzeitstorte", end: "Ende des Abends", fatiha: "Fatiha", lendemain: "Brunch am Tag danach",
    teaDetail: "Gebäck, Herzhaftes, Tee und Saft", brideDetail: "Die Braut in ihren verschiedenen Kleidern",
  },
  nl: {
    hammam: "Hammam van de bruid", henna: "Hennaceremonie", chant: "Hennaliederen", hennaDinner: "Diner", reception: "Ontvangst van de gasten",
    bride: "Binnenkomst van de bruid", tea: "Thee & gebak", dinner: "Diner", cake: "Bruidstaart", end: "Einde van de avond", fatiha: "Fatiha", lendemain: "Brunch de dag erna",
    teaDetail: "Gebak, hartige hapjes, thee en sap", brideDetail: "De bruid in haar verschillende jurken",
  },
};
