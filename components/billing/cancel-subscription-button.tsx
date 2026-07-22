"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CancelSubscriptionButtonProps = {
  currentPeriodEnd?: string | null;
  alreadyCanceled?: boolean;
};

type CancelResponse = {
  success?: boolean;
  alreadyCanceled?: boolean;
  currentPeriodEnd?: string | null;
  error?: string;
};

function formatarData(
  value?: string | null,
) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(date);
}

export function CancelSubscriptionButton({
  currentPeriodEnd,
  alreadyCanceled = false,
}: CancelSubscriptionButtonProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] = useState("");
  const [canceled, setCanceled] =
    useState(alreadyCanceled);

  const formattedPeriodEnd =
    formatarData(currentPeriodEnd);

  async function handleCancel() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/billing/cancel",
        {
          method: "POST",
        },
      );

      const result =
        (await response.json()) as CancelResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Não foi possível cancelar a assinatura.",
        );
      }

      setCanceled(true);
      setOpen(false);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível cancelar a assinatura.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (canceled) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Sua assinatura já foi cancelada.
        {formattedPeriodEnd
          ? ` Você continuará com acesso até ${formattedPeriodEnd}.`
          : " Você continuará com acesso até o fim do período já pago."}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="inline-flex w-full items-center justify-center rounded-2xl border border-red-300 bg-white px-5 py-3.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/40"
      >
        Cancelar assinatura
      </button>

      {open && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-subscription-title"
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <h2
              id="cancel-subscription-title"
              className="text-xl font-bold text-slate-950 dark:text-white"
            >
              Cancelar assinatura?
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Novas cobranças serão interrompidas.
              {formattedPeriodEnd
                ? ` Seu plano continuará ativo até ${formattedPeriodEnd}.`
                : " Seu plano continuará ativo até o fim do período já pago."}
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
              >
                {error}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Manter assinatura
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Cancelando..."
                  : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}