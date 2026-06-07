import React, { useState } from "react";
import type { Locale } from "../lib/types";

type Step = 1 | 2 | 3 | 4;

const COPY = {
  zh: {
    title: "欢迎使用 EnvForge",
    subtitle: "选择模式，生成计划，再安全应用",
    skip: "跳过",
    next: "下一步",
    prev: "上一步",
    finish: "开始使用",
    s1Title: "1. 选择迁移或构建",
    s1Body: "迁移模式从旧虚拟机的只读主机快照开始；构建模式从空白目标虚拟机和能力选择开始。",
    s2Title: "2. 使用能力规则库",
    s2Body: "选择 Nginx、Docker、PostgreSQL 或 SSH hardening 等能力。EnvForge 会把它们加入 Environment Plan，而不是绕过审查直接安装。",
    s3Title: "3. 审查环境计划",
    s3Body: "所有目标机器变更都会以计划动作展示风险、sudo 影响、验证钩子和回滚说明。",
    s4Title: "4. 应用、验证、报告",
    s4Body: "EnvForge 只执行已确认的计划，随后验证服务、记录日志，并为已管理环境保留回滚和报告产物。"
  },
  en: {
    title: "Welcome to EnvForge",
    subtitle: "Choose a mode, generate a plan, then apply safely",
    skip: "Skip",
    next: "Next",
    prev: "Back",
    finish: "Get started",
    s1Title: "1. Choose Migrate or Build",
    s1Body: "Migrate Mode starts from a read-only source VM snapshot. Build Mode starts from an empty target VM and selected capabilities.",
    s2Title: "2. Use the Capability Catalog",
    s2Body: "Select capabilities such as Nginx, Docker, PostgreSQL, or SSH hardening. EnvForge adds them to an Environment Plan instead of running a direct install.",
    s3Title: "3. Review the Environment Plan",
    s3Body: "Every target change is shown as plan actions with risk, sudo impact, validation checks, and rollback notes before Apply.",
    s4Title: "4. Apply, verify, report",
    s4Body: "EnvForge applies approved plans, verifies services, records logs, and keeps rollback/report artifacts for managed environments."
  }
} as const;

export function OnboardingWizard({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const t = COPY[locale];
  const [step, setStep] = useState<Step>(1);
  const titles: Record<Step, string> = { 1: t.s1Title, 2: t.s2Title, 3: t.s3Title, 4: t.s4Title };
  const bodies: Record<Step, string> = { 1: t.s1Body, 2: t.s2Body, 3: t.s3Body, 4: t.s4Body };

  function dismiss() {
    try { localStorage.setItem("envforge_onboarded", "1"); } catch { /* ignore */ }
    onClose();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
      <section className="onboarding-modal">
        <header>
          <p className="eyebrow">EnvForge</p>
          <h2>{t.title}</h2>
          <p className="onboarding-sub">{t.subtitle}</p>
          <button type="button" className="onboarding-skip" onClick={dismiss}>{t.skip} x</button>
        </header>
        <div className="onboarding-progress">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div key={s} className={`onboarding-dot ${s <= step ? "active" : ""}`} />
          ))}
        </div>
        <div className="onboarding-body">
          <h3>{titles[step]}</h3>
          <p>{bodies[step]}</p>
        </div>
        <footer>
          {step > 1 ? (
            <button type="button" className="ghost-action" onClick={() => setStep((s) => (s - 1) as Step)}>{t.prev}</button>
          ) : null}
          <div style={{ flex: 1 }} />
          {step < 4 ? (
            <button type="button" className="primary-action" onClick={() => setStep((s) => (s + 1) as Step)}>{t.next}</button>
          ) : (
            <button type="button" className="primary-action" onClick={dismiss}>{t.finish}</button>
          )}
        </footer>
      </section>
    </div>
  );
}
