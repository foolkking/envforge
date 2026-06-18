import { useEffect } from "react";

/**
 * Close a modal/overlay when the user presses Escape — the conventional,
 * expected affordance that every dialog in the app was missing. Attach in any
 * overlay component: `useEscapeToClose(onClose)`.
 *
 * `enabled` lets callers suppress dismissal while a blocking operation is in
 * flight (e.g. a submit), mirroring the existing backdrop-click guards.
 */
export function useEscapeToClose(onClose: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, enabled]);
}
