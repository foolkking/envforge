import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { zh } from "./locales/zh";

export const resources = {
  zh: { translation: zh },
  en: { translation: en }
} as const;

export type AppLanguage = keyof typeof resources;

export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  return value === "en" ? "en" : "zh";
}

export const defaultLanguage = normalizeLanguage(localStorage.getItem("envforge_locale"));

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: defaultLanguage,
    fallbackLng: "zh",
    interpolation: { escapeValue: false },
    returnObjects: true
  });

export { i18n };
