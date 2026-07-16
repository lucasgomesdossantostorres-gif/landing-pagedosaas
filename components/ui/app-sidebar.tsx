"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CreditCard,
  FileText,
  History,
  Home,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";

type AppSidebarProps = {
  mobile?: boolean;
};

const navigation = [
  {
    label: "Início",
    href: "/dashboard",
    icon: Home,
  },
  {
    label: "Questões",
    href: "/questoes",
    icon: BookOpen,
  },
  {
    label: "Minhas respostas",
    href: "/respostas",
    icon: FileText,
  },
  {
    label: "Histórico",
    href: "/historico",
    icon: History,
  },
  {
    label: "Desempenho",
    href: "/dashboard",
    icon: BarChart3,
  },
];

export function AppSidebar({ mobile = false }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-background",
        !mobile &&
          "sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r md:flex",
      )}
    >
      <div className="flex-1 space-y-1 p-3">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Navegação
        </p>

        {navigation.map((item) => {
          const Icon = item.icon;

          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />

              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="space-y-3 border-t p-3">
        <Link
          href="/#planos"
          className="block rounded-lg border border-primary/20 bg-primary/5 p-3 transition-colors hover:bg-primary/10"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CreditCard className="h-4 w-4 text-primary" />
            Ver planos
          </div>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Aumente seus limites de correções e do Mentor IA.
          </p>
        </Link>

        <Link
          href="/configuracoes"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Settings className="h-4 w-4" />
          <span>Configurações</span>
        </Link>
      </div>
    </aside>
  );
}