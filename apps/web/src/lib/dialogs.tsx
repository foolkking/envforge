/**
 * dialogs.tsx — in-app toast / confirm / prompt, replacing native
 * window.alert/confirm/prompt (which are jarring, unstyled, and were
 * partly hardcoded in English).
 *
 * Imperative API so call sites stay a near-drop-in for the natives:
 *   toast(msg, "error")
 *   if (await confirmDialog({ message, danger: true })) { ... }
 *   const reason = await promptDialog({ message, defaultValue });
 *
 * Mount <DialogHost/> once at the app root. Before it mounts (or in tests)
 * the functions fall back to the native dialogs so nothing breaks.
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useEscapeToClose } from "./useEscapeToClose";

export type ToastType = "info" | "success" | "error";

export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}
export interface PromptOptions {
  message: string;
  title?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface HostApi {
  toast: (message: string, type: ToastType) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

let hostApi: HostApi | null = null;

export function toast(message: string, type: ToastType = "info"): void {
  hostApi?.toast(message, type);
  if (!hostApi && typeof window !== "undefined") window.alert(message);
}

export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === "string" ? { message: opts } : opts;
  if (hostApi) return hostApi.confirm(o);
  return Promise.resolve(typeof window !== "undefined" ? window.confirm(o.message) : false);
}

export function promptDialog(opts: PromptOptions | string): Promise<string | null> {
  const o = typeof opts === "string" ? { message: opts } : opts;
  if (hostApi) return hostApi.prompt(o);
  return Promise.resolve(typeof window !== "undefined" ? window.prompt(o.message, o.defaultValue) : null);
}

interface ToastItem { id: number; message: string; type: ToastType; }

/** Default OK/Cancel labels follow the saved UI locale so dialogs aren't English-only. */
function localeLabels(): { ok: string; cancel: string } {
  let zh = false;
  try { zh = localStorage.getItem("envforge_locale") === "zh"; } catch { /* ignore */ }
  return zh ? { ok: "确定", cancel: "取消" } : { ok: "OK", cancel: "Cancel" };
}

export function DialogHost(): JSX.Element | null {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const [promptState, setPromptState] = useState<{ opts: PromptOptions; resolve: (v: string | null) => void } | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    hostApi = {
      toast: (message, type) => {
        const id = (seq.current += 1);
        setToasts((list) => [...list, { id, message, type }]);
        window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4500);
      },
      confirm: (opts) => new Promise<boolean>((resolve) => setConfirmState({ opts, resolve })),
      prompt: (opts) => new Promise<string | null>((resolve) => { setPromptValue(opts.defaultValue ?? ""); setPromptState({ opts, resolve }); })
    };
    return () => { hostApi = null; };
  }, []);

  function resolveConfirm(value: boolean) {
    confirmState?.resolve(value);
    setConfirmState(null);
  }
  function resolvePrompt(value: string | null) {
    promptState?.resolve(value);
    setPromptState(null);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {toasts.length > 0 ? (
        <div className="ef-toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`ef-toast ef-toast-${t.type}`} data-testid="ef-toast">
              {t.type === "success" ? <CheckCircle2 size={16} aria-hidden /> : t.type === "error" ? <AlertTriangle size={16} aria-hidden /> : <Info size={16} aria-hidden />}
              <span>{t.message}</span>
              <button type="button" className="ef-toast-close" aria-label="Dismiss" onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}><X size={14} aria-hidden /></button>
            </div>
          ))}
        </div>
      ) : null}

      {confirmState ? <ConfirmModal opts={confirmState.opts} onResolve={resolveConfirm} /> : null}

      {promptState ? (
        <PromptModal
          opts={promptState.opts}
          value={promptValue}
          onChange={setPromptValue}
          onResolve={resolvePrompt}
        />
      ) : null}
    </>,
    document.body
  );
}

function ConfirmModal({ opts, onResolve }: { opts: ConfirmOptions; onResolve: (v: boolean) => void }): JSX.Element {
  useEscapeToClose(() => onResolve(false));
  const labels = localeLabels();
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onResolve(false); }}>
      <section className="profile-modal ef-dialog" style={{ maxWidth: 440 }}>
        <header>
          <div>
            <p className="eyebrow">{opts.title ?? "Confirm"}</p>
          </div>
          <button type="button" className="ghost-action icon-action" aria-label={labels.cancel} onClick={() => onResolve(false)}><X aria-hidden /></button>
        </header>
        <div className="ef-dialog-body">
          <p>{opts.message}</p>
        </div>
        <footer className="ef-dialog-footer">
          <button type="button" className="ghost-action" onClick={() => onResolve(false)}>{opts.cancelLabel ?? labels.cancel}</button>
          <button type="button" className={opts.danger ? "primary-action ef-danger-action" : "primary-action"} onClick={() => onResolve(true)} autoFocus>{opts.confirmLabel ?? labels.ok}</button>
        </footer>
      </section>
    </div>
  );
}

function PromptModal({ opts, value, onChange, onResolve }: { opts: PromptOptions; value: string; onChange: (v: string) => void; onResolve: (v: string | null) => void }): JSX.Element {
  useEscapeToClose(() => onResolve(null));
  const labels = localeLabels();
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onResolve(null); }}>
      <section className="profile-modal ef-dialog" style={{ maxWidth: 460 }}>
        <header>
          <div>
            <p className="eyebrow">{opts.title ?? "Input"}</p>
          </div>
          <button type="button" className="ghost-action icon-action" aria-label={labels.cancel} onClick={() => onResolve(null)}><X aria-hidden /></button>
        </header>
        <form
          className="ef-dialog-body"
          onSubmit={(e) => { e.preventDefault(); onResolve(value); }}
        >
          <label>
            <span>{opts.message}</span>
            <input autoFocus value={value} placeholder={opts.placeholder} onChange={(e) => onChange(e.target.value)} />
          </label>
          <footer className="ef-dialog-footer">
            <button type="button" className="ghost-action" onClick={() => onResolve(null)}>{opts.cancelLabel ?? labels.cancel}</button>
            <button type="submit" className="primary-action">{opts.confirmLabel ?? labels.ok}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
