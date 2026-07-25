import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CheckoutForm } from "@/components/billing/checkout-form";

export default function CheckoutProPage() {
  return (
    <div className="relative">
      <Link
        href="/planos"
        aria-label="Voltar para os planos"
        className="fixed left-4 top-4 z-50 inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:bg-slate-800 dark:hover:text-indigo-300 sm:left-6 sm:top-6"
      >
        <ArrowLeft className="size-5" />
      </Link>

      <CheckoutForm plan="pro" />
    </div>
  );
}