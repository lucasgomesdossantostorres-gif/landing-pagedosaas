"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  HelpCircle,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Questao = {
  id: number;
  title: string;
  statement: string;
  examining_board: string | null;
  exam_name: string | null;
  exam_year: number | null;
};

type EstadoValidacao =
  | "idle"
  | "validating"
  | "approved"
  | "rejected"
  | "error";

type ResultadoValidacao = {
  success: boolean;
  status: "processing" | "approved" | "rejected" | "error";
  approved: boolean;
  cached?: boolean;
  confidence?: number;
  feedback?: string;
  inconsistencies?: string[];
  validated_at?: string;
  error?: string;
};

type ResultadoSalvarResposta = {
  success: boolean;
  answer_id?: number;
  question_id?: number;
  selected_question?: number;
  status?: string;
  submitted_at?: string;
  error?: string;
  limits?: {
    plan: "free" | "essential" | "pro";
    plan_name: string;
    monthly_limit: number;
    used_this_month: number;
    remaining_this_month: number;
  };
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

const OPCOES_QUESTAO = [1, 2, 3, 4] as const;

export default function QuestaoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const questionId = useMemo(
    () => Number(params.id),
    [params.id],
  );

  const [questao, setQuestao] =
    useState<Questao | null>(null);

  const [questaoSelecionada, setQuestaoSelecionada] =
    useState<number | null>(null);

  const [erroQuestaoObrigatoria, setErroQuestaoObrigatoria] =
    useState(false);

  const secaoQuestaoRef =
    useRef<HTMLDivElement | null>(null);

  const [resposta, setResposta] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [estadoValidacao, setEstadoValidacao] =
    useState<EstadoValidacao>("idle");

  const [feedbackValidacao, setFeedbackValidacao] =
    useState("");

  const [confiancaValidacao, setConfiancaValidacao] =
    useState<number | null>(null);

  const [resultadoEmCache, setResultadoEmCache] =
    useState(false);

  const [limitesCorrecao, setLimitesCorrecao] =
    useState<LimitesCorrecao | null>(null);

  const [carregandoLimites, setCarregandoLimites] =
    useState(true);

  const [modalLimiteAberto, setModalLimiteAberto] =
    useState(false);

  const quantidadePalavras = useMemo(() => {
    const texto = resposta.trim();

    if (!texto) {
      return 0;
    }

    return texto.split(/\s+/).length;
  }, [resposta]);

  const quantidadeParagrafos = useMemo(() => {
    const texto = resposta.trim();

    if (!texto) {
      return 0;
    }

    return texto
      .split(/\n+/)
      .map((paragrafo) => paragrafo.trim())
      .filter(Boolean).length;
  }, [resposta]);

  const respostaValida =
    resposta.trim().length >= 30;

  /*
   * O botão permanece clicável quando a redação já possui
   * o tamanho mínimo, mesmo sem questão selecionada.
   * A validação da questão será feita ao tentar enviar.
   */
  const limiteMensalAtingido =
    limitesCorrecao?.remaining_this_month === 0;

  const envioPermitido =
    respostaValida &&
    !enviando &&
    !carregandoLimites &&
    !limiteMensalAtingido;

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarLimites() {
      setCarregandoLimites(true);

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

        if (!componenteAtivo) {
          return;
        }

        if (
          !response.ok ||
          resultado.success !== true
        ) {
          setMensagem(
            resultado.error ??
              "Não foi possível consultar seu limite mensal.",
          );

          return;
        }

        setLimitesCorrecao(resultado);

        if (
          resultado.remaining_this_month === 0
        ) {
          setModalLimiteAberto(true);
        }
      } catch (error) {
        if (!componenteAtivo) {
          return;
        }

        setMensagem(
          error instanceof Error
            ? error.message
            : "Não foi possível consultar seu limite mensal.",
        );
      } finally {
        if (componenteAtivo) {
          setCarregandoLimites(false);
        }
      }
    }

    void carregarLimites();

    return () => {
      componenteAtivo = false;
    };
  }, []);

  const validarQuestao = useCallback(async () => {
    if (
      !Number.isInteger(questionId) ||
      questionId <= 0
    ) {
      return;
    }

    setEstadoValidacao("validating");
    setFeedbackValidacao("");
    setConfiancaValidacao(null);
    setResultadoEmCache(false);

    try {
      const response = await fetch(
        `/api/questoes/${questionId}/validar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        },
      );

      const resultado =
        (await response.json()) as ResultadoValidacao;

      if (
        !response.ok ||
        resultado.success !== true
      ) {
        setEstadoValidacao("error");

        setFeedbackValidacao(
          resultado.error ??
            "Não foi possível concluir a preparação da prova.",
        );

        return;
      }

      setConfiancaValidacao(
        typeof resultado.confidence === "number"
          ? resultado.confidence
          : null,
      );

      setResultadoEmCache(
        resultado.cached === true,
      );

      if (
        resultado.status === "approved" &&
        resultado.approved === true
      ) {
        setEstadoValidacao("approved");

        setFeedbackValidacao(
          resultado.feedback ??
            "A prova está disponível para resposta.",
        );

        return;
      }

      setEstadoValidacao("rejected");

      setFeedbackValidacao(
        resultado.feedback ??
          "A preparação da prova exige atenção.",
      );
    } catch (error) {
      const mensagemErro =
        error instanceof Error
          ? error.message
          : "Erro inesperado.";

      setEstadoValidacao("error");
      setFeedbackValidacao(mensagemErro);
    }
  }, [questionId]);

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarQuestao() {
      setCarregando(true);
      setMensagem("");
      setQuestao(null);
      setQuestaoSelecionada(null);
      setErroQuestaoObrigatoria(false);
      setResposta("");

      if (
        !Number.isInteger(questionId) ||
        questionId <= 0
      ) {
        if (componenteAtivo) {
          setMensagem(
            "Identificador da prova inválido.",
          );

          setCarregando(false);
        }

        return;
      }

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
        data: questaoData,
        error: questaoError,
      } = await supabase
        .from("questions")
        .select(`
          id,
          title,
          statement,
          examining_board,
          exam_name,
          exam_year
        `)
        .eq("id", questionId)
        .eq("status", "published")
        .maybeSingle();

      if (!componenteAtivo) {
        return;
      }

      if (questaoError || !questaoData) {
        setMensagem(
          "Prova não encontrada ou indisponível.",
        );

        setCarregando(false);
        return;
      }

      setQuestao(questaoData as Questao);
      setCarregando(false);

      void validarQuestao();
    }

    void carregarQuestao();

    return () => {
      componenteAtivo = false;
    };
  }, [
    questionId,
    router,
    validarQuestao,
  ]);

  function selecionarQuestao(numero: number) {
    setQuestaoSelecionada(numero);
    setErroQuestaoObrigatoria(false);

    if (mensagem) {
      setMensagem("");
    }
  }

  async function enviarResposta(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (enviando) {
      return;
    }

    if (limiteMensalAtingido) {
      setMensagem(
        `Você atingiu o limite mensal de ${limitesCorrecao?.monthly_limit ?? 0} correções do plano ${limitesCorrecao?.plan_name ?? ""}.`,
      );
      setModalLimiteAberto(true);

      return;
    }

    const respostaLimpa = resposta.trim();

    if (questaoSelecionada === null) {
      setErroQuestaoObrigatoria(true);
      setMensagem("");

      window.requestAnimationFrame(() => {
        secaoQuestaoRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });

      return;
    }

    if (respostaLimpa.length < 30) {
      setMensagem(
        "Sua resposta precisa ter pelo menos 30 caracteres.",
      );

      return;
    }

    setMensagem("");
    setEnviando(true);

    try {
      const response = await fetch(
        "/api/respostas",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question_id: questionId,
            selected_question:
              questaoSelecionada,
            answer_text: respostaLimpa,
          }),
        },
      );

      const resultado =
        (await response.json()) as ResultadoSalvarResposta;

      if (
        !response.ok ||
        resultado.success !== true ||
        !resultado.answer_id
      ) {
        if (resultado.limits) {
          setLimitesCorrecao((atual) => ({
            success: true,
            period_start:
              atual?.period_start,
            ...resultado.limits,
          }));
        }

        if (
          response.status === 429
        ) {
          setModalLimiteAberto(true);
        }

        setMensagem(
          resultado.error ??
            "Não foi possível salvar a resposta.",
        );

        return;
      }

      if (resultado.limits) {
        setLimitesCorrecao((atual) => ({
          success: true,
          period_start:
            atual?.period_start,
          ...resultado.limits,
        }));
      }

      router.push(
        `/respostas/${resultado.answer_id}`,
      );
    } catch (error) {
      const mensagemErro =
        error instanceof Error
          ? error.message
          : "Erro inesperado ao salvar a resposta.";

      setMensagem(
        `Erro: ${mensagemErro}`,
      );
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <QuestaoSkeleton />;
  }

  if (!questao) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />

          <AlertTitle>
            Prova indisponível
          </AlertTitle>

          <AlertDescription>
            {mensagem ||
              "Prova não encontrada."}
          </AlertDescription>
        </Alert>

        <Link
          href="/questoes"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
          Voltar para as provas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4 border-b pb-6">
        <Link
          href="/questoes"
          className="-ml-2 inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
          Voltar para as provas
        </Link>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {questao.examining_board && (
              <Badge variant="secondary">
                <Building2 className="size-3.5" />
                {questao.examining_board}
              </Badge>
            )}

            {questao.exam_year && (
              <Badge variant="outline">
                <CalendarDays className="size-3.5" />
                {questao.exam_year}
              </Badge>
            )}

            <Badge variant="outline">
              <BookOpen className="size-3.5" />
              Prova discursiva
            </Badge>

            {questaoSelecionada !== null && (
              <Badge>
                Questão {questaoSelecionada}
              </Badge>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {questao.title ||
                "Prova discursiva"}
            </h1>

            {questao.exam_name && (
              <p className="mt-2 text-sm text-muted-foreground">
                {questao.exam_name}
              </p>
            )}
          </div>
        </div>
      </header>

      <ValidationStatus
        estado={estadoValidacao}
        feedback={feedbackValidacao}
        confianca={confiancaValidacao}
        cache={resultadoEmCache}
        onRetry={validarQuestao}
      />

      <Card
        className={
          limiteMensalAtingido
            ? "border-destructive/40 bg-destructive/3"
            : "border-primary/20"
        }
      >
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              Limite mensal de correções
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {carregandoLimites
                ? "Consultando seu plano..."
                : limitesCorrecao
                  ? `Plano ${limitesCorrecao.plan_name}: ${limitesCorrecao.remaining_this_month} de ${limitesCorrecao.monthly_limit} correções disponíveis neste mês.`
                  : "Não foi possível carregar o limite."}
            </p>
          </div>

          {limitesCorrecao && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  limiteMensalAtingido
                    ? "destructive"
                    : "secondary"
                }
              >
                {limitesCorrecao.used_this_month} utilizadas
              </Badge>

              {limitesCorrecao.plan === "free" && (
                <Link
                  href="/#planos"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Ver planos
                </Link>
              )}

              {limitesCorrecao.plan === "essential" && (
                <Link
                  href="/#planos"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Fazer upgrade
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div ref={secaoQuestaoRef}>
        <Card
          className={
            erroQuestaoObrigatoria
              ? "border-destructive bg-destructive/2 ring-2 ring-destructive/20"
              : "border-primary/20"
          }
          aria-invalid={erroQuestaoObrigatoria}
        >
        <CardHeader
          className={
            erroQuestaoObrigatoria
              ? "border-b border-destructive/30 bg-destructive/5"
              : "border-b bg-primary/5"
          }
        >
          <div className="flex items-start gap-3">
            <div
              className={
                erroQuestaoObrigatoria
                  ? "flex size-10 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-background"
                  : "flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-background"
              }
            >
              {erroQuestaoObrigatoria ? (
                <AlertCircle className="size-5 text-destructive" />
              ) : (
                <HelpCircle className="size-5 text-primary" />
              )}
            </div>

            <div>
              <CardTitle className="text-base">
                Indique qual questão você respondeu?
              </CardTitle>

              <CardDescription className="mt-1 max-w-3xl leading-6">
                Caso sua prova tenha apenas uma questão, marque questão 1.
                Uma mesma prova pode conter mais de uma questão discursiva, antes de enviar sua resposta, selecione abaixo a
  questão que você escolheu responder (as questões estão em ordem). 
  Você pode enviar quantas respostas desejar para esta prova.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            role="radiogroup"
            aria-label="Questão respondida"
            aria-required="true"
            aria-invalid={erroQuestaoObrigatoria}
          >
            {OPCOES_QUESTAO.map((numero) => {
              const selecionada =
                questaoSelecionada === numero;

              return (
                <Button
                  key={numero}
                  type="button"
                  variant={
                    selecionada
                      ? "default"
                      : "outline"
                  }
                  className="h-12"
                  aria-pressed={selecionada}
                  role="radio"
                  aria-checked={selecionada}
                  onClick={() =>
                    selecionarQuestao(numero)
                  }
                >
                  {selecionada && (
                    <CheckCircle2 className="size-4" />
                  )}

                  Questão {numero}
                </Button>
              );
            })}
          </div>

          <div className="mt-4 min-h-6">
            {questaoSelecionada !== null ? (
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <CheckCircle2 className="size-4" />
                Esta resposta será registrada como
                Questão {questaoSelecionada}.
              </p>
            ) : erroQuestaoObrigatoria ? (
              <p
                className="flex items-center gap-2 text-sm font-medium text-destructive"
                role="alert"
              >
                <AlertCircle className="size-4" />
                Esse campo é obrigatório.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione uma das quatro opções antes
                de enviar sua resposta.
              </p>
            )}
          </div>
        </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]">
        <Card className="min-w-0">
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                <FileText className="size-4 text-muted-foreground" />
              </div>

              <div>
                <CardTitle className="text-base">
                  Enunciado
                </CardTitle>

                <CardDescription>
                  Leia atentamente o comando antes de
                  elaborar sua resposta.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="whitespace-pre-line text-[15px] leading-7">
              {questao.statement}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden xl:sticky xl:top-20">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">
                  Folha de resposta
                </CardTitle>

                <CardDescription>
                  Organize sua redação respeitando as
                  linhas disponíveis.
                </CardDescription>
              </div>

              <Badge
                variant={
                  respostaValida &&
                  questaoSelecionada !== null
                    ? "secondary"
                    : "outline"
                }
              >
                {respostaValida &&
                questaoSelecionada !== null
                  ? "Pronta para envio"
                  : "Rascunho"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <form onSubmit={enviarResposta}>
              <div className="border-b bg-slate-50 px-5 py-3 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    Resposta discursiva — 30 linhas
                    visuais
                  </span>

                  <span>
                    {questaoSelecionada !== null
                      ? `Questão ${questaoSelecionada}`
                      : "Questão não selecionada"}
                  </span>
                </div>
              </div>

              <div className="relative bg-[#fffef9] dark:bg-[#111827]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-12 top-0 w-px bg-red-200 dark:bg-red-900"
                />

                <textarea
                  value={resposta}
                  onChange={(event) => {
                    setResposta(
                      event.target.value,
                    );

                    if (mensagem) {
                      setMensagem("");
                    }
                  }}
                  required
                  disabled={
                    enviando ||
                    limiteMensalAtingido
                  }
                  spellCheck
                  placeholder={
                    limiteMensalAtingido
                      ? "Seu limite mensal de correções foi atingido."
                      : "Comece sua resposta aqui..."
                  }
                  className="block min-h-210 w-full resize-y border-0 bg-transparent px-16 py-0 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500"
                  style={{
                    lineHeight: "28px",
                    paddingTop: "8px",
                    backgroundImage:
                      "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, color-mix(in srgb, var(--border) 85%, transparent) 28px)",
                    backgroundSize: "100% 28px",
                  }}
                />
              </div>

              <div className="space-y-4 border-t bg-background p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <span>
                      <strong className="font-medium text-foreground">
                        {quantidadePalavras}
                      </strong>{" "}
                      palavras
                    </span>

                    <span>
                      <strong className="font-medium text-foreground">
                        {resposta.length}
                      </strong>{" "}
                      caracteres
                    </span>

                    <span>
                      <strong className="font-medium text-foreground">
                        {quantidadeParagrafos}
                      </strong>{" "}
                      parágrafos
                    </span>
                  </div>

                  <span>
                    Mínimo de 30 caracteres
                  </span>
                </div>

                <Separator />

                {mensagem && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />

                    <AlertTitle>
                      Não foi possível continuar
                    </AlertTitle>

                    <AlertDescription>
                      {mensagem}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-md text-xs leading-5 text-muted-foreground">
                    A nota apresentada é uma estimativa
                    educacional e pode divergir da
                    correção oficial da banca.
                  </p>

                  <Button
                    type="submit"
                    disabled={!envioPermitido}
                    className="shrink-0"
                  >
                    {enviando ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        Enviar para correção
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={modalLimiteAberto}
        onOpenChange={setModalLimiteAberto}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex size-11 items-center justify-center rounded-full border bg-destructive/10">
              <AlertCircle className="size-5 text-destructive" />
            </div>

            <DialogTitle>
              Limite mensal atingido
            </DialogTitle>

            <DialogDescription className="leading-6">
              Você utilizou todas as correções disponíveis neste mês
              no plano {limitesCorrecao?.plan_name ?? "atual"}.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                Uso neste mês
              </span>

              <strong>
                {limitesCorrecao?.used_this_month ?? 0} de{" "}
                {limitesCorrecao?.monthly_limit ?? 0}
              </strong>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full rounded-full bg-destructive/80" />
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              O limite será renovado automaticamente no primeiro dia
              do próximo mês.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setModalLimiteAberto(false)
              }
            >
              Entendi
            </Button>

            <Link
              href="/#planos"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {limitesCorrecao?.plan === "essential"
                ? "Fazer upgrade"
                : limitesCorrecao?.plan === "pro"
                  ? "Ver opções"
                  : "Conhecer planos"}
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ValidationStatusProps = {
  estado: EstadoValidacao;
  feedback: string;
  confianca: number | null;
  cache: boolean;
  onRetry: () => void;
};

function ValidationStatus({
  estado,
  feedback,
  confianca,
  cache,
  onRetry,
}: ValidationStatusProps) {
  if (estado === "idle") {
    return null;
  }

  if (estado === "validating") {
    return (
      <Alert>
        <Clock3 className="size-4" />

        <AlertTitle>
          Preparando esta prova
        </AlertTitle>

        <AlertDescription>
          A preparação está sendo executada em segundo
          plano. Você já pode selecionar a questão e
          começar a escrever.
        </AlertDescription>
      </Alert>
    );
  }

  if (estado === "approved") {
    return (
      <Alert className="border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
        <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-400" />

        <AlertTitle>
          Prova disponível para correção
        </AlertTitle>

        <AlertDescription className="text-emerald-800 dark:text-emerald-200">
          A prova está liberada para o envio de
          respostas.

          {confianca !== null && (
            <span className="ml-1">
              Confiança:{" "}
              {(confianca * 100).toFixed(0)}%.
            </span>
          )}

          {cache && (
            <span className="ml-1">
              Liberação já disponível no sistema.
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (estado === "rejected") {
    return (
      <Alert className="border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
        <TriangleAlert className="size-4 text-amber-700 dark:text-amber-400" />

        <AlertTitle>
          A preparação exige atenção
        </AlertTitle>

        <AlertDescription className="text-amber-800 dark:text-amber-200">
          A resposta continua liberada. O sistema
          utilizará os dados completos disponíveis.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
      <ShieldCheck className="size-4 text-amber-700 dark:text-amber-400" />

      <AlertTitle>
        A preparação não foi concluída
      </AlertTitle>

      <AlertDescription className="space-y-3 text-amber-800 dark:text-amber-200">
        <p>
          Você pode continuar respondendo normalmente.
          O sistema tentará utilizar os dados completos
          disponíveis.
        </p>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetry}
        >
          <RefreshCw className="size-4" />
          Tentar novamente
        </Button>

        {feedback && (
          <p className="sr-only">
            Detalhe técnico: {feedback}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}

function QuestaoSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b pb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-44 w-full rounded-lg" />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>

          <CardContent className="space-y-3 pt-6">
            {Array.from({
              length: 10,
            }).map((_, index) => (
              <Skeleton
                key={index}
                className={
                  index % 3 === 0
                    ? "h-4 w-11/12"
                    : "h-4 w-full"
                }
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </CardHeader>

          <CardContent className="pt-6">
            <Skeleton className="h-210 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}