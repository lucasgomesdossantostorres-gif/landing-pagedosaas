"use client";

import {
  type FormEvent,
  useState,
} from "react";
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  LoaderCircle,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export function ReportErrorButton() {
  const [aberto, setAberto] =
    useState(false);

  const [mensagem, setMensagem] =
    useState("");

  const [enviando, setEnviando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  const [sucesso, setSucesso] =
    useState(false);

  function fechar() {
    if (enviando) {
      return;
    }

    setAberto(false);
    setErro("");
    setSucesso(false);
  }

  async function enviarRelato(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const texto =
      mensagem.trim();

    if (texto.length < 10) {
      setErro(
        "Descreva o problema com pelo menos 10 caracteres.",
      );

      return;
    }

    setEnviando(true);
    setErro("");
    setSucesso(false);

    try {
      const response = await fetch(
        "/api/relatar-erro",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            message: texto,
            page_url:
              window.location.href,
          }),
        },
      );

      const resultado =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        resultado.success !== true
      ) {
        throw new Error(
          resultado.error ??
            "Não foi possível enviar o relato.",
        );
      }

      setMensagem("");
      setSucesso(true);

      window.setTimeout(() => {
        setAberto(false);
        setSucesso(false);
      }, 1600);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o relato.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setAberto(true);
          setErro("");
          setSucesso(false);
        }}
        className="fixed bottom-5 right-5 z-50 gap-2 rounded-full px-4 shadow-lg"
        aria-label="Relatar erro"
      >
        <Bug className="size-4" />
        <span className="hidden sm:inline">
          Relatar erro
        </span>
      </Button>

      {aberto && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-error-title"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              fechar();
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2
                  id="report-error-title"
                  className="font-semibold tracking-tight"
                >
                  Relatar um erro
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Descreva o que aconteceu nesta página.
                </p>
              </div>

              <button
                type="button"
                onClick={fechar}
                disabled={enviando}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={enviarRelato}
              className="space-y-4 p-5"
            >
              <textarea
                value={mensagem}
                onChange={(event) => {
                  setMensagem(
                    event.target.value,
                  );

                  if (erro) {
                    setErro("");
                  }
                }}
                minLength={10}
                maxLength={2000}
                rows={6}
                placeholder="Exemplo: cliquei em enviar e a página ficou carregando sem concluir."
                disabled={enviando}
                className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                required
              />

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">
                  {mensagem.length}/2000
                </span>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={fechar}
                    disabled={enviando}
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="submit"
                    disabled={
                      enviando ||
                      mensagem.trim().length < 10
                    }
                  >
                    {enviando ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Bug className="size-4" />
                        Enviar relato
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {erro && (
                <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{erro}</span>
                </div>
              )}

              {sucesso && (
                <div className="flex gap-2 rounded-md border border-emerald-300/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Relato enviado com sucesso.
                  </span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
