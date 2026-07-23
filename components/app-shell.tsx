"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { ReportErrorButton } from "@/components/relatar-erro";

type AppShellProps = {
  children: ReactNode;
};

const publicRoutes = ["/login", "/cadastro"];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <div className="flex">
        <AppSidebar />

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
            <ReportErrorButton />
          </div>
        </main>
      </div>
    </div>
  );
}
