"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Languages,
  Lightbulb,
  LoaderCircle,
  Play,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type RespostaBanco = {
  id: number;
  user_id: string;
  question_id: number;
  selected_question: number | null;
  answer_text: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
};

type QuestaoBanco = {
  id: number;
  title: string | null;
  statement: string | null;
  reference_answer: string | null;
  examining_board: string | null;
  exam_name: string | null;
  exam_year: number | null;
  maximum_score: number | null;
};

type CorrecaoCriteriaFeedback = {
  criterion: string;
  status: "atendeu" | "atendeu_parcialmente" | "nao_atendeu" | string;
  evaluation: string;
};

type CorrecaoBanco = {
  id: number;
  answer_id: number;
  total_score: number | null;
  summary_feedback: string | null;
  strengths: string | null;
  weaknesses: string | null;
  improvement_suggestions: string | null;
  improved_answer: string | null;
  validation_status: string | null;
  validation_feedback: string | null;
  validation_confidence: number | null;
  content_score: number | null;
  content_maximum_score: number | null;
  content_feedback: string | null;
  criteria_feedback?: CorrecaoCriteriaFeedback[] | null;
  language_error_count: number | null;
  effective_line_count: number | null;
  language_discount: number | null;
  language_feedback: string | null;
  calculation_details: unknown;
  model_used: string | null;
  prompt_version: string | null;
  processing_time_ms: number | null;
  created_at: string;
};

type ErroLinguagemBanco = {
  id: number;
  correction_id: number;
  criterion_code: string;
  criterion_name: string;
  excerpt: string;
  explanation: string;
  suggested_correction: string | null;
  occurrence_order: number;
};

type RespostaResultadoAPI = {
  success: boolean;
  answer?: RespostaBanco;
  question?: QuestaoBanco;
  correction?: CorrecaoBanco | null;
  language_errors?: ErroLinguagemBanco[];
  error?: string;
};

type LimitesCorrecao = {
  success: boolean;
  plan?: "free" | "essential" | "pro";
  plan_name?: string;
  monthly_limit?: number;
  used_this_month?: number;
  remaining_this_month?: number;
  period_start?: string;
  error?: string;
};

type CalculoDetalhes = {
  content_score?: number;
  content_maximum_score?: number;
  language_error_count?: number;
  fixed_penalty_per_error?: number;
  language_discount?: number;
  raw_final_score?: number;
  final_score?: number;
  question_maximum_score?: number;
  formula?: string;
};

function formatarData(data: string | null) {
  if (!data) {
    return "Data não informada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

function formatarNumero(
  valor: number | null | undefined,
  casas = 2,
) {
  return Number(valor ?? 0).toFixed(casas);
}

function normalizarCalculo(
  value: unknown,
): CalculoDetalhes {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as CalculoDetalhes;
}

function textoParaLista(
  value: string | null | undefined,
) {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split("\n")
    .map((item) =>
      item
        .replace(/^[•\-–—]\s*/, "")
        .trim(),
    )
    .filter(Boolean);
}

function traduzirStatus(status: string) {
  const traducoes: Record<string, string> = {
    draft: "Rascunho",
    submitted: "Aguardando correção",
    processing: "Correção em andamento",
    correcting: "Correção em andamento",
    corrected: "Correção concluída",
    failed: "Falha na correção",
  };

  return traducoes[status] ?? status;
}

const MENSAGENS_PROCESSAMENTO = [
  "Analisando sua resposta...",
  "Comparando com o gabarito oficial...",
  "Estamos avançando na correção...",
  "Organizando seu feedback...",
  "Está quase lá...",
  "Finalizando esta etapa...",
] as const;

export default function RespostaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const respostaId = Number(params.id);

  const [resposta, setResposta] =
    useState<RespostaBanco | null>(null);

  const [questao, setQuestao] =
    useState<QuestaoBanco | null>(null);

  const [correcao, setCorrecao] =
    useState<CorrecaoBanco | null>(null);

  const [errosLinguagem, setErrosLinguagem] =
    useState<ErroLinguagemBanco[]>([]);

  const [carregando, setCarregando] =
    useState(true);

  const [executandoNivel2, setExecutandoNivel2] =
    useState(false);

  const [executandoNivel3, setExecutandoNivel3] =
    useState(false);

  const [executandoNivel4, setExecutandoNivel4] =
    useState(false);

  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [limitesCorrecao, setLimitesCorrecao] =
    useState<LimitesCorrecao | null>(null);

  const carregarDados = useCallback(async () => {
    if (
      !Number.isInteger(respostaId) ||
      respostaId <= 0
    ) {
      setErro("Identificador da resposta inválido.");
      setCarregando(false);
      return;
    }

    try {
      setErro("");

      const response = await fetch(
        `/api/respostas/${respostaId}/resultado`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const resultado =
        (await response.json()) as RespostaResultadoAPI;

      if (
        response.status === 401
      ) {
        router.replace("/login");
        return;
      }

      if (
        !response.ok ||
        resultado.success !== true ||
        !resultado.answer ||
        !resultado.question
      ) {
        throw new Error(
          resultado.error ??
            "Não foi possível carregar o resultado.",
        );
      }

      setResposta(resultado.answer);
      setQuestao(resultado.question);
      setCorrecao(resultado.correction ?? null);
      setErrosLinguagem(
        resultado.language_errors ?? [],
      );
    } catch (errorCarregamento) {
      setErro(
        errorCarregamento instanceof Error
          ? errorCarregamento.message
          : "Erro desconhecido ao carregar o resultado.",
      );
    } finally {
      setCarregando(false);
    }
  }, [respostaId, router]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    async function carregarLimites() {
      try {
        const response = await fetch(
          "/api/correcoes/limites",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const resultado =
          (await response.json()) as LimitesCorrecao;

        if (
          response.ok &&
          resultado.success === true
        ) {
          setLimitesCorrecao(resultado);
        }
      } catch {
        /*
         * O resultado da correção continua acessível mesmo
         * se a consulta de limites falhar.
         */
      }
    }

    void carregarLimites();
  }, []);

  const calculo = useMemo(
    () =>
      normalizarCalculo(
        correcao?.calculation_details,
      ),
    [correcao],
  );

  const pontosFortes = useMemo(
    () => textoParaLista(correcao?.strengths),
    [correcao?.strengths],
  );

  const prioridadesMelhoria = useMemo(
    () => textoParaLista(correcao?.weaknesses),
    [correcao?.weaknesses],
  );

  /*
   * Cada etapa só é considerada concluída quando os campos
   * específicos dela realmente foram preenchidos.
   *
   * Não verificamos apenas language_error_count porque essa
   * coluna pode ter valor padrão 0 antes da análise linguística.
   */
  const nivel2Concluido = Boolean(
    correcao?.content_feedback?.trim() &&
      correcao.content_score !== null &&
      correcao.content_score !== undefined,
  );

  const nivel3Concluido = Boolean(
    correcao?.language_feedback?.trim() &&
      correcao.language_error_count !== null &&
      correcao.language_error_count !== undefined &&
      correcao.language_discount !== null &&
      correcao.language_discount !== undefined,
  );

  const nivel4Concluido = Boolean(
    correcao?.total_score !== null &&
      correcao?.total_score !== undefined &&
      typeof calculo.final_score === "number" &&
      Number.isFinite(calculo.final_score),
  );

  const numeroQuestaoSelecionada =
    resposta?.selected_question ?? 1;

  const notaMaxima = Number(
    correcao?.content_maximum_score ??
      questao?.maximum_score ??
      0,
  );

  const notaExibida = Number(
    nivel4Concluido
      ? correcao?.total_score ??
          calculo.final_score ??
          0
      : correcao?.content_score ?? 0,
  );

  const percentual =
    notaMaxima > 0
      ? Math.min(
          Math.max(
            (notaExibida / notaMaxima) * 100,
            0,
          ),
          100,
        )
      : 0;

  async function executarEtapa(paramsExecucao: {
    endpoint: string;
    iniciar: (value: boolean) => void;
    mensagemSucesso: string;
  }) {
    if (!resposta) {
      return;
    }

    try {
      paramsExecucao.iniciar(true);
      setMensagem("");
      setErro("");

      const response = await fetch(
        paramsExecucao.endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answer_id: resposta.id,
          }),
        },
      );

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(
          resultado.error ??
            "Não foi possível executar esta etapa.",
        );
      }

      setMensagem(
        resultado.cached
          ? "O resultado já existia e foi carregado."
          : paramsExecucao.mensagemSucesso,
      );

      await carregarDados();
    } catch (errorExecucao) {
      setErro(
        errorExecucao instanceof Error
          ? errorExecucao.message
          : "Erro ao executar a correção.",
      );
    } finally {
      paramsExecucao.iniciar(false);
    }
  }

  if (carregando) {
    return <ResultadoSkeleton />;
  }

  if (!resposta || !questao) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>
            Não foi possível abrir a resposta
          </AlertTitle>
          <AlertDescription>
            {erro || "Resposta não encontrada."}
          </AlertDescription>
        </Alert>

        <Link
          href="/historico"
          className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
          Voltar ao histórico
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4 border-b pb-6">
        <Link
          href="/questoes"
          className="-ml-2 inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
          Voltar para as questões
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {questao.examining_board && (
                <Badge variant="secondary">
                  {questao.examining_board}
                </Badge>
              )}

              {questao.exam_year && (
                <Badge variant="outline">
                  {questao.exam_year}
                </Badge>
              )}

              <Badge variant="outline">
                {traduzirStatus(resposta.status)}
              </Badge>
              <Badge variant="secondary">
  Questão {numeroQuestaoSelecionada}
</Badge>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
  {questao.title ||
    questao.exam_name ||
    "Resultado da correção"}
  <span className="text-muted-foreground">
    {" — "}Questão {numeroQuestaoSelecionada}
  </span>
</h1>

              {questao.exam_name && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {questao.exam_name}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <p className="text-sm text-muted-foreground">
              Enviada em{" "}
              {formatarData(
                resposta.submitted_at ??
                  resposta.created_at,
              )}
            </p>

            {limitesCorrecao?.plan === "free" && (
              <Link
                href="/#planos"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Ver planos
              </Link>
            )}

            {limitesCorrecao?.plan === "essential" && (
              <Link
                href="/#planos"
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Fazer upgrade
              </Link>
            )}
          </div>
        </div>
      </header>

      {mensagem && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="size-4 text-emerald-700" />
          <AlertTitle>Etapa concluída</AlertTitle>
          <AlertDescription>
            {mensagem}
          </AlertDescription>
        </Alert>
      )}

      {erro && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Ocorreu um problema</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {!nivel4Concluido && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">
              Etapas da correção
            </CardTitle>

            <CardDescription>
              Execute as análises na ordem indicada.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
            <EtapaCorrecao
              numero="1"
              titulo="Conteúdo"
              descricao="Compara a resposta com o gabarito oficial."
              concluida={nivel2Concluido}
              carregando={executandoNivel2}
              desabilitada={false}
              onClick={() =>
                executarEtapa({
                  endpoint: "/api/corrigir/nivel-2",
                  iniciar: setExecutandoNivel2,
                  mensagemSucesso:
                    "A correção de conteúdo foi concluída.",
                })
              }
            />

            <EtapaCorrecao
              numero="2"
              titulo="Linguagem"
              descricao="Identifica ocorrências linguísticas."
              concluida={nivel3Concluido}
              carregando={executandoNivel3}
              desabilitada={!nivel2Concluido}
              onClick={() =>
                executarEtapa({
                  endpoint: "/api/corrigir/nivel-3",
                  iniciar: setExecutandoNivel3,
                  mensagemSucesso:
                    "A análise linguística foi concluída.",
                })
              }
            />

            <EtapaCorrecao
              numero="3"
              titulo="Nota final"
              descricao="Aplica o cálculo determinístico."
              concluida={nivel4Concluido}
              carregando={executandoNivel4}
              desabilitada={!nivel3Concluido}
              onClick={() =>
                executarEtapa({
                  endpoint: "/api/corrigir/nivel-4",
                  iniciar: setExecutandoNivel4,
                  mensagemSucesso:
                    "A nota final foi calculada.",
                })
              }
            />
          </CardContent>
        </Card>
      )}

      {nivel2Concluido && correcao ? (
        <>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid lg:grid-cols-[1fr_280px]">
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <FileCheck2 className="size-4" />
                    {nivel4Concluido
                      ? "Resultado final"
                      : "Resultado parcial"}
                  </div>

                  <h2 className="mt-3 text-2xl font-semibold">
                    Avaliação da resposta
                  </h2>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                    A nota é uma estimativa educacional baseada no
                    enunciado e no gabarito oficial.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center border-t bg-muted/30 p-6 text-center lg:border-l lg:border-t-0">
                  <span className="text-sm text-muted-foreground">
                    {nivel4Concluido
                      ? "Nota final"
                      : "Nota de conteúdo"}
                  </span>

                  <strong className="mt-1 text-5xl font-semibold tracking-tight">
                    {formatarNumero(notaExibida)}
                  </strong>

                  <span className="mt-1 text-sm text-muted-foreground">
                    de {formatarNumero(notaMaxima)}
                  </span>

                  <Badge
                    variant="secondary"
                    className="mt-4"
                  >
                    {percentual.toFixed(1)}% de aproveitamento
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="correcao">
            <TabsList className="h-auto w-full justify-start overflow-x-auto">
              <TabsTrigger value="correcao">
                <Sparkles className="size-4" />
                Correção
              </TabsTrigger>

              <TabsTrigger value="linguagem">
                <Languages className="size-4" />
                Linguagem
              </TabsTrigger>

              <TabsTrigger value="gabarito">
                <BookOpen className="size-4" />
                Gabarito
              </TabsTrigger>

              <TabsTrigger value="resposta">
                <FileText className="size-4" />
                Resposta
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="correcao"
              className="space-y-6 pt-4"
            >
              <Card>
                <CardHeader className="border-b">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
                      <Target className="size-4" />
                    </div>

                    <div>
                      <CardTitle className="text-base">
                        Explicação da correção
                      </CardTitle>

                      <CardDescription>
                        Análise única da nota, sem repetir os mesmos
                        pontos em blocos diferentes.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  <p className="whitespace-pre-wrap text-[15px] leading-7">
                    {correcao.content_feedback}
                  </p>
                </CardContent>
              </Card>
{correcao.criteria_feedback &&
  correcao.criteria_feedback.length > 0 && (
    <section className="rounded-2xl border bg-white">
      <div className="border-b px-6 py-5">
        <h2 className="font-semibold text-slate-900">
          Avaliação por critério
        </h2>

        <p className="text-sm text-slate-500">
          Análise individual das exigências do enunciado.
        </p>
      </div>

      <div className="space-y-4 p-6">
        {correcao.criteria_feedback.map(
          (item, index) => (
            <div
              key={`${item.criterion}-${index}`}
              className="rounded-xl border p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-4">
                <h3 className="font-medium text-slate-900">
                  {item.criterion}
                </h3>

                <span className="rounded-full border px-3 py-1 text-xs font-medium">
                  {item.status === "atendeu" &&
                    "Atendeu"}

                  {item.status ===
                    "atendeu_parcialmente" &&
                    "Atendeu parcialmente"}

                  {item.status ===
                    "nao_atendeu" &&
                    "Não atendeu"}
                </span>
              </div>

              <p className="text-sm leading-6 text-slate-700">
                {item.evaluation}
              </p>
            </div>
          ),
        )}
      </div>
    </section>
  )}
              <div className="grid gap-6 lg:grid-cols-2">
                <ListaFeedback
                  titulo="Pontos fortes"
                  descricao="Aspectos mais bem desenvolvidos na resposta."
                  itens={pontosFortes}
                  icon={<Trophy className="size-4" />}
                  vazio="Nenhum ponto forte específico foi registrado."
                />

                <ListaFeedback
                  titulo="Prioridades de melhoria"
                  descricao="Pontos mais importantes para a próxima resposta."
                  itens={prioridadesMelhoria}
                  icon={<Lightbulb className="size-4" />}
                  vazio="Nenhuma prioridade específica foi registrada."
                />
              </div>

              {nivel4Concluido && (
                <Card>
                  <CardHeader className="border-b">
                    <CardTitle className="text-base">
                      Cálculo da nota
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
                    <Indicador
                      titulo="Conteúdo"
                      valor={`${formatarNumero(
                        correcao.content_score,
                      )} / ${formatarNumero(
                        correcao.content_maximum_score,
                      )}`}
                    />

                    <Indicador
                      titulo="Erros linguísticos"
                      valor={String(
                        correcao.language_error_count ?? 0,
                      )}
                    />

                    <Indicador
                      titulo="Desconto"
                      valor={`-${formatarNumero(
                        correcao.language_discount,
                      )}`}
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent
              value="linguagem"
              className="space-y-6 pt-4"
            >
              {!nivel3Concluido ? (
                <EstadoPendente
                  titulo="Análise linguística pendente"
                  descricao="Execute o Nível 3 para identificar as ocorrências linguísticas."
                />
              ) : (
                <>
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle className="text-base">
                        Avaliação linguística
                      </CardTitle>

                      <CardDescription>
                        {correcao.language_error_count ?? 0} ocorrências
                        identificadas, com desconto total de{" "}
                        {formatarNumero(
                          correcao.language_discount,
                        )}.
                      </CardDescription>
                    </CardHeader>

                    {correcao.language_feedback && (
                      <CardContent className="pt-6">
                        <p className="whitespace-pre-wrap text-sm leading-7">
                          {correcao.language_feedback}
                        </p>
                      </CardContent>
                    )}
                  </Card>

                  {errosLinguagem.length === 0 ? (
                    <EstadoPendente
                      titulo="Nenhuma ocorrência registrada"
                      descricao="A análise não identificou erros linguísticos válidos."
                    />
                  ) : (
                    <div className="space-y-4">
                      {errosLinguagem.map(
                        (item, index) => (
                          <Card key={item.id}>
                            <CardHeader className="border-b">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <CardTitle className="text-base">
                                    {item.criterion_name}
                                  </CardTitle>

                                  <CardDescription>
                                    Ocorrência {index + 1}
                                  </CardDescription>
                                </div>

                                <Badge variant="outline">
                                  {item.criterion_code}
                                </Badge>
                              </div>
                            </CardHeader>

                            <CardContent className="space-y-4 pt-6">
                              <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Trecho
                                </h3>

                                <blockquote className="mt-2 border-l-2 pl-4 text-sm italic">
                                  “{item.excerpt}”
                                </blockquote>
                              </div>

                              <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Explicação
                                </h3>

                                <p className="mt-2 text-sm leading-6">
                                  {item.explanation}
                                </p>
                              </div>

                              {item.suggested_correction && (
                                <div>
                                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Forma sugerida
                                  </h3>

                                  <p className="mt-2 rounded-md border bg-muted/30 p-3 text-sm">
                                    {item.suggested_correction}
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ),
                      )}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent
              value="gabarito"
              className="pt-4"
            >
              <Card>
                <CardHeader className="border-b">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
                      <ShieldCheck className="size-4" />
                    </div>

                    <div>
                      <CardTitle className="text-base">
                        Gabarito oficial
                      </CardTitle>

                      <CardDescription>
                        Texto original armazenado no banco. Este conteúdo
                        não foi produzido nem reescrito pela IA.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  {questao.reference_answer ? (
                    <p className="whitespace-pre-wrap text-[15px] leading-7">
                      {questao.reference_answer}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      O gabarito será liberado após a conclusão da
                      correção de conteúdo.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="resposta"
              className="space-y-6 pt-4"
            >
              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="text-base">
                    Enunciado
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-6">
                  <p className="whitespace-pre-wrap text-sm leading-7">
                    {questao.statement}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="text-base">
                    Resposta enviada
                  </CardTitle>

                  <CardDescription>
                    Texto original, sem alterações.
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-6">
                  <p className="whitespace-pre-wrap text-[15px] leading-7">
                    {resposta.answer_text}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <EstadoPendente
          titulo="A correção ainda não foi iniciada"
          descricao="Execute o Nível 2 para receber a nota, o feedback e acessar o gabarito oficial."
        />
      )}
    </div>
  );
}

type EtapaCorrecaoProps = {
  numero: string;
  titulo: string;
  descricao: string;
  concluida: boolean;
  carregando: boolean;
  desabilitada: boolean;
  onClick: () => void;
};

function EtapaCorrecao({
  numero,
  titulo,
  descricao,
  concluida,
  carregando,
  desabilitada,
  onClick,
}: EtapaCorrecaoProps) {
  const [indiceMensagem, setIndiceMensagem] =
    useState(0);

  useEffect(() => {
    if (!carregando) {
      setIndiceMensagem(0);
      return;
    }

    const intervalo = window.setInterval(() => {
      setIndiceMensagem((indiceAtual) =>
        Math.min(
          indiceAtual + 1,
          MENSAGENS_PROCESSAMENTO.length - 1,
        ),
      );
    }, 15000);

    return () => {
      window.clearInterval(intervalo);
    };
  }, [carregando]);

  const mensagemProcessamento =
    MENSAGENS_PROCESSAMENTO[indiceMensagem];

  return (
    <div
      className={
        carregando
          ? "rounded-lg border border-primary/30 bg-primary/2 p-4"
          : "rounded-lg border p-4"
      }
      aria-busy={carregando}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-sm font-semibold">
          {concluida ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : carregando ? (
            <LoaderCircle className="size-4 animate-spin text-primary" />
          ) : (
            numero
          )}
        </div>

        <div className="min-w-0">
          <h3 className="font-medium">{titulo}</h3>

          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {carregando
              ? mensagemProcessamento
              : descricao}
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant={concluida ? "outline" : "default"}
        size="sm"
        className="mt-4 w-full"
        disabled={carregando || desabilitada}
        onClick={onClick}
      >
        {carregando ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            {mensagemProcessamento}
          </>
        ) : concluida ? (
          <>
            <RotateCw className="size-4" />
            Recarregar
          </>
        ) : (
          <>
            <Play className="size-4" />
            Executar
          </>
        )}
      </Button>
    </div>
  );
}

type ListaFeedbackProps = {
  titulo: string;
  descricao: string;
  itens: string[];
  icon: React.ReactNode;
  vazio: string;
};

function ListaFeedback({
  titulo,
  descricao,
  itens,
  icon,
  vazio,
}: ListaFeedbackProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
            {icon}
          </div>

          <div>
            <CardTitle className="text-base">
              {titulo}
            </CardTitle>

            <CardDescription>
              {descricao}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {vazio}
          </p>
        ) : (
          <ul className="space-y-3">
            {itens.map((item, index) => (
              <li
                key={`${index}-${item}`}
                className="flex gap-3 text-sm leading-6"
              >
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Indicador(props: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        {props.titulo}
      </p>

      <p className="mt-2 text-2xl font-semibold">
        {props.valor}
      </p>
    </div>
  );
}

function EstadoPendente(props: {
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-background px-6 py-14 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-muted/40">
        <Clock3 className="size-5 text-muted-foreground" />
      </div>

      <h2 className="mt-4 font-semibold">
        {props.titulo}
      </h2>

      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {props.descricao}
      </p>
    </div>
  );
}

function ResultadoSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b pb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>

      <Card>
        <CardContent className="p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
            <div className="space-y-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            <Skeleton className="h-40 w-full" />
          </div>
        </CardContent>
      </Card>

      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}