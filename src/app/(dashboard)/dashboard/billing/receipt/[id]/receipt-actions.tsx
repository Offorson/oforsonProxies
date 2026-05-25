"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Receipt action bar — kept in its own client component so the receipt
 * page itself can stay a server component. Sits OUTSIDE the `.print-area`
 * wrapper so it never shows up on a printed / saved-to-PDF receipt.
 */
export function ReceiptActions() {
  const router = useRouter();
  return (
    <div className="no-print mb-6 flex items-center justify-between gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/dashboard/billing#invoices")}
      >
        <ArrowLeft className="h-4 w-4" /> Back to billing
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print / Save as PDF
      </Button>
    </div>
  );
}
