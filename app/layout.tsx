import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://simplesaprova.com.br"),

  title: {
    default: "Simples Aprova.AI | Correção de Redações para Concursos",
    template: "%s | Simples Aprova.AI",
  },

  description:
    "Treine redações discursivas para concursos com feedback detalhado por inteligência artificial, análise de conteúdo, linguagem e estimativa de nota.",

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,
  },

  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },

  openGraph: {
    title: "Simples Aprova.AI",
    description:
      "Correção de redações para concursos com feedback detalhado por inteligência artificial.",
    url: "https://simplesaprova.com.br",
    siteName: "Simples Aprova.AI",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
