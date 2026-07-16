"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  FileCheck2,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { createClient } from "@/lib/supabase/client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

type RespostaBanco = {
  id: number;
  question_id: number;
  submitted_at: string | null;
  created_at: string;
};

type CorrecaoBanco = {
  answer_id: number;
  total_score: number | null;
  content_score: number | null;
  content_maximum_score: number | null;
  calculation_details: unknown;
  created_at: string;
};

type QuestaoBanco = {
  id: number;
  title: string | null;
  exam_name: string | null;
  examining_board: string | null;
  exam_year: number | null;
};

type DesempenhoItem = {
  answerId: number;
  questionId: number;
  title: string;
  examiningBoard: string;
  examYear: number | null;
  score: number;
  date: string;
  dateLabel: string;
  orderLabel: string;
};

const chartConfig = {
  nota: {
    label: "Nota",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

function limitarNota(valor: number) {
  if (!Number.isFinite(valor)) {
    return 0;
  }

  return Math.min(10, Math.max(0, valor));
}

function formatarNota(valor: number) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

function possuiCalculoFinal(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const detalhes = value as Record<string, unknown>;
  const notaFinal = Number(detalhes.final_score);

  return Number.isFinite(notaFinal);
}


function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(data));
}

export default function DesempenhoPage() {
  const router = useRouter();

  const [itens, setItens] = useState<DesempenhoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarDesempenho() {
      setCarregando(true);
      setErro("");

      try {
        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!componenteAtivo) {
          return;
        }

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const {
          data: respostasData,
          error: respostasError,
        } = await supabase
          .from("user_answers")
          .select(`
            id,
            question_id,
            submitted_at,
            created_at
          `)
          .eq("user_id", user.id)
          .order("submitted_at", { ascending: true });

        if (respostasError) {
          throw new Error(
            `Não foi possível buscar suas respostas: ${respostasError.message}`,
          );
        }

        const respostas = (respostasData ?? []) as RespostaBanco[];

        if (respostas.length === 0) {
          if (componenteAtivo) {
            setItens([]);
          }

          return;
        }

        const answerIds = respostas.map((resposta) => resposta.id);
        const questionIds = Array.from(
          new Set(respostas.map((resposta) => resposta.question_id)),
        );

        const [
          { data: correcoesData, error: correcoesError },
          { data: questoesData, error: questoesError },
        ] = await Promise.all([
          supabase
            .from("corrections")
            .select(`
              answer_id,
              total_score,
              content_score,
              content_maximum_score,
              calculation_details,
              created_at
            `)
            .in("answer_id", answerIds),

          supabase
            .from("questions")
            .select(`
              id,
              title,
              exam_name,
              examining_board,
              exam_year
            `)
            .in("id", questionIds),
        ]);

        if (correcoesError) {
          throw new Error(
            `Não foi possível buscar as correções: ${correcoesError.message}`,
          );
        }

        if (questoesError) {
          throw new Error(
            `Não foi possível buscar as questões: ${questoesError.message}`,
          );
        }

        const correcoes = (correcoesData ?? []) as CorrecaoBanco[];
        const questoes = (questoesData ?? []) as QuestaoBanco[];

        const respostaPorId = new Map(
          respostas.map((resposta) => [resposta.id, resposta]),
        );

        const questaoPorId = new Map(
          questoes.map((questao) => [questao.id, questao]),
        );

        const resultados = correcoes
          .map((correcao) => {
            const resposta = respostaPorId.get(correcao.answer_id);

            if (!resposta) {
              return null;
            }

            const questao = questaoPorId.get(resposta.question_id);

            /*
             * Exibe somente correções que chegaram à etapa final.
             * Isso evita registrar nota 0 para respostas que ainda
             * estão em processamento.
             */
            if (!possuiCalculoFinal(correcao.calculation_details)) {
              return null;
            }

            const notaOriginal = Number(
              correcao.total_score,
            );

            if (!Number.isFinite(notaOriginal)) {
              return null;
            }

            const nota = limitarNota(notaOriginal);

            const data =
              correcao.created_at ||
              resposta.submitted_at ||
              resposta.created_at;

            return {
              answerId: resposta.id,
              questionId: resposta.question_id,
              title:
                questao?.title?.trim() ||
                questao?.exam_name?.trim() ||
                `Questão ${resposta.question_id}`,
              examiningBoard:
                questao?.examining_board?.trim() || "Banca não informada",
              examYear: questao?.exam_year ?? null,
              score: nota,
              date: data,
              dateLabel: formatarData(data),
              orderLabel: "",
            } satisfies DesempenhoItem;
          })
          .filter(
            (item): item is DesempenhoItem => item !== null,
          )
          .sort(
            (a, b) =>
              new Date(a.date).getTime() -
              new Date(b.date).getTime(),
          )
          .map((item, index) => ({
            ...item,
            orderLabel: `${index + 1}ª`,
          }));

        if (componenteAtivo) {
          setItens(resultados);
        }
      } catch (errorCarregamento) {
        if (componenteAtivo) {
          setErro(
            errorCarregamento instanceof Error
              ? errorCarregamento.message
              : "Não foi possível carregar seu desempenho.",
          );
        }
      } finally {
        if (componenteAtivo) {
          setCarregando(false);
        }
      }
    }

    void carregarDesempenho();

    return () => {
      componenteAtivo = false;
    };
  }, [router]);

  const media = useMemo(() => {
    if (itens.length === 0) {
      return 0;
    }

    const soma = itens.reduce(
      (total, item) => total + item.score,
      0,
    );

    return soma / itens.length;
  }, [itens]);

  const melhorNota = useMemo(() => {
    if (itens.length === 0) {
      return 0;
    }

    return Math.max(...itens.map((item) => item.score));
  }, [itens]);

  const ultimaNota = itens.at(-1)?.score ?? 0;

  const dadosGrafico = useMemo(
    () =>
      itens.map((item, index) => ({
        tentativa: item.orderLabel,
        nota: item.score,
        data: item.dateLabel,
        questao: item.title,
        banca: item.examiningBoard,
        destaque:
          item.score === melhorNota
            ? "Melhor nota"
            : index === itens.length - 1
              ? "Última nota"
              : null,
      })),
    [itens, melhorNota],
  );

  const ultimasCorrecoes = useMemo(
    () => [...itens].reverse().slice(0, 5),
    [itens],
  );

  if (carregando) {
    return <DesempenhoSkeleton />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ChartNoAxesCombined className="size-5 text-muted-foreground" />

            <h1 className="text-2xl font-semibold tracking-tight">
              Desempenho
            </h1>
          </div>

          <p className="max-w-2xl text-sm text-muted-foreground">
            Acompanhe a evolução das suas notas nas questões corrigidas.
          </p>
        </div>

        <Badge variant="secondary" className="w-fit">
          Notas de 0 a 10
        </Badge>
      </header>

      {erro && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar o desempenho</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {itens.length === 0 ? (
        <EstadoVazio />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              titulo="Média geral"
              valor={formatarNota(media)}
              complemento="/ 10"
              icon={<Target className="size-4" />}
            />

            <Indicador
              titulo="Melhor nota"
              valor={formatarNota(melhorNota)}
              complemento="/ 10"
              icon={<Award className="size-4" />}
            />

            <Indicador
              titulo="Última nota"
              valor={formatarNota(ultimaNota)}
              complemento="/ 10"
              icon={<TrendingUp className="size-4" />}
            />

            <Indicador
              titulo="Correções"
              valor={String(itens.length)}
              complemento={
                itens.length === 1 ? "resposta" : "respostas"
              }
              icon={<FileCheck2 className="size-4" />}
            />
          </section>

          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">
                    Evolução das notas
                  </CardTitle>

                  <CardDescription>
                    Resultados apresentados em ordem cronológica.
                  </CardDescription>
                </div>

                <Badge variant="outline">
                  Média: {formatarNota(media)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="rounded-xl border bg-linear-to-b from-primary/4 to-transparent p-3 sm:p-5">
                <ChartContainer
                  config={chartConfig}
                  className="h-90 w-full"
                >
                  <AreaChart
                    accessibilityLayer
                    data={dadosGrafico}
                    margin={{
                      top: 18,
                      right: 18,
                      left: 0,
                      bottom: 4,
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="preenchimentoNota"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--color-nota)"
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="55%"
                          stopColor="var(--color-nota)"
                          stopOpacity={0.10}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--color-nota)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 6"
                      strokeOpacity={0.55}
                    />

                    <XAxis
                      dataKey="tentativa"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      minTickGap={18}
                    />

                    <YAxis
                      domain={[0, 10]}
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                    />

                    <ReferenceLine
                      y={media}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="6 6"
                      strokeOpacity={0.65}
                      label={{
                        value: `Média ${formatarNota(media)}`,
                        position: "insideTopRight",
                        fill: "var(--muted-foreground)",
                        fontSize: 12,
                      }}
                    />

                    <ChartTooltip
                      cursor={{
                        stroke: "var(--color-nota)",
                        strokeWidth: 1,
                        strokeDasharray: "4 4",
                        strokeOpacity: 0.55,
                      }}
                      content={
                        <ChartTooltipContent
                          className="min-w-60"
                          labelFormatter={(_, payload) => {
                            const item = payload?.[0]?.payload as
                              | {
                                  tentativa?: string;
                                  data?: string;
                                }
                              | undefined;

                            if (!item) {
                              return "";
                            }

                            return `${item.tentativa} correção · ${item.data}`;
                          }}
                          formatter={(value, _, item) => {
                            const dados = item.payload as
                              | {
                                  questao?: string;
                                  banca?: string;
                                  destaque?: string | null;
                                }
                              | undefined;

                            return (
                              <div className="w-full space-y-2">
                                <div className="flex items-center justify-between gap-6">
                                  <span className="text-muted-foreground">
                                    Nota
                                  </span>

                                  <strong className="text-base">
                                    {formatarNota(Number(value))} / 10
                                  </strong>
                                </div>

                                {dados?.questao && (
                                  <p className="max-w-56 text-xs leading-5 text-muted-foreground">
                                    {dados.questao}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center gap-2">
                                  {dados?.banca && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px]"
                                    >
                                      {dados.banca}
                                    </Badge>
                                  )}

                                  {dados?.destaque && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px]"
                                    >
                                      {dados.destaque}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          }}
                        />
                      }
                    />

                    <Area
                      dataKey="nota"
                      type="monotone"
                      stroke="var(--color-nota)"
                      strokeWidth={3}
                      fill="url(#preenchimentoNota)"
                      fillOpacity={1}
                      dot={{
                        r: 3.5,
                        fill: "var(--background)",
                        stroke: "var(--color-nota)",
                        strokeWidth: 2.5,
                      }}
                      activeDot={{
                        r: 6,
                        fill: "var(--background)",
                        stroke: "var(--color-nota)",
                        strokeWidth: 3,
                      }}
                      animationDuration={900}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>

              <div className="mt-4 flex flex-col gap-1 text-center text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-center sm:gap-4">
                <span>
                  Passe o cursor sobre os pontos para ver os detalhes.
                </span>

                <span className="hidden sm:inline">•</span>

                <span>
                  A linha tracejada representa sua média atual.
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">
                Correções recentes
              </CardTitle>

              <CardDescription>
                Seus cinco resultados mais recentes.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y">
                {ultimasCorrecoes.map((item) => (
                  <article
                    key={item.answerId}
                    className="flex flex-col gap-4 p-5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium">
                        {item.title}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{item.examiningBoard}</span>

                        {item.examYear && (
                          <span>{item.examYear}</span>
                        )}

                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3.5" />
                          {item.dateLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right">
                        <strong className="text-xl font-semibold">
                          {formatarNota(item.score)}
                        </strong>

                        <span className="ml-1 text-sm text-muted-foreground">
                          / 10
                        </span>
                      </div>

                      <Link
                        href={`/respostas/${item.answerId}`}
                        className="inline-flex size-9 items-center justify-center rounded-md border bg-background transition-colors hover:bg-accent"
                        aria-label="Abrir correção"
                      >
                        <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

type IndicadorProps = {
  titulo: string;
  valor: string;
  complemento: string;
  icon: React.ReactNode;
};

function Indicador({
  titulo,
  valor,
  complemento,
  icon,
}: IndicadorProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {titulo}
          </span>

          <div className="flex size-8 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground">
            {icon}
          </div>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <strong className="text-3xl font-semibold tracking-tight">
            {valor}
          </strong>

          <span className="text-sm text-muted-foreground">
            {complemento}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EstadoVazio() {
  return (
    <div className="rounded-lg border border-dashed bg-background px-6 py-16 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-muted/30">
        <BarChart3 className="size-5 text-muted-foreground" />
      </div>

      <h2 className="mt-4 font-semibold">
        Ainda não há notas para exibir
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Resolva uma questão e conclua a correção para começar a acompanhar
        sua evolução.
      </p>

      <Link
        href="/questoes"
        className="mt-6 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <BookOpen className="size-4" />
        Escolher uma questão
      </Link>
    </div>
  );
}

function DesempenhoSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b pb-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Card key={item}>
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>

        <CardContent className="pt-6">
          <Skeleton className="h-85 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}