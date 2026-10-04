"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";

type Tone = "danger" | "default";

export type ConfirmAsk = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
};

export type ConfirmNotice = {
  title: string;
  body?: string;
  confirmLabel?: string;
  tone?: Tone;
};

type Pending =
  | { mode: "ask"; spec: Required<Pick<ConfirmAsk, "title" | "confirmLabel" | "cancelLabel" | "tone">> & { body?: string }; resolve: (ok: boolean) => void }
  | { mode: "notice"; spec: Required<Pick<ConfirmNotice, "title" | "confirmLabel" | "tone">> & { body?: string }; resolve: (ok: boolean) => void };

type ConfirmApi = {
  ask: (spec: ConfirmAsk) => Promise<boolean>;
  notice: (spec: ConfirmNotice) => Promise<void>;
};

const ConfirmCtx = createContext<ConfirmApi | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm necesita ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const queue = useRef<Pending[]>([]);

  const enqueue = useCallback((item: Pending) => {
    if (pendingRef.current) {
      queue.current.push(item);
      return;
    }
    pendingRef.current = item;
    setPending(item);
  }, []);

  const ask = useCallback(
    (spec: ConfirmAsk) =>
      new Promise<boolean>((resolve) => {
        enqueue({
          mode: "ask",
          resolve,
          spec: {
            title: spec.title,
            body: spec.body,
            confirmLabel: spec.confirmLabel ?? "Continuar",
            cancelLabel: spec.cancelLabel ?? "Cancelar",
            tone: spec.tone ?? "danger",
          },
        });
      }),
    [enqueue],
  );

  const notice = useCallback(
    async (spec: ConfirmNotice) => {
      await new Promise<boolean>((resolve) => {
        enqueue({
          mode: "notice",
          resolve,
          spec: {
            title: spec.title,
            body: spec.body,
            confirmLabel: spec.confirmLabel ?? "Entendido",
            tone: spec.tone ?? "default",
          },
        });
      });
    },
    [enqueue],
  );

  const close = useCallback((ok: boolean) => {
    pendingRef.current?.resolve(ok);
    const next = queue.current.shift() ?? null;
    pendingRef.current = next;
    setPending(next);
  }, []);

  return (
    <ConfirmCtx.Provider value={{ ask, notice }}>
      {children}
      {pending ? <ConfirmCard pending={pending} onClose={close} /> : null}
    </ConfirmCtx.Provider>
  );
}

function ConfirmCard({ pending, onClose }: { pending: Pending; onClose: (ok: boolean) => void }) {
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const danger = pending.spec.tone === "danger";

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focus = danger ? cardRef.current?.querySelector<HTMLButtonElement>("[data-cancel]") : cardRef.current?.querySelector<HTMLButtonElement>("[data-ok]");
    focus?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [danger, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="app-modal-back" onClick={() => onClose(false)}>
      <div
        ref={cardRef}
        className={`app-modal${danger ? " is-danger" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={pending.spec.body ? bodyId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="app-modal-ico" aria-hidden>
          <Icon name={danger ? "close" : "check-circle"} />
        </span>
        <div className="app-modal-copy">
          <h2 id={titleId}>{pending.spec.title}</h2>
          {pending.spec.body ? <p id={bodyId}>{pending.spec.body}</p> : null}
        </div>
        <div className="app-modal-actions">
          {pending.mode === "ask" ? (
            <button type="button" className="btn ghost" data-cancel onClick={() => onClose(false)}>
              {pending.spec.cancelLabel}
            </button>
          ) : null}
          <button type="button" className={`btn${danger ? " danger" : ""}`} data-ok onClick={() => onClose(true)}>
            {pending.spec.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
