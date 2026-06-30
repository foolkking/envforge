import { Button } from "./ui/Button";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, ChevronLeft, FileCode, FileText, ListChecks, SkipForward } from "lucide-react";
import type { PlaybookPreview, PreviewFile, PreviewTask } from "../api";
import type { Locale } from "../lib/types";

type Tab = "tasks" | "files" | "yaml";

const EFFECT_LABEL_KEYS = {
  install: "preview.effects.install",
  config: "preview.effects.config",
  service: "preview.effects.service",
  command: "preview.effects.command",
  filesystem: "preview.effects.filesystem",
  user: "preview.effects.user",
  other: "preview.effects.other"
} as const satisfies Record<PreviewTask["effectKind"], string>;

const FILE_ACTION_LABEL_KEYS = {
  "create-or-replace": "preview.actions.createOrReplace",
  "edit-line": "preview.actions.editLine",
  delete: "preview.actions.delete"
} as const satisfies Record<PreviewFile["action"], string>;

export function PreviewPanel({
  preview,
  onBack,
  onConfirm,
  submitting,
  hideBackButton
}: {
  preview: PlaybookPreview;
  locale: Locale;
  onBack: () => void;
  onConfirm: () => void;
  submitting?: boolean;
  hideBackButton?: boolean;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("tasks");

  return (
    <div className="preview-panel">
      <div className="preview-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "tasks"} className={tab === "tasks" ? "active" : ""} onClick={() => setTab("tasks")}>
          <ListChecks size={14} /> {t("preview.tasks")} <span className="preview-tab-count">{preview.tasks.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "files"} className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>
          <FileText size={14} /> {t("preview.files")} <span className="preview-tab-count">{preview.files.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "yaml"} className={tab === "yaml" ? "active" : ""} onClick={() => setTab("yaml")}>
          <FileCode size={14} /> {t("preview.yaml")}
        </button>
      </div>

      <div className="preview-content">
        {tab === "tasks" ? <TaskList preview={preview} /> : null}
        {tab === "files" ? <FilesList files={preview.files} /> : null}
        {tab === "yaml" ? <YamlPreview yaml={preview.renderedYaml} /> : null}
      </div>

      <div className="preview-actions">
        <Button variant="ghost" type="button"  onClick={onBack} disabled={submitting}>
          {hideBackButton ? t("preview.cancel") : <><ChevronLeft size={14} /> {t("preview.back")}</>}
        </Button>
        <Button variant="primary" type="button"  onClick={onConfirm} disabled={submitting}>
          {submitting ? t("preview.submitting") : t("preview.confirm")}
        </Button>
      </div>
    </div>
  );
}

function TaskList({ preview }: { preview: PlaybookPreview }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="preview-section-desc">{t("preview.tasksDesc")}</p>
      <div className="preview-impact">
        <strong>{t("preview.impact")}:</strong>
        {preview.impact.disk ? <span>{String(preview.impact.disk)}</span> : null}
        {preview.impact.time ? <span>{String(preview.impact.time)}</span> : null}
        {preview.impact.sudo === true ? <span className="badge-sudo">sudo</span> : null}
        {preview.impact.risk ? (
          <span className={`badge-risk badge-risk-${preview.impact.risk}`}>
            {preview.impact.risk === "high" ? <AlertTriangle size={12} /> : null}
            {String(preview.impact.risk)}
          </span>
        ) : null}
      </div>

      <ol className="preview-tasks">
        {preview.tasks.map((task, index) => {
          const effectLabel = t(EFFECT_LABEL_KEYS[task.effectKind]);
          return (
            <li key={`${task.name}-${index}`} className={task.willSkip ? "skipped" : ""}>
              <span className="preview-task-icon" title={effectLabel}>{effectLabel.slice(0, 1)}</span>
              <div className="preview-task-body">
                <div className="preview-task-name">
                  {task.name}
                  {task.willSkip ? <span className="preview-skipped-tag"><SkipForward size={11} /> {t("preview.skipped")}</span> : null}
                </div>
                <div className="preview-task-summary">{task.summary}</div>
                {task.willSkip && task.skipReason ? <div className="preview-task-skip-reason">{task.skipReason}</div> : null}
              </div>
            </li>
          );
        })}
      </ol>

      {preview.verifyChecks?.length ? (
        <>
          <h4 className="preview-section-h">{t("preview.verifyTitle")}</h4>
          <ul className="preview-verify">
            {preview.verifyChecks.map((check, index) => (
              <li key={`${check.name}-${index}`}>
                <CheckCircle2 size={12} aria-hidden /> <strong>{check.name}</strong>
                <code>{check.cmd}</code>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {preview.hiddenVars?.length ? (
        <p className="preview-section-desc">{t("preview.hiddenVarsLabel")} {preview.hiddenVars.join(", ")}</p>
      ) : null}
    </div>
  );
}

function FilesList({ files }: { files: PreviewFile[] }) {
  const { t } = useTranslation();
  if (files.length === 0) return <p className="preview-section-desc">{t("preview.filesEmpty")}</p>;
  return (
    <div>
      <p className="preview-section-desc">{t("preview.filesDesc")}</p>
      <ul className="preview-files">
        {files.map((file, index) => (
          <li key={`${file.path}-${index}`}>
            <span>{t(FILE_ACTION_LABEL_KEYS[file.action])}</span>
            <code>{file.path}</code>
            {file.contentPreview ? <pre>{file.contentPreview}</pre> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function YamlPreview({ yaml }: { yaml: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="preview-section-desc">{t("preview.yamlDesc")}</p>
      <pre className="preview-yaml">{yaml}</pre>
    </div>
  );
}
