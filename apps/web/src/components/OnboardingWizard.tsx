import { Button } from "./ui/Button";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Locale } from "../lib/types";
import { useEscapeToClose } from "../lib/useEscapeToClose";

type Step = 1 | 2 | 3 | 4;

const STEP_KEYS = {
  1: { title: "onboarding.steps.one.title", body: "onboarding.steps.one.body" },
  2: { title: "onboarding.steps.two.title", body: "onboarding.steps.two.body" },
  3: { title: "onboarding.steps.three.title", body: "onboarding.steps.three.body" },
  4: { title: "onboarding.steps.four.title", body: "onboarding.steps.four.body" }
} as const satisfies Record<Step, { title: string; body: string }>;

export function OnboardingWizard({ onClose }: { locale: Locale; onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);

  function dismiss() {
    try { localStorage.setItem("envforge_onboarded", "1"); } catch { /* ignore */ }
    onClose();
  }
  useEscapeToClose(dismiss);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
      <section className="onboarding-modal">
        <header>
          <p className="eyebrow">EnvForge</p>
          <h2>{t("onboarding.title")}</h2>
          <p className="onboarding-sub">{t("onboarding.subtitle")}</p>
          <button type="button" className="onboarding-skip" onClick={dismiss}>{t("onboarding.skip")} x</button>
        </header>
        <div className="onboarding-progress">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div key={s} className={`onboarding-dot ${s <= step ? "active" : ""}`} />
          ))}
        </div>
        <div className="onboarding-body">
          <h3>{t(STEP_KEYS[step].title)}</h3>
          <p>{t(STEP_KEYS[step].body)}</p>
        </div>
        <footer>
          {step > 1 ? (
            <Button variant="ghost" type="button"  onClick={() => setStep((s) => (s - 1) as Step)}>{t("onboarding.prev")}</Button>
          ) : null}
          <div style={{ flex: 1 }} />
          {step < 4 ? (
            <Button variant="primary" type="button"  onClick={() => setStep((s) => (s + 1) as Step)}>{t("onboarding.next")}</Button>
          ) : (
            <Button variant="primary" type="button"  onClick={dismiss}>{t("onboarding.finish")}</Button>
          )}
        </footer>
      </section>
    </div>
  );
}
