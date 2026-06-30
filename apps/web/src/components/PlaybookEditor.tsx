import { Button } from "./ui/Button";
import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Locale } from "../lib/types";

export interface PlaybookEditorProps {
  yaml: string;
  onChange: (yaml: string) => void;
  onRunDryRun?: () => void;
  locale: Locale;
  readOnly?: boolean;
}

/** Basic YAML syntax check — no external dependency needed */
function validateYaml(content: string, messages: {
  tab: (line: number) => string;
  singleQuote: (line: number) => string;
  doubleQuote: (line: number) => string;
  duplicate: (line: number, key: string, firstLine: number) => string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = content.split("\n");

  let inBlockScalar = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Detect block scalars (| or >) — skip indentation checks inside them
    if (/:\s*[|>]/.test(line)) {
      inBlockScalar = true;
      continue;
    }
    if (inBlockScalar && (line.startsWith(" ") || line.startsWith("\t") || line.trim() === "")) {
      continue;
    }
    inBlockScalar = false;

    // Tab characters are not allowed in YAML
    if (line.includes("\t")) {
      errors.push(messages.tab(lineNum));
    }

    // Detect unmatched quotes (simple heuristic)
    const singleQuotes = (line.match(/'/g) ?? []).length;
    const doubleQuotes = (line.match(/"/g) ?? []).length;
    if (singleQuotes % 2 !== 0) {
      errors.push(messages.singleQuote(lineNum));
    }
    if (doubleQuotes % 2 !== 0) {
      errors.push(messages.doubleQuote(lineNum));
    }

    // Detect duplicate keys at the same indentation (simple check)
    const keyMatch = line.match(/^(\s*)(\w[\w-]*):/);
    if (keyMatch) {
      const indent = keyMatch[1].length;
      const key = keyMatch[2];
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine.trim() === "") continue;
        const nextIndent = nextLine.match(/^(\s*)/)?.[1].length ?? 0;
        if (nextIndent < indent) break;
        if (nextIndent === indent) {
          const nextKey = nextLine.match(/^(\s*)(\w[\w-]*):/)?.[2];
          if (nextKey === key) {
            errors.push(messages.duplicate(j + 1, key, lineNum));
          }
          break;
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function PlaybookEditor({
  yaml,
  onChange,
  onRunDryRun,
  readOnly = false
}: PlaybookEditorProps) {
  const { t } = useTranslation();
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [validating, setValidating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lineCount = yaml.split("\n").length;

  function handleValidate() {
    setValidating(true);
    // Small timeout so the UI updates before the (synchronous) check
    setTimeout(() => {
      const result = validateYaml(yaml, {
        tab: (line) => t("playbookEditor.errors.tab", { line }),
        singleQuote: (line) => t("playbookEditor.errors.singleQuote", { line }),
        doubleQuote: (line) => t("playbookEditor.errors.doubleQuote", { line }),
        duplicate: (line, key, firstLine) => t("playbookEditor.errors.duplicate", { line, key, firstLine })
      });
      setValidation(result);
      setValidating(false);
    }, 50);
  }

  function handleDownload() {
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playbook-${new Date().toISOString().slice(0, 10)}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Insert 2 spaces on Tab key
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newValue = yaml.slice(0, start) + "  " + yaml.slice(end);
      onChange(newValue);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        el.selectionStart = start + 2;
        el.selectionEnd = start + 2;
      });
    }
  }

  return (
    <div className="playbook-editor">
      <div className="playbook-editor-toolbar">
        <Button variant="secondary"

          type="button"
          onClick={handleValidate}
          disabled={validating || !yaml.trim()}
        >
          {validating ? <span className="spinning">↻</span> : "✓"}
          {t("playbookEditor.validate")}
        </Button>
        <Button variant="secondary"

          type="button"
          onClick={handleDownload}
          disabled={!yaml.trim()}
        >
          ⬇ {t("playbookEditor.download")}
        </Button>
        {onRunDryRun ? (
          <Button variant="primary"

            type="button"
            onClick={onRunDryRun}
            disabled={!yaml.trim()}
          >
            ⚡ {t("playbookEditor.dryRun")}
          </Button>
        ) : null}
        <span className="playbook-editor-meta">
          {t("playbookEditor.lines", { count: lineCount })}
        </span>
      </div>

      {validation ? (
        <div className={`playbook-validation ${validation.valid ? "valid" : "invalid"}`}>
          {validation.valid ? (
            <span>✓ {t("playbookEditor.valid")}</span>
          ) : (
            <ul>
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="playbook-editor-body">
        <div className="playbook-line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i + 1}>{i + 1}</span>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="playbook-textarea"
          value={yaml}
          onChange={(e) => { onChange(e.target.value); setValidation(null); }}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label={t("playbookEditor.ariaLabel")}
        />
      </div>
    </div>
  );
}
