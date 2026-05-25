"use client";

import { useState, useCallback } from "react";

export function useCopy(timeout = 1500) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), timeout);
      } catch (err) {
        console.error("Copy failed", err);
      }
    },
    [timeout]
  );

  return { copy, copied };
}
