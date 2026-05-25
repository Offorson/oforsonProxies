"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
      <div className="glass rounded-3xl p-8 shadow-soft">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-ink-600">{subtitle}</p>}
        </div>
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-ink-600">{footer}</div>}
      </div>
    </motion.div>
  );
}
