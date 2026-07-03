"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buscarDadosDashboard,
  type ErroFrequente,
  type RespostaDashboard,
} from "@/lib/services/dashboard";

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

function traduzirCategoria(category: string) {
  const traducoes: Record<string, string> = {
    content: "Conteúdo",
    structure: "Estrutura",
    language: "Linguagem",
    argumentation: "Argumentação",
    adherence: "Aderência ao tema",
  };

  return traducoes[category] ?? category;
}

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");

  const [respostas, setRespostas] = useState<RespostaDashboard[]>([]);
  const [errosFrequentes, setErrosFrequentes] =
    useState<ErroFrequente[]>([]);

  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarDashboard() {
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

        setEmail(user.email ?? "");

        const { data: perfil, error: perfilError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (perfilError) {
          throw new Error(
            `Erro ao buscar perfil: ${perfilError.message}`
          );
        }

        setNome(perfil?.full_name ?? "");

        const resultado = await buscarDadosDashboard(
          supabase,
          user.id
        );

        setRespostas(resultado.respostas);
        setErrosFrequentes(resultado.errosFrequentes);
      } catch (error) {
        const mensagemErro =
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar o dashboard.";

        setMensagem(mensagemErro);
      } finally {
        setCarregando(false);
      }
    }

    carregarDashboard();
  }, [router]);

  const estatisticas = useMemo(() => {
    const totalRespostas = respostas.length;

    const respostasCorrigidas = respostas.filter(
      (resposta) => resposta.correction_id !== null
    );

    const notas = respostasCorrigidas
      .map((resposta) => resposta.total_score)
      .filter((nota): nota is number => nota !== null);

    const media =
      notas.length > 0
        ? notas.reduce((soma, nota) => soma + nota, 0) /
          notas.length
        : 0;

    const melhorNota =
      notas.length > 0 ? Math.max(...notas) : 0;

    return {
      totalRespostas,
      totalCorrigidas: respostasCorrigidas.length,
      media,
      melhorNota,
    };
  }, [respostas]);

  async function sair() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Carregando dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-6xl">
        <header className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Área do aluno
              </p>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                {nome ? `Olá, ${nome}` : "Dashboard"}
              </h1>

              <p className="mt-3 text-slate-600">
                Acompanhe suas respostas, notas e evolução.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {email}
              </p>
            </div>

            <button
              type="button"
              onClick={sair}
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700"
            >
              Sair
            </button>
          </div>
        </header>

        {mensagem && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
            {mensagem}
          </p>
        )}

        <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Respostas enviadas
            </p>

            <p className="mt-3 text-4xl font-bold text-slate-900">
              {estatisticas.totalRespostas}
            </p>
          </article>

          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Respostas corrigidas
            </p>

            <p className="mt-3 text-4xl font-bold text-slate-900">
              {estatisticas.totalCorrigidas}
            </p>
          </article>

          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Média das notas
            </p>

            <p className="mt-3 text-4xl font-bold text-blue-700">
              {estatisticas.media.toFixed(1)}
            </p>
          </article>

          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Melhor nota
            </p>

            <p className="mt-3 text-4xl font-bold text-blue-700">
              {estatisticas.melhorNota.toFixed(1)}
            </p>
          </article>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-3">
          <Link
            href="/questoes"
            className="rounded-2xl bg-blue-600 p-8 text-white shadow-sm"
          >
            <h2 className="text-2xl font-bold">
              Responder nova questão
            </h2>

            <p className="mt-3 leading-7 text-blue-100">
              Escolha uma questão e envie uma nova resposta.
            </p>

            <span className="mt-6 inline-block font-semibold">
              Ver questões →
            </span>
          </Link>

          <Link
            href="/historico"
            className="rounded-2xl bg-white p-8 shadow-sm"
          >
            <h2 className="text-2xl font-bold text-slate-900">
              Histórico
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              Consulte respostas, notas e correções anteriores.
            </p>

            <span className="mt-6 inline-block font-semibold text-blue-600">
              Abrir histórico →
            </span>
          </Link>

          <Link
            href="/erros-recorrentes"
            className="rounded-2xl bg-white p-8 shadow-sm"
          >
            <h2 className="text-2xl font-bold text-slate-900">
              Erros recorrentes
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              Veja os problemas mais frequentes nas respostas.
            </p>

            <span className="mt-6 inline-block font-semibold text-blue-600">
              Ver análise →
            </span>
          </Link>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Principais erros
              </h2>

              <p className="mt-2 text-slate-600">
                Problemas mais frequentes nas correções.
              </p>
            </div>

            <Link
              href="/erros-recorrentes"
              className="font-semibold text-blue-600"
            >
              Ver análise completa
            </Link>
          </div>

          {errosFrequentes.length === 0 ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-6">
              <p className="text-slate-600">
                Ainda não há erros recorrentes registrados.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {errosFrequentes.map((erro, indice) => (
                <article
                  key={erro.id}
                  className="rounded-xl border border-slate-200 p-6"
                >
                  <p className="text-sm font-semibold text-blue-600">
                    #{indice + 1}
                  </p>

                  <h3 className="mt-2 text-lg font-bold text-slate-900">
                    {erro.name}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    {traduzirCategoria(erro.category)}
                  </p>

                  <p className="mt-5 text-3xl font-bold text-slate-900">
                    {erro.quantidade}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {erro.quantidade === 1
                      ? "ocorrência"
                      : "ocorrências"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Respostas recentes
              </h2>

              <p className="mt-2 text-slate-600">
                Suas últimas atividades na plataforma.
              </p>
            </div>

            <Link
              href="/historico"
              className="font-semibold text-blue-600"
            >
              Ver todas
            </Link>
          </div>

          {respostas.length === 0 ? (
            <div className="mt-8 rounded-xl bg-slate-50 p-6">
              <p className="text-slate-600">
                Você ainda não enviou nenhuma resposta.
              </p>
            </div>
          ) : (
            <div className="mt-8 divide-y divide-slate-200">
              {respostas.slice(0, 5).map((resposta) => (
                <article
                  key={resposta.id}
                  className="flex flex-wrap items-center justify-between gap-5 py-5 first:pt-0 last:pb-0"
                >
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {resposta.question_title}
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      {formatarData(
                        resposta.submitted_at ??
                          resposta.created_at
                      )}
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      Status:{" "}
                      <span className="font-semibold">
                        {traduzirStatus(resposta.status)}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-5">
                    {resposta.correction_id !== null ? (
                      <div className="text-right">
                        <p className="text-xs font-medium uppercase text-slate-500">
                          Nota
                        </p>

                        <p className="text-2xl font-bold text-blue-700">
                          {Number(
                            resposta.total_score ?? 0
                          ).toFixed(1)}
                        </p>
                      </div>
                    ) : (
                      <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                        Sem correção
                      </span>
                    )}

                    <Link
                      href={`/respostas/${resposta.id}`}
                      className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                    >
                      Abrir
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}