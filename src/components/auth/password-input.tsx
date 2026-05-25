"use client";

import { useCallback, useEffect, useId, useRef } from "react";

/**
 * Password input with a show/hide toggle that uses native DOM events,
 * not React state.
 *
 * Why bypass React state:
 *   - Previous versions toggled `type` via useState. That depends on React
 *     having hydrated the component before the user clicks. On the first
 *     click after page load, hydration sometimes hasn't completed yet and
 *     the click is dropped entirely.
 *   - Password-manager extensions (Bitwarden, 1Password, LastPass) inject
 *     their own overlay icon into the input's right edge. If the toggle
 *     button is positioned in that same corner, the overlay swallows the
 *     React synthetic click before React sees it.
 *
 * This implementation:
 *   - Uses a ref callback to attach a NATIVE `pointerdown` listener with
 *     `{ capture: true }`, so we fire before the password manager's
 *     handlers even if they sit on top of us in the DOM.
 *   - Mutates `input.type` and the button icon directly. No render needed.
 *   - Positions the button OUTSIDE the input's right-edge "danger zone"
 *     where password-manager icons live — we add right-padding to the
 *     input and place the button inside that padded area, but with a
 *     stacking context that puts it above everything.
 *   - Inlines the eye SVGs so we don't depend on lucide-react having
 *     hydrated either.
 */

interface Props {
  name: string;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
  required?: boolean;
}

export function PasswordInput({
  name,
  placeholder,
  autoComplete,
  minLength = 8,
  required = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const eyeRef = useRef<SVGSVGElement | null>(null);
  const eyeOffRef = useRef<SVGSVGElement | null>(null);

  const reactId = useId();
  const inputId = `${name}-${reactId}`;

  const setVisible = useCallback((visible: boolean) => {
    const input = inputRef.current;
    const button = buttonRef.current;
    const eye = eyeRef.current;
    const eyeOff = eyeOffRef.current;
    if (!input || !button) return;

    input.type = visible ? "text" : "password";
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.setAttribute(
      "aria-label",
      visible ? "Hide password" : "Show password"
    );
    if (eye) eye.style.display = visible ? "none" : "block";
    if (eyeOff) eyeOff.style.display = visible ? "block" : "none";
  }, []);

  // Wire up a native, capture-phase pointerdown listener. Native + capture
  // means we get the event before any extension overlay or React handler.
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const onDown = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const input = inputRef.current;
      const currentlyVisible = input?.type === "text";
      setVisible(!currentlyVisible);
      // Keep focus where the user was typing.
      input?.focus({ preventScroll: true });
    };

    button.addEventListener("pointerdown", onDown, { capture: true });
    button.addEventListener("mousedown", onDown, { capture: true });
    button.addEventListener("touchstart", onDown, {
      capture: true,
      passive: false,
    });

    return () => {
      button.removeEventListener("pointerdown", onDown, { capture: true });
      button.removeEventListener("mousedown", onDown, { capture: true });
      button.removeEventListener("touchstart", onDown, { capture: true });
    };
  }, [setVisible]);

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700"
      >
        Password <span className="text-rose-500">*</span>
      </label>

      <div
        className="relative isolate"
        // The input gets pr-14 to reserve space for the toggle button.
      >
        <input
          ref={inputRef}
          id={inputId}
          type="password"
          name={name}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          // data-1p / data-lp / data-bw hints: ask password managers to
          // ignore the button area when overlaying their icon.
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-14 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition"
        />

        <button
          ref={buttonRef}
          type="button"
          aria-label="Show password"
          aria-pressed="false"
          aria-controls={inputId}
          tabIndex={0}
          // Inline style is intentional — gives the button a guaranteed
          // high stacking context that no extension stylesheet can win
          // against without !important.
          style={{ zIndex: 50 }}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition cursor-pointer"
        >
          {/* Eye (password hidden) */}
          <svg
            ref={eyeRef}
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ display: "block", pointerEvents: "none" }}
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {/* Eye-off (password visible) */}
          <svg
            ref={eyeOffRef}
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ display: "none", pointerEvents: "none" }}
          >
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        </button>
      </div>
    </div>
  );
}
