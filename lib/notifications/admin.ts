type MentorModerationEmailParams = {
  userId: string;
  userEmail: string | null;
  message: string;
  category: string;
  reason: string;
  confidence: number;
  eventId: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendMentorModerationEmail(
  params: MentorModerationEmailParams,
) {
  const apiKey =
    process.env.RESEND_API_KEY;

  const adminEmail =
    process.env.ADMIN_ALERT_EMAIL;

  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Simples Aprova.AI <no-reply@simplesaprova.com.br>";

  if (!apiKey || !adminEmail) {
    console.warn(
      "Alerta do Mentor não enviado: RESEND_API_KEY ou ADMIN_ALERT_EMAIL não configurado.",
    );
    return false;
  }

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [adminEmail],
        subject:
          "Alerta de mensagem fora do escopo — Mentor IA",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
            <h2>Mensagem bloqueada no Mentor IA</h2>
            <p><strong>Usuário:</strong> ${escapeHtml(params.userEmail ?? params.userId)}</p>
            <p><strong>Categoria:</strong> ${escapeHtml(params.category)}</p>
            <p><strong>Confiança:</strong> ${(params.confidence * 100).toFixed(0)}%</p>
            <p><strong>Motivo:</strong> ${escapeHtml(params.reason)}</p>
            <p><strong>Mensagem:</strong></p>
            <blockquote style="margin:0;padding:12px 16px;border-left:4px solid #4f46e5;background:#f3f4f6">
              ${escapeHtml(params.message)}
            </blockquote>
            ${
              params.eventId
                ? `<p><strong>ID do registro:</strong> ${escapeHtml(params.eventId)}</p>`
                : ""
            }
          </div>
        `.trim(),
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();

    console.error(
      "Erro ao enviar alerta pelo Resend:",
      response.status,
      body,
    );

    return false;
  }

  return true;
}
