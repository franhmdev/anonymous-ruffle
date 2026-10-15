"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ACTION_SUCCESS_EVENT } from "@/components/action-form";

type Props = {
  /** Content of the button that opens the sheet. */
  trigger: ReactNode;
  triggerLabel: string;
  triggerClassName?: string;
  title: string;
  icon?: ReactNode;
  subtitle?: string;
  children: ReactNode;
};

/** Native <dialog> styled as a mobile bottom sheet (focus trap and Esc for free). */
export function BottomSheet({
  trigger,
  triggerLabel,
  triggerClassName = "btn-icon",
  title,
  icon,
  subtitle,
  children,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Close after a successful action inside the sheet; errors keep it open.
  useEffect(() => {
    const dialog = dialogRef.current;
    const close = () => dialog?.close();
    dialog?.addEventListener(ACTION_SUCCESS_EVENT, close);
    return () => dialog?.removeEventListener(ACTION_SUCCESS_EVENT, close);
  }, []);

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        {trigger}
      </button>
      <dialog
        ref={dialogRef}
        aria-label={title}
        // Clicking the backdrop (the dialog element itself) closes it.
        onClick={(event) => event.target === dialogRef.current && dialogRef.current?.close()}
        className="m-0 mx-auto mt-auto w-full max-w-xl rounded-t-[32px] bg-surface p-0 text-foreground shadow-2xl backdrop:bg-[#0b1440]/60"
      >
        <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3">
          <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-foreground/80" />
          <div className="mb-6 text-center">
            {icon && <div className="mb-2 flex justify-center text-primary">{icon}</div>}
            <h2 className="text-2xl font-black">{title}</h2>
            {subtitle && <p className="mt-1 font-bold text-muted">{subtitle}</p>}
          </div>
          <div className="space-y-3">{children}</div>
        </div>
      </dialog>
    </>
  );
}
