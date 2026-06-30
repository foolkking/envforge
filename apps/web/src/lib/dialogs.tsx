import { Button } from "../components/ui/Button";
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
import { useTranslation } from "react-i18next";
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

export function DialogHost(): JSX.Element | null {
  const { t } = useTranslation();
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
          {toasts.map((toastItem) => (
            <div key={toastItem.id} className={`ef-toast ef-toast-${toastItem.type}`} data-testid="ef-toast">
              {toastItem.type === "success" ? <CheckCircle2 size={16} aria-hidden /> : toastItem.type === "error" ? <AlertTriangle size={16} aria-hidden /> : <Info size={16} aria-hidden />}
              <span>{toastItem.message}</span>
              <button type="button" className="ef-toast-close" aria-label={t("dialogs.dismiss")} onClick={() => setToasts((list) => list.filter((x) => x.id !== toastItem.id))}><X size={14} aria-hidden /></button>
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
  const { t } = useTranslation();
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onResolve(false); }}>
      <section className="profile-modal ef-dialog" style={{ maxWidth: 440 }}>
        <header>
          <div>
            <p className="eyebrow">{opts.title ?? t("dialogs.confirm")}</p>
          </div>
          <Button variant="ghost" type="button" className="icon-action" aria-label={t("dialogs.cancel")} onClick={() => onResolve(false)}><X aria-hidden /></Button>
        </header>
        <div className="ef-dialog-body">
          <p>{opts.message}</p>
        </div>
        <footer className="ef-dialog-footer">
          <Button variant="ghost" type="button"  onClick={() => onResolve(false)}>{opts.cancelLabel ?? t("dialogs.cancel")}</Button>
          <Button variant={opts.danger ? "destructive" : "primary"} type="button" onClick={() => onResolve(true)} autoFocus>{opts.confirmLabel ?? t("dialogs.ok")}</Button>
        </footer>
      </section>
    </div>
  );
}

function PromptModal({ opts, value, onChange, onResolve }: { opts: PromptOptions; value: string; onChange: (v: string) => void; onResolve: (v: string | null) => void }): JSX.Element {
  useEscapeToClose(() => onResolve(null));
  const { t } = useTranslation();
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onResolve(null); }}>
      <section className="profile-modal ef-dialog" style={{ maxWidth: 460 }}>
        <header>
          <div>
            <p className="eyebrow">{opts.title ?? t("dialogs.input")}</p>
          </div>
          <Button variant="ghost" type="button" className="icon-action" aria-label={t("dialogs.cancel")} onClick={() => onResolve(null)}><X aria-hidden /></Button>
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
            <Button variant="ghost" type="button"  onClick={() => onResolve(null)}>{opts.cancelLabel ?? t("dialogs.cancel")}</Button>
            <Button variant="primary" type="submit" >{opts.confirmLabel ?? t("dialogs.ok")}</Button>
          </footer>
        </form>
      </section>
    </div>
  );
}
