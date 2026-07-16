import { createAdminClient } from "@/lib/supabase/admin";

import {
  obterLimitesCorrecao,
  type CorrectionPlanLimits,
} from "@/lib/correction/plans";

type SubscriptionRow = {
  plan: string | null;
  status: string | null;
};

type UsageRow = {
  used_corrections: number | null;
  completed_corrections: number | null;
};

type ReservationRow = {
  allowed: boolean;
  used: number;
  remaining: number;
  reservation_status: string;
};

type RefundRow = {
  refunded: boolean;
  used: number;
};

type CompletionRow = {
  completed: boolean;
  used: number;
};

export function obterInicioMesBrasil() {
  const partes = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  )
    .format(new Date())
    .split("-");

  return `${partes[0]}-${partes[1]}-01`;
}

export function obterInicioMesDaDataBrasil(
  value: string | Date,
) {
  const data =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(data.getTime())) {
    return obterInicioMesBrasil();
  }

  const partes = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  )
    .format(data)
    .split("-");

  return `${partes[0]}-${partes[1]}-01`;
}

export async function buscarLimitesCorrecaoDoUsuario(
  userId: string,
): Promise<CorrectionPlanLimits> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("subscriptions")
    .select(`
      plan,
      status
    `)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível verificar o plano: ${error.message}`,
    );
  }

  const assinatura =
    data as SubscriptionRow | null;

  const planoAtivo =
    assinatura?.status === "active"
      ? assinatura.plan
      : "free";

  return obterLimitesCorrecao(planoAtivo);
}

export async function consultarUsoMensal(
  userId: string,
) {
  const admin = createAdminClient();
  const periodStart = obterInicioMesBrasil();

  const { data, error } = await admin
    .from("correction_monthly_usage")
    .select(`
      used_corrections,
      completed_corrections
    `)
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível consultar o uso mensal: ${error.message}`,
    );
  }

  const uso = data as UsageRow | null;

  return {
    periodStart,
    usedCorrections: Number(
      uso?.used_corrections ?? 0,
    ),
    completedCorrections: Number(
      uso?.completed_corrections ?? 0,
    ),
  };
}

export async function reservarCorrecaoMensal(
  userId: string,
  monthlyLimit: number,
  id: number,
  periodStart = obterInicioMesBrasil(),
) {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc(
    "reserve_correction_credit",
    {
      p_user_id: userId,
      p_period_start: periodStart,
      p_monthly_limit: monthlyLimit,
      p_answer_id: id,
    },
  );

  if (error) {
    throw new Error(
      `Não foi possível reservar a correção: ${error.message}`,
    );
  }

  const reserva =
    (
      Array.isArray(data)
        ? data[0]
        : null
    ) as ReservationRow | null;

  if (!reserva) {
    throw new Error(
      "O banco não retornou o resultado da reserva.",
    );
  }

  return {
    allowed: Boolean(reserva.allowed),
    used: Number(reserva.used ?? 0),
    remaining: Number(
      reserva.remaining ?? 0,
    ),
    reservationStatus:
      reserva.reservation_status,
    periodStart,
  };
}

export async function devolverCorrecaoMensal(
  userId: string,
  periodStart: string,
  id: number,
  failureReason?: string,
) {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc(
    "refund_correction_credit",
    {
      p_user_id: userId,
      p_period_start: periodStart,
      p_answer_id: id,
      p_failure_reason:
        failureReason?.slice(0, 1000) ?? null,
    },
  );

  if (error) {
    console.error(
      "Não foi possível devolver a correção mensal:",
      error.message,
    );

    return {
      refunded: false,
      used: 0,
    };
  }

  const resultado =
    (
      Array.isArray(data)
        ? data[0]
        : null
    ) as RefundRow | null;

  return {
    refunded: Boolean(resultado?.refunded),
    used: Number(resultado?.used ?? 0),
  };
}

export async function registrarCorrecaoConcluida(
  userId: string,
  periodStart: string,
  id: number,
) {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc(
    "complete_correction_credit",
    {
      p_user_id: userId,
      p_period_start: periodStart,
      p_id: id,
    },
  );

  if (error) {
    throw new Error(
      `Não foi possível registrar a conclusão mensal: ${error.message}`,
    );
  }

  const resultado =
    (
      Array.isArray(data)
        ? data[0]
        : null
    ) as CompletionRow | null;

  if (!resultado?.completed) {
    throw new Error(
      "A reserva da correção não pôde ser confirmada.",
    );
  }

  return {
    completed: true,
    used: Number(resultado.used ?? 0),
  };
}
