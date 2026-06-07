import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, FileCode, FileText, ListChecks, SkipForward } from "lucide-react";
import type { PlaybookPreview, PreviewFile, PreviewTask } from "../api";
import type { Locale } from "../lib/types";

type Tab = "tasks" | "files" | "yaml";

const effectLabelZh: Record<PreviewTask["effectKind"], string> = {
  install: "能力安装",
  config: "配置变更",
  service: "服务状态",
  command: "命令",
  filesystem: "文件",
  user: "用户",
  other: "其他"
};

const effectLabelEn: Record<PreviewTask["effectKind"], string> = {
  install: "Capability install",
  config: "Config change",
  service: "Service",
  command: "Command",
  filesystem: "File",
  user: "User",
  other: "Other"
};

export function PreviewPanel({
  preview,
  locale,
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
  const [tab, setTab] = useState<Tab>("tasks");
  const t = locale === "zh"
    ? {
        back: "返回编辑",
        cancel: "取消",
        confirm: "确认应用计划",
        submitting: "应用中...",
        tasks: "计划动作",
        files: "受影响文件",
        yaml: "Environment Plan YAML",
        tasksDesc: "EnvForge 会把这些能力动作作为 Environment Plan 执行；跳过项会被标灰。",
        filesDesc: "这些目标机器文件会被创建、修改或删除。高风险文件应先验证并保留回滚点。",
        filesEmpty: "此计划不会修改文件。",
        yamlDesc: "这是渲染后的计划内容，可用于审查、导出或离线执行。",
        verifyTitle: "应用后验证检查",
        hiddenVarsLabel: "因表单条件隐藏、不会传给计划执行器的字段：",
        skipped: "跳过",
        impact: "影响范围",
        actionLabels: { "create-or-replace": "创建/替换", "edit-line": "行级修改", "delete": "删除" }
      }
    : {
        back: "Back to edit",
        cancel: "Cancel",
        confirm: "Create reviewed plan",
        submitting: "Applying...",
        tasks: "Plan actions",
        files: "Affected files",
        yaml: "Environment Plan YAML",
        tasksDesc: "EnvForge will convert these capability actions into an Environment Plan; skipped tasks are dimmed.",
        filesDesc: "These target files will be created, modified, or deleted. Risky files should be validated with rollback points.",
        filesEmpty: "No files will be modified by this plan.",
        yamlDesc: "This rendered recipe can be reviewed, imported into an Environment Plan, or exported.",
        verifyTitle: "Post-apply verification checks",
        hiddenVarsLabel: "Schema fields hidden by form conditions and not sent to the plan runner:",
        skipped: "skipped",
        impact: "Impact",
        actionLabels: { "create-or-replace": "Create/Replace", "edit-line": "Edit line", "delete": "Delete" }
      };

  return (
    <div className="preview-panel">
      <div className="preview-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "tasks"} className={tab === "tasks" ? "active" : ""} onClick={() => setTab("tasks")}>
          <ListChecks size={14} /> {t.tasks} <span className="preview-tab-count">{preview.tasks.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "files"} className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>
          <FileText size={14} /> {t.files} <span className="preview-tab-count">{preview.files.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "yaml"} className={tab === "yaml" ? "active" : ""} onClick={() => setTab("yaml")}>
          <FileCode size={14} /> {t.yaml}
        </button>
      </div>

      <div className="preview-content">
        {tab === "tasks" ? <TaskList preview={preview} locale={locale} copy={t} /> : null}
        {tab === "files" ? <FilesList files={preview.files} desc={t.filesDesc} empty={t.filesEmpty} actionLabels={t.actionLabels} /> : null}
        {tab === "yaml" ? <YamlPreview yaml={preview.renderedYaml} desc={t.yamlDesc} /> : null}
      </div>

      <div className="preview-actions">
        <button type="button" className="ghost-action" onClick={onBack} disabled={submitting}>
          {hideBackButton ? t.cancel : <><ChevronLeft size={14} /> {t.back}</>}
        </button>
        <button type="button" className="primary-action" onClick={onConfirm} disabled={submitting}>
          {submitting ? t.submitting : t.confirm}
        </button>
      </div>
    </div>
  );
}

function TaskList({ preview, locale, copy }: {
  preview: PlaybookPreview;
  locale: Locale;
  copy: {
    tasksDesc: string;
    hiddenVarsLabel: string;
    verifyTitle: string;
    skipped: string;
    impact: string;
  };
}) {
  const labels = locale === "zh" ? effectLabelZh : effectLabelEn;
  return (
    <div>
      <p className="preview-section-desc">{copy.tasksDesc}</p>
      <div className="preview-impact">
        <strong>{copy.impact}:</strong>
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
        {preview.tasks.map((task, i) => (
          <li key={`${task.name}-${i}`} className={task.willSkip ? "skipped" : ""}>
            <span className="preview-task-icon" title={labels[task.effectKind]}>{labels[task.effectKind].slice(0, 1)}</span>
            <div className="preview-task-body">
              <div className="preview-task-name">
                {task.name}
                {task.willSkip ? <span className="preview-skipped-tag"><SkipForward size={11} /> {copy.skipped}</span> : null}
              </div>
              <div className="preview-task-summary">{task.summary}</div>
              {task.willSkip && task.skipReason ? <div className="preview-task-skip-reason">{task.skipReason}</div> : null}
            </div>
          </li>
        ))}
      </ol>

      {preview.verifyChecks?.length ? (
        <>
          <h4 className="preview-section-h">{copy.verifyTitle}</h4>
          <ul className="preview-verify">
            {preview.verifyChecks.map((check, i) => (
              <li key={`${check.name}-${i}`}>
                <CheckCircle2 size={12} aria-hidden /> <strong>{check.name}</strong>
                <code>{check.cmd}</code>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {preview.hiddenVars?.length ? (
        <p className="preview-section-desc">{copy.hiddenVarsLabel} {preview.hiddenVars.join(", ")}</p>
      ) : null}
    </div>
  );
}

function FilesList({ files, desc, empty, actionLabels }: {
  files: PreviewFile[];
  desc: string;
  empty: string;
  actionLabels: Record<PreviewFile["action"], string>;
}) {
  if (files.length === 0) return <p className="preview-section-desc">{empty}</p>;
  return (
    <div>
      <p className="preview-section-desc">{desc}</p>
      <ul className="preview-files">
        {files.map((file, i) => (
          <li key={`${file.path}-${i}`}>
            <span>{actionLabels[file.action]}</span>
            <code>{file.path}</code>
            {file.contentPreview ? <pre>{file.contentPreview}</pre> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function YamlPreview({ yaml, desc }: { yaml: string; desc: string }) {
  return (
    <div>
      <p className="preview-section-desc">{desc}</p>
      <pre className="preview-yaml">{yaml}</pre>
    </div>
  );
}
