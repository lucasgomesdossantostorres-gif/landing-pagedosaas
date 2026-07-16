"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FileText,
  LogOut,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  buscarDadosDashboard,
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

function classesStatus(status: string) {
  const classes: Record<string, string> = {
    draft:
      "border-slate-200 bg-slate-50 text-slate-700",
    submitted:
      "border-amber-200 bg-amber-50 text-amber-800",
    processing:
      "border-blue-200 bg-blue-50 text-blue-700",
    corrected:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    failed:
      "border-red-200 bg-red-50 text-red-700",
  };

  return (
    classes[status] ??
    "border-slate-200 bg-slate-50 text-slate-700"
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [respostas, setRespostas] = useState<RespostaDashboard[]>([]);
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

        const nomeMetadados =
          typeof user.user_metadata?.full_name ===
          "string"
            ? user.user_metadata.full_name.trim()
            : typeof user.user_metadata?.name ===
                "string"
              ? user.user_metadata.name.trim()
              : "";

        const {
          data: perfil,
          error: perfilError,
        } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (perfilError) {
          console.warn(
            `Não foi possível buscar o perfil público: ${perfilError.message}`,
          );
        }

        const nomePerfil =
          typeof perfil?.full_name === "string"
            ? perfil.full_name.trim()
            : "";

        /*
         * O nome salvo no Supabase Auth tem prioridade.
         * A tabela profiles funciona apenas como fallback
         * para contas antigas.
         */
        setNome(
          nomeMetadados ||
            nomePerfil ||
            "",
        );

        const resultado = await buscarDadosDashboard(
          supabase,
          user.id,
        );

        setRespostas(resultado.respostas);
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

    void carregarDashboard();
  }, [router]);

  const estatisticas = useMemo(() => {
    const totalRespostas = respostas.length;

    const respostasCorrigidas = respostas.filter(
      (resposta) => resposta.correction_id !== null,
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
      <main className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

          <p className="text-sm text-slate-500">
            Carregando sua área...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-6xl space-y-7">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-sm md:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-blue-100/70 blur-3xl"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-32 top-0 size-32 rounded-full bg-cyan-100/60 blur-3xl"
          />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-800">
                  Área do aluno
                </span>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                {nome ? `Olá, ${nome}` : "Seu painel"}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Acompanhe suas respostas, notas e evolução em um único
                lugar.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {email}
              </p>
            </div>

            <button
              type="button"
              onClick={sair}
              className="
                inline-flex items-center justify-center gap-2
                rounded-md
                border border-slate-300
                bg-white
                px-4 py-2.5
                text-sm font-semibold text-slate-700
                shadow-sm
                transition
                hover:border-slate-400
                hover:bg-slate-50
                hover:text-slate-950
                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-blue-500
                focus-visible:ring-offset-2
              "
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </div>
        </header>

        {mensagem && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              {mensagem}
            </p>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <IndicadorCard
            titulo="Respostas enviadas"
            valor={String(estatisticas.totalRespostas)}
            icon={<FileText className="size-5" />}
          />

          <IndicadorCard
            titulo="Respostas corrigidas"
            valor={String(estatisticas.totalCorrigidas)}
            icon={<CheckCircle2 className="size-5" />}
          />

          <IndicadorCard
            titulo="Média das notas"
            valor={estatisticas.media.toFixed(1)}
            icon={<TrendingUp className="size-5" />}
            destaque
          />

          <IndicadorCard
            titulo="Melhor nota"
            valor={estatisticas.melhorNota.toFixed(1)}
            icon={<Award className="size-5" />}
            destaque
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Link
            href="/questoes"
            className="
              group relative overflow-hidden
              rounded-2xl
              bg-slate-950
              p-7 text-white
              shadow-sm
              transition
              duration-200
              hover:-translate-y-0.5
              hover:shadow-lg
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-blue-500
              focus-visible:ring-offset-2
            "
          >
            <div
              aria-hidden="true"
              className="absolute -right-8 -top-10 size-48 rounded-full bg-blue-500/20 blur-3xl"
            />

            <div
              aria-hidden="true"
              className="absolute bottom-0 right-24 size-28 rounded-full bg-cyan-400/10 blur-2xl"
            />

            <div className="relative">
              <div className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                <BookOpen className="size-5 text-cyan-300" />
              </div>

              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                Nova prática
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Responder nova questão
              </h2>

              <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
                Escolha uma questão discursiva e receba uma correção
                detalhada.
              </p>

              <span
                className="
                  mt-7
                  inline-flex items-center justify-center gap-2
                  rounded-md
                  bg-blue-600
                  px-5 py-3
                  font-semibold text-white
                  shadow-sm
                  transition
                  group-hover:bg-blue-500
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-blue-400
                  focus-visible:ring-offset-2
                "
              >
                Ver questões
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>

          <Link
            href="/historico"
            className="
              group rounded-2xl
              border border-slate-200
              bg-white
              p-7
              shadow-sm
              transition
              duration-200
              hover:-translate-y-0.5
              hover:border-blue-200
              hover:shadow-md
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-blue-500
              focus-visible:ring-offset-2
            "
          >
            <div className="flex size-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
              <BarChart3 className="size-5" />
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Acompanhamento
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Minhas respostas
            </h2>

            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Consulte suas respostas, notas e correções anteriores.
            </p>

            <span
              className="
                mt-7
                inline-flex items-center justify-center gap-2
                rounded-md
                bg-blue-600
                px-5 py-3
                font-semibold text-white
                shadow-sm
                transition
                group-hover:bg-blue-700
                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-blue-500
                focus-visible:ring-offset-2
              "
            >
              Abrir minhas respostas
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Respostas recentes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Suas últimas atividades na plataforma.
              </p>
            </div>

            <Link
              href="/historico"
              className="
                inline-flex items-center gap-2
                text-sm font-semibold text-blue-700
                transition
                hover:text-blue-900
                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-blue-500
                focus-visible:ring-offset-2
              "
            >
              Ver todas
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {respostas.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                <FileText className="size-5 text-slate-400" />
              </div>

              <h3 className="mt-4 font-semibold text-slate-900">
                Nenhuma resposta enviada
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Sua atividade aparecerá aqui depois da primeira resposta.
              </p>

              <Link
                href="/questoes"
                className="
                  mt-5
                  inline-flex items-center justify-center gap-2
                  rounded-md
                  bg-blue-600
                  px-5 py-3
                  font-semibold text-white
                  shadow-sm
                  transition
                  hover:bg-blue-700
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-blue-500
                  focus-visible:ring-offset-2
                "
              >
                Escolher uma questão
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {respostas.slice(0, 5).map((resposta) => (
                <article
                  key={resposta.id}
                  className="flex flex-col gap-5 px-6 py-5 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-950">
                      {resposta.question_title}
                    </h3>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span>
                        {formatarData(
                          resposta.submitted_at ??
                            resposta.created_at,
                        )}
                      </span>

                      <span aria-hidden="true">•</span>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classesStatus(
                          resposta.status,
                        )}`}
                      >
                        {traduzirStatus(resposta.status)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-5 sm:justify-end">
                    {resposta.correction_id !== null ? (
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Nota
                        </p>

                        <p className="mt-1 text-2xl font-semibold tracking-tight text-blue-700">
                          {Number(
                            resposta.total_score ?? 0,
                          ).toFixed(1)}
                        </p>
                      </div>
                    ) : (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                        Sem correção
                      </span>
                    )}

                    <Link
                      href={`/respostas/${resposta.id}`}
                      className="
                        inline-flex items-center justify-center
                        rounded-md
                        bg-blue-600
                        px-5 py-3
                        font-semibold text-white
                        shadow-sm
                        transition
                        hover:bg-blue-700
                        focus-visible:outline-none
                        focus-visible:ring-2
                        focus-visible:ring-blue-500
                        focus-visible:ring-offset-2
                      "
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

type IndicadorCardProps = {
  titulo: string;
  valor: string;
  icon: React.ReactNode;
  destaque?: boolean;
};

function IndicadorCard({
  titulo,
  valor,
  icon,
  destaque = false,
}: IndicadorCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {titulo}
          </p>

          <p
            className={`mt-3 text-3xl font-semibold tracking-tight ${
              destaque ? "text-blue-700" : "text-slate-950"
            }`}
          >
            {valor}
          </p>
        </div>

        <div
          className={`flex size-10 items-center justify-center rounded-xl ${
            destaque
              ? "bg-blue-50 text-blue-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}