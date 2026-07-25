"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  History,
  Home,
  Settings,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import { cn } from "@/lib/utils";

type AppSidebarProps = {
  mobile?: boolean;
};

const navigationGroups = [
  {
    label: "Principal",
    items: [
      {
        label: "Início",
        description: "Visão geral da sua jornada",
        href: "/dashboard",
        icon: Home,
      },
      {
        label: "Questões",
        description: "Pratique respostas discursivas",
        href: "/questoes",
        icon: BookOpen,
      },
      {
        label: "Mentor IA",
        description: "Tire dúvidas e organize os estudos",
        href: "/mentor",
        icon: BrainCircuit,
      },
    ],
  },
  {
    label: "Evolução",
    items: [
      {
        label: "Histórico",
        description: "Revise respostas e feedbacks",
        href: "/historico",
        icon: History,
      },
      {
        label: "Desempenho",
        description: "Acompanhe seu progresso",
        href: "/desempenho",
        icon: BarChart3,
      },
    ],
  },
];

export function AppSidebar({
  mobile = false,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col overflow-hidden border-blue-100/80 bg-white/92 shadow-[12px_0_35px_rgba(37,99,235,0.06)] backdrop-blur-xl dark:border-blue-950/60 dark:bg-slate-950/88",
        !mobile &&
          "sticky top-16 hidden h-[calc(100vh-4rem)] w-72 shrink-0 border-r md:flex",
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-blue-100/75 via-blue-50/35 dark:from-blue-950/45 dark:via-blue-950/15 to-transparent"
      />

      <div className="relative flex h-full flex-col">
        <div className="border-b border-border/70 px-4 pb-4 pt-5">
          {mobile && (
            <Link
              href="/dashboard"
              className="mb-4 flex items-center gap-3 rounded-2xl border bg-background/80 p-3 shadow-sm"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#2563eb] text-white shadow-sm">
                <Sparkles className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight">
                  Simples Aprova.AI
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Seu espaço de preparação
                </p>
              </div>
            </Link>
          )}

          <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-100/80 via-blue-50/60 to-white dark:border-blue-900/60 dark:from-blue-950/45 dark:via-blue-950/20 dark:to-slate-950 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#2563eb] text-white shadow-sm">
                <Target className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight">
                  Seu foco de hoje
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Evolua uma resposta por vez, com prática e feedback.
                </p>
              </div>
            </div>

            <Link
              href="/questoes"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5 hover:bg-[#1d4ed8]"
            >
              Começar uma questão
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                {group.label}
              </p>

              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(
                      `${item.href}/`,
                    );

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-2xl px-3 py-3 transition-all",
                        isActive
                          ? "bg-[#2563eb] text-white shadow-sm"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                          isActive
                            ? "border-white/20 bg-white/10"
                            : "border-border bg-background group-hover:border-blue-200 group-hover:bg-blue-50/80 dark:group-hover:border-blue-800 dark:group-hover:bg-blue-950/30",
                        )}
                      >
                        <Icon className="size-[18px]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {item.label}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 truncate text-[11px]",
                            isActive
                              ? "text-primary-foreground/75"
                              : "text-muted-foreground/80",
                          )}
                        >
                          {item.description}
                        </p>
                      </div>

                      {isActive && (
                        <span className="size-1.5 shrink-0 rounded-full bg-white" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-border/80 bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                <Trophy className="size-4" />
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Consistência vence
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Use o histórico para comparar seus avanços e corrigir padrões.
                </p>
              </div>
            </div>
          </div>
        </nav>

        <div className="border-t border-border/70 bg-background/90 p-3 backdrop-blur">
          <Link
            href="/configuracoes"
            className={cn(
              "group flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
              pathname === "/configuracoes" ||
                pathname.startsWith(
                  "/configuracoes/",
                )
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <div className="flex size-10 items-center justify-center rounded-xl border bg-background transition-colors group-hover:border-blue-200 group-hover:bg-blue-50/80 dark:group-hover:border-blue-800 dark:group-hover:bg-blue-950/30">
              <Settings className="size-[18px]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Configurações
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Conta, plano e preferências
              </p>
            </div>
          </Link>
        </div>
      </div>
    </aside>
  );
}
