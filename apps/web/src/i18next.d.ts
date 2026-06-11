import "i18next";
import type { resources, defaultLanguage } from "./i18n";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    defaultLng: typeof defaultLanguage;
    resources: typeof resources["zh"];
  }
}
