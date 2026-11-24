"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Lang = "en" | "te";

// Public-site navigation and hero copy in English and Telugu.
const dict = {
  en: {
    home: "Home", how: "How it works", restaurants: "For restaurants", ngos: "For NGOs", impact: "Our impact",
    about: "About us", contact: "Contact", login: "Log in", start: "Get started",
    heroTitle: "Rescue surplus food. Deliver real impact.",
    heroBody: "An intelligent food rescue network connecting food businesses, NGOs and volunteers to reduce waste and make surplus food reach communities that need it.",
    explore: "Explore how it works",
    switchTo: "తెలుగు",
  },
  te: {
    home: "హోమ్", how: "ఇది ఎలా పనిచేస్తుంది", restaurants: "రెస్టారెంట్ల కోసం", ngos: "స్వచ్ఛంద సంస్థల కోసం",
    impact: "మా ప్రభావం", about: "మా గురించి", contact: "సంప్రదించండి", login: "లాగిన్", start: "ప్రారంభించండి",
    heroTitle: "మిగులు ఆహారాన్ని కాపాడండి. నిజమైన మార్పు తీసుకురండి.",
    heroBody: "ఆహార వ్యాపారాలు, స్వచ్ఛంద సంస్థలు మరియు వాలంటీర్లను కలిపే ఆహార రక్షణ నెట్‌వర్క్. వృథాను తగ్గించి, మిగులు ఆహారం అవసరమైన వారికి చేరేలా చేస్తుంది.",
    explore: "ఇది ఎలా పనిచేస్తుందో చూడండి",
    switchTo: "English",
  },
};

const Ctx = createContext<{ lang: Lang; t: typeof dict.en; toggle: () => void }>({ lang: "en", t: dict.en, toggle: () => {} });

export function MarketingLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fr_lang");
      if (saved === "te") setLang("te");
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const toggle = () =>
    setLang((l) => {
      const next = l === "en" ? "te" : "en";
      try { localStorage.setItem("fr_lang", next); } catch { /* ignore */ }
      return next;
    });
  return <Ctx.Provider value={{ lang, t: dict[lang], toggle }}>{children}</Ctx.Provider>;
}

export const useMarketingLang = () => useContext(Ctx);
