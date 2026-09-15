/* app/providers.tsx
   Full preference provider replacement.
   Stores theme/language locally first, then syncs to profile_settings.
*/
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase";

export type ThemeMode = "system" | "light" | "dark";

export type LanguageCode =
  | "auto" | "en" | "ta" | "hi" | "te" | "kn" | "ml" | "bn" | "mr"
  | "gu" | "pa" | "ur" | "zh" | "ja" | "ko" | "es" | "fr" | "de" | "pt"
  | "ru" | "ar";

type Preferences = {
  theme: ThemeMode;
  language: LanguageCode;
};

type PreferencesContextValue = Preferences & {
  setTheme: (value: ThemeMode) => Promise<void>;
  setLanguage: (value: LanguageCode) => Promise<void>;
};

const DEFAULTS: Preferences = {
  theme: "system",
  language: "en",
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  const body = document.body;

  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  root.classList.remove("light", "dark");
  body.classList.remove("light", "dark");
  root.classList.add(resolved);
  body.classList.add(resolved);

  root.dataset.theme = resolved;
  body.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    let alive = true;

    try {
      const raw = localStorage.getItem("inaivu-preferences");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        if (alive) {
          setPreferences({
            theme:
              parsed.theme === "dark" ||
              parsed.theme === "light" ||
              parsed.theme === "system"
                ? parsed.theme
                : DEFAULTS.theme,
            language:
              typeof parsed.language === "string"
                ? (parsed.language as LanguageCode)
                : DEFAULTS.language,
          });
        }
      }
    } catch {}

    async function loadRemote() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !alive) return;

      const { data } = await supabase
        .from("profile_settings")
        .select("appearance, language")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!alive || !data) return;

      const remoteTheme =
        data.appearance === "dark" ||
        data.appearance === "light" ||
        data.appearance === "system"
          ? (data.appearance as ThemeMode)
          : null;

      const remoteLanguage =
        typeof data.language === "string"
          ? (data.language as LanguageCode)
          : null;

      setPreferences((current) => {
        const next = {
          theme: remoteTheme ?? current.theme,
          language: remoteLanguage ?? current.language,
        };

        try {
          localStorage.setItem("inaivu-preferences", JSON.stringify(next));
        } catch {}

        return next;
      });
    }

    loadRemote();

    return () => {
      alive = false;
    };
  }, [supabase]);

  useEffect(() => {
    applyTheme(preferences.theme);

    if (preferences.theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("system");

    media.addEventListener?.("change", listener);
    return () => media.removeEventListener?.("change", listener);
  }, [preferences.theme]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "inaivu-preferences",
        JSON.stringify(preferences),
      );
    } catch {}
  }, [preferences]);

  async function setTheme(theme: ThemeMode) {
    setPreferences((current) => ({ ...current, theme }));

    try {
      localStorage.setItem(
        "inaivu-preferences",
        JSON.stringify({
          ...preferences,
          theme,
        }),
      );
    } catch {}

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("profile_settings").upsert(
      {
        user_id: user.id,
        appearance: theme,
      },
      { onConflict: "user_id" },
    );
  }

  async function setLanguage(language: LanguageCode) {
    setPreferences((current) => ({ ...current, language }));

    try {
      localStorage.setItem(
        "inaivu-preferences",
        JSON.stringify({
          ...preferences,
          language,
        }),
      );
    } catch {}

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("profile_settings").upsert(
      {
        user_id: user.id,
        language,
      },
      { onConflict: "user_id" },
    );
  }

  const value = useMemo(
    () => ({
      theme: preferences.theme,
      language: preferences.language,
      setTheme,
      setLanguage,
    }),
    [preferences],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const value = useContext(PreferencesContext);

  if (!value) {
    throw new Error(
      "usePreferences must be used inside PreferencesProvider",
    );
  }

  return value;
}
