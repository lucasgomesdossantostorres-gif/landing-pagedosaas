"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, MoreVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buscarHistoricoDoUsuario,
  type RespostaHistorico,
} from "@/lib/services/history";

type RespostaHistoricoComQuestao =
  RespostaHistorico & {
    selected_question: number | null;
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
    draft:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",

    submitted:
      "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",

    processing:
      "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200",

    corrected:
      "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-200",

    failed:
      "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-200",
  };

  return (
    classes[status] ??
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
  );
}

function obterNumeroQuestao(
  resposta: RespostaHistoricoComQuestao,
) {
  const numero = Number(
    resposta.selected_question,
  );

  if (
    Number.isInteger(numero) &&
    numero >= 1 &&
    numero <= 4
  ) {
    return numero;
  }

  return 1;
}

export default function HistoricoPage() {
  const router = useRouter();

  const [respostas, setRespostas] = useState<
    RespostaHistoricoComQuestao[]
  >([]);

  const [mensagem, setMensagem] =
    useState("");

  const [carregando, setCarregando] =
    useState(true);

  const [respostaParaExcluir, setRespostaParaExcluir] =
    useState<RespostaHistoricoComQuestao | null>(null);

  const [excluindo, setExcluindo] =
    useState(false);

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarHistorico() {
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

        const historico =
          await buscarHistoricoDoUsuario(
            supabase,
            user.id,
          );

        if (!componenteAtivo) {
          return;
        }

        setRespostas(
          historico as RespostaHistoricoComQuestao[],
        );
      } catch (error) {
        if (!componenteAtivo) {
          return;
        }

        const mensagemErro =
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar o histórico.";

        setMensagem(mensagemErro);
      } finally {
        if (componenteAtivo) {
          setCarregando(false);
        }
      }
    }

    void carregarHistorico();

    return () => {
      componenteAtivo = false;
    };
  }, [router]);

  async function excluirResposta() {
    if (!respostaParaExcluir || excluindo) {
      return;
    }

    setExcluindo(true);
    setMensagem("");

    try {
      const response = await fetch(
        `/api/respostas/${respostaParaExcluir.id}`,
        {
          method: "DELETE",
        },
      );

      const result =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        result.success !== true
      ) {
        throw new Error(
          result.error ||
            "Não foi possível excluir a resposta.",
        );
      }

      setRespostas((atuais) =>
        atuais.filter(
          (item) =>
            item.id !==
            respostaParaExcluir.id,
        ),
      );

      setRespostaParaExcluir(null);
      setMensagem(
        "Resposta excluída do histórico.",
      );
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao excluir a resposta.",
      );
    } finally {
      setExcluindo(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">
          Carregando histórico...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap gap-5">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-primary transition-opacity hover:opacity-80"
          >
            Voltar ao dashboard
          </Link>

          <Link
            href="/questoes"
            className="text-sm font-semibold text-primary transition-opacity hover:opacity-80"
          >
            Ver questões
          </Link>
        </div>

        <header className="mt-6 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Suas atividades
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Histórico de respostas
          </h1>

          <p className="mt-3 text-muted-foreground">
            Consulte as respostas enviadas, o andamento
            das correções e as notas recebidas.
          </p>
        </header>

        {mensagem && (
          <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
            {mensagem}
          </div>
        )}

        {respostas.length === 0 ? (
          <section className="mt-8 rounded-2xl border bg-card p-8 shadow-sm">
            <h2 className="text-2xl font-bold">
              Nenhuma resposta encontrada
            </h2>

            <p className="mt-3 text-muted-foreground">
              Você ainda não enviou nenhuma resposta
              discursiva.
            </p>

            <Link
              href="/questoes"
              className="mt-6 inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Responder uma questão
            </Link>
          </section>
        ) : (
          <section className="mt-8 space-y-5">
            {respostas.map((resposta) => {
              const numeroQuestao =
                obterNumeroQuestao(resposta);

              return (
                <article
                  key={resposta.id}
                  className="rounded-2xl border bg-card p-6 text-card-foreground shadow-sm sm:p-7"
                >
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="min-w-0 max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {resposta.subject && (
                          <span>
                            {resposta.subject}
                          </span>
                        )}

                        {resposta.examining_board && (
                          <span>
                            •{" "}
                            {
                              resposta.examining_board
                            }
                          </span>
                        )}

                        <span className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground">
                          Questão {numeroQuestao}
                        </span>
                      </div>

                      <h2 className="mt-3 text-xl font-bold tracking-tight">
                        {resposta.question_title}
                        <span className="text-muted-foreground">
                          {" — "}Questão{" "}
                          {numeroQuestao}
                        </span>
                      </h2>

                      <p className="mt-3 text-sm text-muted-foreground">
                        Enviada em{" "}
                        {formatarData(
                          resposta.submitted_at ??
                            resposta.created_at,
                        )}
                      </p>

                      <span
                        className={`mt-4 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${obterClasseStatus(
                          resposta.status,
                        )}`}
                      >
                        {traduzirStatus(
                          resposta.status,
                        )}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-start gap-3">
                      <div className="text-right">
                      {resposta.correction_id !==
                      null ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            Nota
                          </p>

                          <p className="mt-1 text-3xl font-bold text-primary">
                            {Number(
                              resposta.total_score ??
                                0,
                            ).toFixed(1)}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            de{" "}
                            {Number(
                              resposta.maximum_score,
                            ).toFixed(1)}
                          </p>
                        </>
                      ) : (
                        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                          Sem correção
                        </p>
                      )}
                      </div>

                      <details className="relative">
                        <summary
                          className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Abrir opções da resposta"
                        >
                          <MoreVertical className="size-4" />
                        </summary>

                        <div className="absolute right-0 top-11 z-20 w-48 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
                          <button
                            type="button"
                            onClick={() =>
                              setRespostaParaExcluir(
                                resposta,
                              )
                            }
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                          >
                            <Trash2 className="size-4" />
                            Excluir do histórico
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Link
                      href={`/respostas/${resposta.id}`}
                      className="inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      {resposta.correction_id !==
                      null
                        ? "Ver correção"
                        : resposta.status ===
                            "failed"
                          ? "Tentar novamente"
                          : "Abrir resposta"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>

      <Dialog
        open={respostaParaExcluir !== null}
        onOpenChange={(open) => {
          if (!open && !excluindo) {
            setRespostaParaExcluir(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Excluir resposta do histórico?
            </DialogTitle>

            <DialogDescription className="leading-6">
              A resposta, a correção e os detalhes associados serão
              apagados definitivamente. O crédito já utilizado não
              será devolvido.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setRespostaParaExcluir(null)
              }
              disabled={excluindo}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                void excluirResposta()
              }
              disabled={excluindo}
            >
              {excluindo ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Excluir definitivamente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}