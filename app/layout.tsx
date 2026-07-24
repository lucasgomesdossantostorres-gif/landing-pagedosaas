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
  metadataBase: new URL("https://simplesaprova.com.br"),

  title: {
    default: "Simples Aprova.AI | Correção de Redações para Concursos",
    template: "%s | Simples Aprova.AI",
  },

  description:
    "Treine redações discursivas para concursos com feedback detalhado por inteligência artificial, análise de conteúdo, linguagem e estimativa de nota.",

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,
  },
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
