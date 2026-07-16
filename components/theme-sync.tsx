"use client";

import { useEffect } from "react";

type Tema = "light" | "dark" | "system";

const PREFERENCES_KEY =
  "discursiva-ai-preferencias";

function lerTemaSalvo(): Tema {
  try {
    const saved =
      window.localStorage.getItem(
        PREFERENCES_KEY,
      );

    if (!saved) {
      return "system";
    }

    const parsed = JSON.parse(saved) as {
      tema?: Tema;
    };

    return parsed.tema === "light" ||
      parsed.tema === "dark" ||
      parsed.tema === "system"
      ? parsed.tema
      : "system";
  } catch {
    return "system";
  }
}

function aplicarTema(tema: Tema) {
  const prefereEscuro =
    window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

  const usarEscuro =
    tema === "dark" ||
    (tema === "system" && prefereEscuro);

  document.documentElement.classList.toggle(
    "dark",
    usarEscuro,
  );

  document.documentElement.dataset.theme =
    tema;
}

export function ThemeSync() {
  useEffect(() => {
    const mediaQuery =
      window.matchMedia(
        "(prefers-color-scheme: dark)",
      );

    const sincronizar = () =>
      aplicarTema(lerTemaSalvo());

    const aoMudarSistema = () => {
      if (lerTemaSalvo() === "system") {
        sincronizar();
      }
    };

    const aoMudarStorage = (
      event: StorageEvent,
    ) => {
      if (
        event.key ===
        PREFERENCES_KEY
      ) {
        sincronizar();
      }
    };

    sincronizar();

    mediaQuery.addEventListener(
      "change",
      aoMudarSistema,
    );

    window.addEventListener(
      "storage",
      aoMudarStorage,
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        aoMudarSistema,
      );

      window.removeEventListener(
        "storage",
        aoMudarStorage,
      );
    };
  }, []);

  return null;
}
