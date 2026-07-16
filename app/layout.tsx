import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import {
  ThemeBootstrap,
} from "@/components/theme-bootstrap";
import {
  ThemeSync,
} from "@/components/theme-sync";

import "./globals.css";

export const metadata: Metadata = {
  title: "Simples Aprova.AI",
  description:
    "Correção de questões discursivas por inteligência artificial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
    >
      <head>
        <ThemeBootstrap />
      </head>

      <body>
        <ThemeSync />

        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
