import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  message?: string;
  page_url?: string;
};

function erro(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    },
  );
}

export async function POST(
  request: NextRequest,
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let body: Body;

    try {
      body =
        (await request.json()) as Body;
    } catch {
      return erro(
        "Corpo da requisição inválido.",
        400,
      );
    }

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const pageUrl =
      typeof body.page_url === "string"
        ? body.page_url.trim()
        : "";

    if (
      message.length < 10 ||
      message.length > 2000
    ) {
      return erro(
        "A descrição deve ter entre 10 e 2000 caracteres.",
        400,
      );
    }

    if (
      !pageUrl ||
      pageUrl.length > 1000
    ) {
      return erro(
        "Endereço da página inválido.",
        400,
      );
    }

    const admin =
      createAdminClient();

    const {
      error: insertError,
    } = await admin
      .from("error_reports")
      .insert({
        user_id:
          user?.id ?? null,
        page_url:
          pageUrl,
        message,
        user_agent:
          request.headers.get(
            "user-agent",
          ),
        status: "open",
      });

    if (insertError) {
      return erro(
        `Não foi possível salvar o relato: ${insertError.message}`,
        500,
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return erro(
      error instanceof Error
        ? error.message
        : "Erro inesperado ao enviar o relato.",
      500,
    );
  }
}
