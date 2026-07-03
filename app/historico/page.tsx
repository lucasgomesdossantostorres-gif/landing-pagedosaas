"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buscarHistoricoDoUsuario,
  type RespostaHistorico,
} from "@/lib/services/history";

function formatarData(data: string | null) {
  if (!data) {
    return "Data não informada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

function traduzirStatus(status: string) {
  const traducoes: Record<string, string> = {
    draft: "Rascunho",
    submitted: "Enviada",
    processing: "Em correção",
    corrected: "Corrigida",
    failed: "Falha na correção",
  };

  return traducoes[status] ?? status;
}

function obterClasseStatus(status: string) {
  const classes: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    submitted: "bg-amber-50 text-amber-800",
    processing: "bg-blue-50 text-blue-700",
    corrected: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
  };

  return classes[status] ?? "bg-slate-100 text-slate-700";
}

export default function HistoricoPage() {
  const router = useRouter();

  const [respostas, setRespostas] = useState<RespostaHistorico[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarHistorico() {
      try {
        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        const historico = await buscarHistoricoDoUsuario(
          supabase,
          user.id
        );

        setRespostas(historico);
      } catch (error) {
        const mensagemErro =
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar o histórico.";

        setMensagem(mensagemErro);
      } finally {
        setCarregando(false);
      }
    }

    carregarHistorico();
  }, [router]);

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Carregando histórico...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap gap-5">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-blue-600"
          >
            Voltar ao dashboard
          </Link>

          <Link
            href="/questoes"
            className="text-sm font-semibold text-blue-600"
          >
            Ver questões
          </Link>
        </div>

        <header className="mt-6 rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Suas atividades
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Histórico de respostas
          </h1>

          <p className="mt-3 text-slate-600">
            Consulte as respostas enviadas, o andamento das correções e
            as notas recebidas.
          </p>
        </header>

        {mensagem && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
            {mensagem}
          </p>
        )}

        {respostas.length === 0 ? (
          <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              Nenhuma resposta encontrada
            </h2>

            <p className="mt-3 text-slate-600">
              Você ainda não enviou nenhuma resposta discursiva.
            </p>

            <Link
              href="/questoes"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
            >
              Responder uma questão
            </Link>
          </section>
        ) : (
          <section className="mt-8 space-y-5">
            {respostas.map((resposta) => (
              <article
                key={resposta.id}
                className="rounded-2xl bg-white p-7 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap gap-2 text-sm text-slate-500">
                      {resposta.subject && (
                        <span>{resposta.subject}</span>
                      )}

                      {resposta.examining_board && (
                        <span>• {resposta.examining_board}</span>
                      )}
                    </div>

                    <h2 className="mt-3 text-xl font-bold text-slate-900">
                      {resposta.question_title}
                    </h2>

                    <p className="mt-3 text-sm text-slate-500">
                      Enviada em{" "}
                      {formatarData(
                        resposta.submitted_at ??
                          resposta.created_at
                      )}
                    </p>

                    <span
                      className={`mt-4 inline-block rounded-full px-3 py-1 text-sm font-semibold ${obterClasseStatus(
                        resposta.status
                      )}`}
                    >
                      {traduzirStatus(resposta.status)}
                    </span>
                  </div>

                  <div className="text-right">
                    {resposta.correction_id !== null ? (
                      <>
                        <p className="text-sm text-slate-500">
                          Nota
                        </p>

                        <p className="mt-1 text-3xl font-bold text-blue-700">
                          {Number(
                            resposta.total_score ?? 0
                          ).toFixed(1)}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          de{" "}
                          {Number(
                            resposta.maximum_score
                          ).toFixed(1)}
                        </p>
                      </>
                    ) : (
                      <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                        Sem correção
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <Link
                    href={`/respostas/${resposta.id}`}
                    className="inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
                  >
                    {resposta.correction_id !== null
                      ? "Ver correção"
                      : resposta.status === "failed"
                        ? "Tentar novamente"
                        : "Abrir resposta"}
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}