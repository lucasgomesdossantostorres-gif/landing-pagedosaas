"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Bot,
  BrainCircuit,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MessageRole =
  | "user"
  | "assistant";

type MentorMessage = {
  id: string;
  role: MessageRole;
  content: string;
};

type MentorLimits = {
  plan: "free" | "essential" | "pro";
  plan_name: string;
  daily_limit: number;
  used_today: number;
  remaining_today: number;
  maximum_characters: number;
  maximum_output_tokens: number;
  context_messages: number;
};

type MentorApiResponse = {
  success: boolean;
  message?: string;
  error?: string;
  limits?: MentorLimits;
};

const QUICK_QUESTIONS = [
  "Como posso melhorar minhas respostas discursivas?",
  "Como transformar um feedback em um plano de melhoria?",
  "Como organizar uma rotina de estudos?",
  "Como estudar quando tenho pouco tempo?",
  "Como revisar conteúdos de forma eficiente?",
  "Como identificar meus erros mais recorrentes?",
  "Como melhorar minha argumentação?",
  "Crie um exercício para eu treinar uma dificuldade.",
] as const;

const INITIAL_MESSAGE: MentorMessage = {
  id: "mentor-welcome",
  role: "assistant",
  content:
    "Olá! Posso ajudar com concursos, técnicas de estudo, respostas discursivas e interpretação de feedbacks. Escolha uma sugestão ou escreva sua dúvida.",
};

function createMessage(
  role: MessageRole,
  content: string,
): MentorMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
  };
}

export default function MentorPage() {
  const [messages, setMessages] =
    useState<MentorMessage[]>([
      INITIAL_MESSAGE,
    ]);

  const [text, setText] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const [loadingLimits, setLoadingLimits] =
    useState(true);

  const [error, setError] =
    useState("");

  const [limits, setLimits] =
    useState<MentorLimits | null>(null);

  const [limitDialogOpen, setLimitDialogOpen] =
    useState(false);

  const conversationEndRef =
    useRef<HTMLDivElement | null>(null);

  const maximumCharacters =
    limits?.maximum_characters ?? 1000;

  const remainingMessages =
    limits?.remaining_today ?? 0;

  const limitReached =
    limits !== null &&
    remainingMessages <= 0;

  const textTooLong =
    text.length > maximumCharacters;

  const canSend =
    text.trim().length > 0 &&
    !textTooLong &&
    !sending &&
    !loadingLimits &&
    !limitReached;

  const hasUserMessages = useMemo(
    () =>
      messages.some(
        (message) =>
          message.role === "user",
      ),
    [messages],
  );

  useEffect(() => {
    async function loadLimits() {
      setLoadingLimits(true);
      setError("");

      try {
        const response = await fetch(
          "/api/mentor",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as MentorApiResponse;

        if (
          !response.ok ||
          result.success !== true ||
          !result.limits
        ) {
          throw new Error(
            result.error ||
              "Não foi possível carregar os limites do Mentor.",
          );
        }

        setLimits(result.limits);

        if (
          result.limits.remaining_today <= 0
        ) {
          setLimitDialogOpen(true);
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Erro ao carregar o Mentor.",
        );
      } finally {
        setLoadingLimits(false);
      }
    }

    void loadLimits();
  }, []);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, sending]);

  async function sendMessage(
    directMessage?: string,
  ) {
    const content =
      (directMessage ?? text).trim();

    if (
      !content ||
      sending ||
      loadingLimits
    ) {
      return;
    }

    if (limitReached) {
      setLimitDialogOpen(true);
      return;
    }

    if (
      content.length >
      maximumCharacters
    ) {
      setError(
        `Sua mensagem deve ter no máximo ${maximumCharacters} caracteres.`,
      );

      return;
    }

    const userMessage =
      createMessage(
        "user",
        content,
      );

    const updatedMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(updatedMessages);
    setText("");
    setError("");
    setSending(true);

    try {
      const response = await fetch(
        "/api/mentor",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            messages:
              updatedMessages.map(
                (message) => ({
                  role: message.role,
                  content:
                    message.content,
                }),
              ),
          }),
        },
      );

      const result =
        (await response.json()) as MentorApiResponse;

      if (
        !response.ok ||
        result.success !== true ||
        !result.message
      ) {
        if (result.limits) {
          setLimits(result.limits);
        }

        if (
          response.status === 429 &&
          result.limits?.remaining_today === 0
        ) {
          setLimitDialogOpen(true);
          return;
        }

        throw new Error(
          result.error ||
            "O Mentor não conseguiu responder.",
        );
      }

      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          result.message as string,
        ),
      ]);

      if (result.limits) {
        setLimits(result.limits);
      }
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Erro inesperado ao enviar a mensagem.",
      );
    } finally {
      setSending(false);
    }
  }

  function submitForm(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    void sendMessage();
  }

  function startNewConversation() {
    setMessages([
      INITIAL_MESSAGE,
    ]);

    setText("");
    setError("");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="size-6 text-primary" />

            <h1 className="text-2xl font-semibold tracking-tight">
              Mentor
            </h1>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tire dúvidas, aprofunde feedbacks e receba
            orientações práticas para evoluir nos estudos.
          </p>
        </div>

        {limits && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Plano {limits.plan_name}
            </Badge>

            <Badge variant="outline">
              {limits.remaining_today} de{" "}
              {limits.daily_limit} mensagens disponíveis
            </Badge>

            {limits.plan === "free" && (
              <Link
                href="/planos"
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                Ver planos
              </Link>
            )}
          </div>
        )}
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />

          <AlertTitle>
            Não foi possível continuar
          </AlertTitle>

          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="size-4" />
                Conversa com o Mentor
              </CardTitle>

              <CardDescription className="mt-1">
                A conversa permanece somente enquanto esta página
                estiver aberta.
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startNewConversation}
              disabled={sending}
            >
              <RotateCcw className="size-4" />
              Nova conversa
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="max-h-140 min-h-105 space-y-5 overflow-y-auto p-5 sm:p-6">
            {messages.map((message) => {
              const isAssistant =
                message.role === "assistant";

              return (
                <div
                  key={message.id}
                  className={
                    isAssistant
                      ? "flex items-start gap-3"
                      : "flex items-start justify-end gap-3"
                  }
                >
                  {isAssistant && (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-primary/10 text-primary">
                      <Bot className="size-4" />
                    </div>
                  )}

                  <div
                    className={
                      isAssistant
                        ? "max-w-[85%] rounded-2xl rounded-tl-md border bg-background px-4 py-3"
                        : "max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-primary-foreground"
                    }
                  >
                    {isAssistant ? (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: ({ children }) => (
        <h1 className="mb-3 mt-5 text-xl font-semibold">
          {children}
        </h1>
      ),

      h2: ({ children }) => (
        <h2 className="mb-3 mt-5 text-lg font-semibold">
          {children}
        </h2>
      ),

      h3: ({ children }) => (
        <h3 className="mb-2 mt-4 text-base font-semibold">
          {children}
        </h3>
      ),

      p: ({ children }) => (
        <p className="my-2 text-sm leading-7">
          {children}
        </p>
      ),

      strong: ({ children }) => (
        <strong className="font-semibold text-foreground">
          {children}
        </strong>
      ),

      ul: ({ children }) => (
        <ul className="my-3 list-disc space-y-2 pl-5 text-sm leading-7">
          {children}
        </ul>
      ),

      ol: ({ children }) => (
        <ol className="my-3 list-decimal space-y-2 pl-5 text-sm leading-7">
          {children}
        </ol>
      ),

      li: ({ children }) => (
        <li className="pl-1">
          {children}
        </li>
      ),

      blockquote: ({ children }) => (
        <blockquote className="my-3 border-l-4 border-primary/40 pl-4 italic text-muted-foreground">
          {children}
        </blockquote>
      ),

      code: ({ children }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
          {children}
        </code>
      ),

      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-4"
        >
          {children}
        </a>
      ),
    }}
  >
    {message.content}
  </ReactMarkdown>
) : (
  <p className="whitespace-pre-wrap text-sm leading-6">
    {message.content}
  </p>
)}
                  </div>

                  {!isAssistant && (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/40">
                      <UserRound className="size-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {sending && (
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-primary/10 text-primary">
                  <Bot className="size-4" />
                </div>

                <div className="rounded-2xl rounded-tl-md border bg-background px-4 py-3">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    O Mentor está preparando a resposta...
                  </p>
                </div>
              </div>
            )}

            <div ref={conversationEndRef} />
          </div>

          {!hasUserMessages && (
            <div className="border-t bg-muted/10 p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />

                <h2 className="text-sm font-medium">
                  Escolha uma pergunta para começar
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {QUICK_QUESTIONS.map(
                  (question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() =>
                        void sendMessage(
                          question,
                        )
                      }
                      disabled={
                        sending ||
                        loadingLimits ||
                        limitReached
                      }
                      className="rounded-xl border bg-background p-4 text-left text-sm leading-5 transition-colors hover:border-primary/40 hover:bg-primary/3 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {question}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          <form
            onSubmit={submitForm}
            className="space-y-3 border-t bg-background p-5"
          >
            <textarea
              value={text}
              onChange={(event) => {
                setText(
                  event.target.value,
                );

                if (error) {
                  setError("");
                }
              }}
              disabled={
                sending ||
                loadingLimits ||
                limitReached
              }
              placeholder={
                limitReached
                  ? "Você atingiu o limite diário do seu plano."
                  : "Digite sua dúvida sobre estudos, concursos ou feedbacks..."
              }
              rows={4}
              className="w-full resize-none rounded-xl border bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p
                  className={
                    textTooLong
                      ? "text-xs font-medium text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {text.length} de{" "}
                  {maximumCharacters} caracteres
                </p>

                <p className="text-xs leading-5 text-muted-foreground">
                  A conversa será apagada ao sair ou atualizar
                  esta página.
                </p>
              </div>

              <Button
                type="submit"
                disabled={!canSend}
                className="shrink-0"
              >
                {sending ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-xs leading-5 text-muted-foreground">
        O Mentor oferece orientações educacionais e pode cometer
        imprecisões. Confirme informações de editais, legislação
        e bancas em fontes oficiais.
      </p>

      <Dialog
        open={limitDialogOpen}
        onOpenChange={setLimitDialogOpen}
      >
        <DialogContent
          className="sm:max-w-md"
          showCloseButton
        >
          <DialogHeader>
            <div className="mb-1 flex size-11 items-center justify-center rounded-full border bg-muted/40">
              <AlertCircle className="size-5 text-destructive" />
            </div>

            <DialogTitle className="text-lg">
              Limite diário atingido
            </DialogTitle>

            <DialogDescription className="leading-6">
              Você utilizou todas as mensagens disponíveis hoje no
              plano {limits?.plan_name ?? "atual"}.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                Uso de hoje
              </span>

              <strong className="font-semibold text-foreground">
                {limits?.used_today ?? 0} de{" "}
                {limits?.daily_limit ?? 0}
              </strong>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full rounded-full bg-destructive/80" />
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              O limite será renovado automaticamente no próximo dia.
              Suas conversas anteriores continuam visíveis enquanto
              esta página permanecer aberta.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setLimitDialogOpen(false)
              }
            >
              Entendi
            </Button>

            <Link
              href="/planos"
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {limits?.plan === "free"
                ? "Conhecer planos"
                : "Fazer upgrade"}
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}