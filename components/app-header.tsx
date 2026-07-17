"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  Bell,
  Menu,
  Sparkles,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

type Plano = "free" | "essential" | "pro";

type RespostaLimites = {
  success: boolean;
  plan?: Plano;
  error?: string;
};

export function AppHeader() {
  const [plano, setPlano] =
    useState<Plano | null>(null);

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarPlano() {
      try {
        const response = await fetch(
          "/api/correcoes/limites",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const texto =
          await response.text();

        if (!texto.trim()) {
          return;
        }

        const resultado =
          JSON.parse(
            texto,
          ) as RespostaLimites;

        if (
          componenteAtivo &&
          response.ok &&
          resultado.success === true &&
          resultado.plan
        ) {
          setPlano(
            resultado.plan,
          );
        }
      } catch {
        /*
         * O cabeçalho continua funcionando normalmente
         * mesmo se a consulta do plano falhar.
         */
      }
    }

    void carregarPlano();

    return () => {
      componenteAtivo = false;
    };
  }, []);

  const exibirBotaoPlanos =
    plano !== null &&
    plano !== "pro";

  const textoBotao =
    plano === "essential"
      ? "Fazer upgrade"
      : "Ver planos";

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur">
      <div className="flex w-full items-center gap-4">
        <Sheet>
          <SheetTrigger
            className="inline-flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </SheetTrigger>

          <SheetContent
            side="left"
            className="w-72 p-0"
          >
            <AppSidebar mobile />
          </SheetContent>
        </Sheet>

        <Link
          href="/questoes"
          className="shrink-0 text-lg font-semibold tracking-tight"
        >
          SimplesAprova
          <span className="text-primary">
            .ai
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {exibirBotaoPlanos && (
            <Link
              href="/planos"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Sparkles className="size-4" />

              <span className="hidden sm:inline">
                {textoBotao}
              </span>
            </Link>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Notificações"
          >
            <Bell className="size-5" />
          </Button>

          <Link
            href="/configuracoes"
            aria-label="Abrir configurações da conta"
            className="rounded-full outline-none ring-ring transition-opacity hover:opacity-80 focus-visible:ring-2"
          >
            <Avatar className="size-8">
              <AvatarFallback>
                FT
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}
