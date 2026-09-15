/* app/settings/page.tsx
   Full Settings replacement for Inaivu.
   Keeps globals.css untouched.
*/
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { usePreferences, type LanguageCode, type ThemeMode } from "../providers";

type SettingState = {
  profile_visibility: "public" | "followers" | "private";
  show_online_status: boolean;
  allow_messages: boolean;
  notify_likes: boolean;
  notify_comments: boolean;
  notify_follows: boolean;
  notify_messages: boolean;
};

const LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: "auto", label: "Automatic", native: "Automatic" },
  { code: "en", label: "English", native: "English" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "ru", label: "Russian", native: "Русский" },
  { code: "ar", label: "Arabic", native: "العربية" },
];

const COPY: Record<string, Record<string, string>> = {
  en: {
    settings: "Settings",
    account: "Account",
    privacy: "Privacy & Safety",
    messages: "Messages",
    notifications: "Notifications",
    appearance: "Appearance",
    language: "Language & Region",
    loop: "Loop",
    data: "Data & Media",
    security: "Security",
    activity: "Your Activity",
    help: "Help & Support",
    about: "About Inaivu",
    profile: "Profile",
    editProfile: "Edit profile",
    visibility: "Profile visibility",
    online: "Show online status",
    allowMessages: "Allow messages",
    likes: "Likes",
    comments: "Comments",
    follows: "New followers",
    messageAlerts: "Messages",
    theme: "Theme",
    system: "System",
    light: "Light",
    dark: "Dark",
    languageLabel: "App language",
    save: "Saved",
    logout: "Log out",
    private: "Private",
    followers: "Followers",
    public: "Public",
    autoplay: "Autoplay videos",
    dataSaver: "Data saver",
    activityStatus: "Activity status",
    blocked: "Blocked accounts",
    downloads: "Downloads",
    storage: "Storage",
    clearCache: "Clear local cache",
    privacyNote: "Control who can find you, message you and see your activity.",
    appearanceNote: "Choose how Inaivu looks across the app.",
    languageNote: "Your language preference is saved to your Inaivu account.",
    loopNote: "Control your Loop viewing experience.",
    dataNote: "Manage media and local app data.",
    securityNote: "Account security and sign-in controls.",
    supportNote: "Get help with Inaivu.",
    version: "Inaivu • Built for connection",
  },
  ta: {
    settings: "அமைப்புகள்",
    account: "கணக்கு",
    privacy: "தனியுரிமை & பாதுகாப்பு",
    messages: "செய்திகள்",
    notifications: "அறிவிப்புகள்",
    appearance: "தோற்றம்",
    language: "மொழி & பகுதி",
    loop: "Loop",
    data: "தரவு & மீடியா",
    security: "பாதுகாப்பு",
    activity: "உங்கள் செயல்பாடு",
    help: "உதவி & ஆதரவு",
    about: "Inaivu பற்றி",
    profile: "சுயவிவரம்",
    editProfile: "சுயவிவரத்தை திருத்து",
    visibility: "சுயவிவரத் தெரிவுநிலை",
    online: "Online நிலையை காட்டு",
    allowMessages: "செய்திகளை அனுமதி",
    likes: "Likes",
    comments: "Comments",
    follows: "புதிய Followers",
    messageAlerts: "செய்திகள்",
    theme: "தீம்",
    system: "System",
    light: "Light",
    dark: "Dark",
    languageLabel: "App மொழி",
    save: "சேமிக்கப்பட்டது",
    logout: "வெளியேறு",
    private: "தனிப்பட்டது",
    followers: "Followers",
    public: "பொது",
    autoplay: "வீடியோ Auto-play",
    dataSaver: "Data saver",
    activityStatus: "Activity status",
    blocked: "தடுக்கப்பட்ட கணக்குகள்",
    downloads: "Downloads",
    storage: "Storage",
    clearCache: "Local cache-ஐ அழி",
    privacyNote: "உங்களை யார் கண்டுபிடிக்கலாம், செய்தி அனுப்பலாம் மற்றும் செயல்பாட்டைக் காணலாம் என்பதை கட்டுப்படுத்துங்கள்.",
    appearanceNote: "Inaivu முழுவதும் தோற்றத்தை தேர்வு செய்யுங்கள்.",
    languageNote: "உங்கள் மொழி விருப்பம் Inaivu கணக்கில் சேமிக்கப்படும்.",
    loopNote: "Loop வீடியோ அனுபவத்தை கட்டுப்படுத்துங்கள்.",
    dataNote: "Media மற்றும் local app data-ஐ நிர்வகிக்கவும்.",
    securityNote: "கணக்கு பாதுகாப்பு மற்றும் sign-in controls.",
    supportNote: "Inaivu உதவி பெறுங்கள்.",
    version: "Inaivu • இணைவதற்காக உருவாக்கப்பட்டது",
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { theme, setTheme, language, setLanguage } = usePreferences();

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; username: string | null; avatar_url: string | null } | null>(null);
  const [state, setState] = useState<SettingState>({
    profile_visibility: "public",
    show_online_status: true,
    allow_messages: true,
    notify_likes: true,
    notify_comments: true,
    notify_follows: true,
    notify_messages: true,
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState("account");

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      if (!alive) return;
      setUserId(user.id);

      const [profileResult, settingsResult] = await Promise.all([
        supabase.from("profiles").select("full_name, username, avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("profile_settings").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      if (profileResult.data) setProfile(profileResult.data);
      if (settingsResult.data) {
        setState((old) => ({
          ...old,
          ...settingsResult.data,
          profile_visibility: settingsResult.data.profile_visibility ?? old.profile_visibility,
          show_online_status: settingsResult.data.show_online_status ?? old.show_online_status,
          allow_messages: settingsResult.data.allow_messages ?? old.allow_messages,
          notify_likes: settingsResult.data.notify_likes ?? old.notify_likes,
          notify_comments: settingsResult.data.notify_comments ?? old.notify_comments,
          notify_follows: settingsResult.data.notify_follows ?? old.notify_follows,
          notify_messages: settingsResult.data.notify_messages ?? old.notify_messages,
        }));
      }
    }
    load();
    return () => { alive = false; };
  }, [router, supabase]);

  const langKey = language === "auto" ? "en" : language;
  const t = (key: string) => COPY[langKey]?.[key] ?? COPY.en[key] ?? key;

  async function save(patch: Partial<SettingState>) {
    if (!userId) return;
    const next = { ...state, ...patch };
    setState(next);
    setSaving(true);
    const { error } = await supabase.from("profile_settings").upsert(
      {
        user_id: userId,
        ...next,
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    setNotice(error ? error.message : t("save"));
    window.setTimeout(() => setNotice(""), 1800);
  }

  async function chooseLanguage(code: LanguageCode) {
    await setLanguage(code);
    setNotice("Language saved");
    window.setTimeout(() => setNotice(""), 1600);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function clearLocalData() {
    try {
      localStorage.removeItem("inaivu-loop-saved");
      localStorage.removeItem("inaivu-preferences");
      setNotice("Local data cleared");
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setNotice("Could not clear local data");
    }
  }

  const sections = [
    ["account", "◉", t("account")],
    ["privacy", "⌁", t("privacy")],
    ["messages", "✦", t("messages")],
    ["notifications", "♡", t("notifications")],
    ["appearance", "◐", t("appearance")],
    ["language", "文", t("language")],
    ["loop", "▶", t("loop")],
    ["data", "▣", t("data")],
    ["security", "⌾", t("security")],
    ["activity", "◷", t("activity")],
    ["help", "?", t("help")],
    ["about", "i", t("about")],
  ];

  return (
    <main className="inaivu-settings">
      <style jsx global>{`
        .inaivu-settings {
          min-height: 100vh;
          background: #f7f2ec;
          color: #25211e;
          padding: 24px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .settings-shell { width: min(1180px, 100%); margin: 0 auto; display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 22px; }
        .settings-sidebar, .settings-panel { background: #fffdf9; border: 1px solid #e7ddd4; border-radius: 28px; box-shadow: 0 14px 45px rgba(74,53,39,.07); }
        .settings-sidebar { padding: 14px; align-self: start; position: sticky; top: 24px; }
        .settings-brand { padding: 16px 14px 18px; border-bottom: 1px solid #eee5dc; margin-bottom: 10px; }
        .settings-brand b { font-size: 22px; letter-spacing: -.03em; }
        .settings-brand span { display:block; margin-top: 4px; color:#95877e; font-size:12px; }
        .settings-nav { display:flex; flex-direction:column; gap:4px; }
        .settings-nav button { border:0; background:transparent; color:#70645d; text-align:left; border-radius:16px; padding:11px 12px; font-weight:700; font-size:13px; cursor:pointer; display:flex; gap:10px; align-items:center; }
        .settings-nav button:hover { background:#faf2ec; color:#d85e40; }
        .settings-nav button.active { background:#fff0e9; color:#d65336; }
        .settings-panel { padding: 28px; min-width:0; }
        .settings-head { display:flex; align-items:center; gap:14px; padding-bottom:22px; border-bottom:1px solid #eee5dc; }
        .back-btn { border:1px solid #e7ddd4; background:#fff; border-radius:14px; width:40px; height:40px; cursor:pointer; font-size:18px; }
        .settings-head h1 { margin:0; font-size:30px; letter-spacing:-.04em; }
        .settings-head p { margin:4px 0 0; color:#91847c; font-size:13px; }
        .section-title { margin:28px 0 10px; font-size:12px; font-weight:900; color:#a08f85; text-transform:uppercase; letter-spacing:.12em; }
        .setting-card { border:1px solid #e9dfd7; background:#fff; border-radius:20px; overflow:hidden; }
        .setting-row { width:100%; display:flex; align-items:center; justify-content:space-between; gap:18px; padding:17px 18px; border:0; border-bottom:1px solid #eee6df; background:transparent; text-align:left; }
        .setting-row:last-child { border-bottom:0; }
        .setting-row strong { display:block; font-size:14px; }
        .setting-row small { display:block; margin-top:4px; color:#95877e; line-height:1.45; font-size:12px; }
        .setting-action { color:#d85e40; font-weight:800; font-size:13px; white-space:nowrap; }
        .toggle { width:48px; height:28px; border:0; border-radius:999px; background:#d9d0c8; padding:3px; cursor:pointer; flex:none; }
        .toggle i { display:block; width:22px; height:22px; border-radius:50%; background:#fff; transition:transform .18s ease; box-shadow:0 2px 5px rgba(0,0,0,.14); }
        .toggle.on { background:#ef704d; }
        .toggle.on i { transform:translateX(20px); }
        .select { border:1px solid #e5dad1; background:#faf7f3; color:#3e3732; border-radius:12px; padding:9px 11px; font-weight:700; outline:none; }
        .theme-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
        .theme-card { border:1px solid #e7ddd4; border-radius:18px; padding:16px; background:#fff; cursor:pointer; text-align:left; }
        .theme-card.active { border-color:#ef704d; box-shadow:0 0 0 2px rgba(239,112,77,.12); }
        .theme-dot { width:38px; height:38px; border-radius:12px; margin-bottom:12px; border:1px solid #ddd; }
        .theme-dot.system { background:linear-gradient(135deg,#fff 50%,#211b18 50%); }
        .theme-dot.light { background:#fff8f1; }
        .theme-dot.dark { background:#171310; }
        .theme-card strong { display:block; font-size:13px; }
        .language-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding:12px; }
        .lang-btn { border:1px solid #ebe1d9; background:#fff; border-radius:15px; padding:12px; cursor:pointer; text-align:left; display:flex; align-items:center; justify-content:space-between; }
        .lang-btn:hover { border-color:#efb09c; }
        .lang-btn.active { border-color:#ef704d; background:#fff3ee; }
        .lang-btn b { display:block; font-size:13px; }
        .lang-btn span { display:block; color:#9a8b82; font-size:11px; margin-top:2px; }
        .danger { color:#c84d38 !important; }
        .notice { position:fixed; left:50%; bottom:28px; transform:translateX(-50%); background:#25211e; color:white; border-radius:999px; padding:11px 17px; font-size:13px; font-weight:800; box-shadow:0 15px 40px rgba(0,0,0,.2); z-index:100; }
        html.dark .inaivu-settings { background:#0f0c0a; color:#f7f1eb; }
        html.dark .settings-sidebar, html.dark .settings-panel { background:#181411; border-color:rgba(255,255,255,.09); box-shadow:0 18px 55px rgba(0,0,0,.28); }
        html.dark .settings-brand, html.dark .settings-head { border-color:rgba(255,255,255,.08); }
        html.dark .settings-brand span, html.dark .settings-head p, html.dark .setting-row small { color:rgba(255,255,255,.55); }
        html.dark .settings-nav button { color:rgba(255,255,255,.66); }
        html.dark .settings-nav button:hover { background:#241d19; color:#ff8a68; }
        html.dark .settings-nav button.active { background:#30201a; color:#ff8a68; }
        html.dark .back-btn, html.dark .setting-card, html.dark .theme-card, html.dark .lang-btn { background:#211b18; color:#f7f1eb; border-color:rgba(255,255,255,.09); }
        html.dark .setting-row { border-color:rgba(255,255,255,.08); }
        html.dark .select { background:#211b18; color:#fff; border-color:rgba(255,255,255,.1); }
        html.dark .lang-btn span { color:rgba(255,255,255,.48); }
        html.dark .lang-btn.active { background:#30201a; border-color:#ef704d; }
        html.dark .theme-card.active { border-color:#ef704d; }
        @media (max-width: 820px) {
          .inaivu-settings { padding:12px; }
          .settings-shell { grid-template-columns:1fr; gap:12px; }
          .settings-sidebar { position:static; padding:10px; }
          .settings-nav { display:grid; grid-template-columns:repeat(3,1fr); }
          .settings-nav button { justify-content:center; padding:10px 5px; font-size:11px; }
          .settings-nav button span:last-child { display:none; }
          .settings-brand { display:none; }
          .settings-panel { padding:18px; border-radius:22px; }
          .settings-head h1 { font-size:25px; }
          .theme-grid { grid-template-columns:1fr; }
          .language-grid { grid-template-columns:1fr; }
        }
      `}</style>

      <div className="settings-shell">
        <aside className="settings-sidebar">
          <div className="settings-brand">
            <b>இணைவு</b>
            <span>Inaivu settings</span>
          </div>
          <nav className="settings-nav">
            {sections.map(([id, icon, label]) => (
              <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}>
                <span>{icon}</span><span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="settings-panel">
          <header className="settings-head">
            <button className="back-btn" onClick={() => router.push("/")}>←</button>
            <div>
              <h1>{t("settings")}</h1>
              <p>{saving ? "Saving…" : "Your preferences are synced with your Inaivu account."}</p>
            </div>
          </header>

          {active === "account" && <>
            <div className="section-title">{t("account")}</div>
            <div className="setting-card">
              <button className="setting-row" onClick={() => router.push("/profile")}>
                <div><strong>{t("profile")}</strong><small>{profile?.full_name || "Your Inaivu profile"} {profile?.username ? `· @${profile.username}` : ""}</small></div>
                <span className="setting-action">Open →</span>
              </button>
              <button className="setting-row" onClick={() => router.push("/profile/edit")}>
                <div><strong>{t("editProfile")}</strong><small>Change your name, username, bio and avatar.</small></div>
                <span className="setting-action">Edit →</span>
              </button>
              <button className="setting-row danger" onClick={logout}>
                <div><strong>{t("logout")}</strong><small>Sign out from this Inaivu account.</small></div>
                <span className="setting-action danger">Sign out</span>
              </button>
            </div>
          </>}

          {active === "privacy" && <>
            <div className="section-title">{t("privacy")}</div>
            <p className="mb-4 text-sm opacity-65">{t("privacyNote")}</p>
            <div className="setting-card">
              <div className="setting-row">
                <div><strong>{t("visibility")}</strong><small>Choose who can view your profile.</small></div>
                <select className="select" value={state.profile_visibility} onChange={(e) => save({ profile_visibility: e.target.value as SettingState["profile_visibility"] })}>
                  <option value="public">{t("public")}</option><option value="followers">{t("followers")}</option><option value="private">{t("private")}</option>
                </select>
              </div>
              <div className="setting-row"><div><strong>{t("online")}</strong><small>Show whether you are currently online.</small></div><button className={`toggle ${state.show_online_status ? "on" : ""}`} onClick={() => save({ show_online_status: !state.show_online_status })}><i /></button></div>
              <div className="setting-row"><div><strong>{t("allowMessages")}</strong><small>Let other Inaivu members start conversations.</small></div><button className={`toggle ${state.allow_messages ? "on" : ""}`} onClick={() => save({ allow_messages: !state.allow_messages })}><i /></button></div>
            </div>
          </>}

          {active === "messages" && <>
            <div className="section-title">{t("messages")}</div>
            <div className="setting-card">
              <div className="setting-row"><div><strong>{t("allowMessages")}</strong><small>Control who can start a direct conversation.</small></div><button className={`toggle ${state.allow_messages ? "on" : ""}`} onClick={() => save({ allow_messages: !state.allow_messages })}><i /></button></div>
              <button className="setting-row" onClick={() => router.push("/messages")}><div><strong>Open Messages</strong><small>Go to your conversations.</small></div><span className="setting-action">Open →</span></button>
            </div>
          </>}

          {active === "notifications" && <>
            <div className="section-title">{t("notifications")}</div>
            <div className="setting-card">
              {([["notify_likes","likes"],["notify_comments","comments"],["notify_follows","follows"],["notify_messages","messageAlerts"]] as const).map(([field,label]) => (
                <div className="setting-row" key={field}><div><strong>{t(label)}</strong><small>Receive an alert when this activity happens.</small></div><button className={`toggle ${state[field] ? "on" : ""}`} onClick={() => save({ [field]: !state[field] } as Partial<SettingState>)}><i /></button></div>
              ))}
              <button className="setting-row" onClick={() => router.push("/notifications")}><div><strong>Open notifications</strong><small>View your recent activity alerts.</small></div><span className="setting-action">Open →</span></button>
            </div>
          </>}

          {active === "appearance" && <>
            <div className="section-title">{t("appearance")}</div>
            <p className="mb-4 text-sm opacity-65">{t("appearanceNote")}</p>
            <div className="theme-grid">
              {([["system",t("system")],["light",t("light")],["dark",t("dark")]] as [ThemeMode,string][]).map(([value,label]) => (
                <button key={value} className={`theme-card ${theme === value ? "active" : ""}`} onClick={() => setTheme(value)}>
                  <div className={`theme-dot ${value}`} /><strong>{label}</strong>
                </button>
              ))}
            </div>
          </>}

          {active === "language" && <>
            <div className="section-title">{t("language")}</div>
            <p className="mb-4 text-sm opacity-65">{t("languageNote")}</p>
            <div className="setting-card">
              <div className="language-grid">
                {LANGUAGES.map((item) => (
                  <button key={item.code} className={`lang-btn ${language === item.code ? "active" : ""}`} onClick={() => chooseLanguage(item.code)}>
                    <div><b>{item.native}</b><span>{item.label}</span></div>
                    {language === item.code && <strong className="text-[#ef704d]">✓</strong>}
                  </button>
                ))}
              </div>
            </div>
          </>}

          {active === "loop" && <>
            <div className="section-title">{t("loop")}</div>
            <p className="mb-4 text-sm opacity-65">{t("loopNote")}</p>
            <div className="setting-card">
              <div className="setting-row"><div><strong>{t("autoplay")}</strong><small>Loop videos start when they become visible.</small></div><button className="toggle on"><i /></button></div>
              <button className="setting-row" onClick={() => router.push("/loop")}><div><strong>Open Loop</strong><small>Watch and create short videos.</small></div><span className="setting-action">Open →</span></button>
            </div>
          </>}

          {active === "data" && <>
            <div className="section-title">{t("data")}</div>
            <p className="mb-4 text-sm opacity-65">{t("dataNote")}</p>
            <div className="setting-card">
              <div className="setting-row"><div><strong>{t("dataSaver")}</strong><small>Use less mobile data when possible.</small></div><button className="toggle"><i /></button></div>
              <div className="setting-row"><div><strong>{t("storage")}</strong><small>Media is stored in your connected cloud storage.</small></div><span className="setting-action">Supabase</span></div>
              <button className="setting-row" onClick={clearLocalData}><div><strong>{t("clearCache")}</strong><small>Remove local preferences and saved Loop cache from this browser.</small></div><span className="setting-action">Clear</span></button>
            </div>
          </>}

          {active === "security" && <>
            <div className="section-title">{t("security")}</div>
            <p className="mb-4 text-sm opacity-65">{t("securityNote")}</p>
            <div className="setting-card">
              <div className="setting-row"><div><strong>Authentication</strong><small>Inaivu uses Supabase authentication for your account session.</small></div><span className="setting-action">Protected</span></div>
              <button className="setting-row" onClick={logout}><div><strong>Sign out</strong><small>End the current session on this browser.</small></div><span className="setting-action danger">Log out</span></button>
            </div>
          </>}

          {active === "activity" && <>
            <div className="section-title">{t("activity")}</div>
            <div className="setting-card">
              <button className="setting-row" onClick={() => router.push("/profile")}><div><strong>Your profile</strong><small>Review what other people can see.</small></div><span className="setting-action">View →</span></button>
              <button className="setting-row" onClick={() => router.push("/notifications")}><div><strong>Recent activity</strong><small>Likes, follows, comments and messages.</small></div><span className="setting-action">View →</span></button>
            </div>
          </>}

          {active === "help" && <>
            <div className="section-title">{t("help")}</div>
            <p className="mb-4 text-sm opacity-65">{t("supportNote")}</p>
            <div className="setting-card">
              <button className="setting-row" onClick={() => setNotice("Help center is coming soon.")}><div><strong>Help center</strong><small>Find answers about using Inaivu.</small></div><span className="setting-action">Open →</span></button>
              <button className="setting-row" onClick={() => setNotice("Feedback option is coming soon.")}><div><strong>Send feedback</strong><small>Tell us what should improve.</small></div><span className="setting-action">Send →</span></button>
            </div>
          </>}

          {active === "about" && <>
            <div className="section-title">{t("about")}</div>
            <div className="setting-card">
              <div className="setting-row"><div><strong>Inaivu</strong><small>{t("version")}</small></div><span className="setting-action">v1.0</span></div>
              <button className="setting-row" onClick={() => setNotice("Terms page is coming soon.")}><div><strong>Terms of service</strong><small>How Inaivu can be used.</small></div><span className="setting-action">Open →</span></button>
              <button className="setting-row" onClick={() => setNotice("Privacy page is coming soon.")}><div><strong>Privacy policy</strong><small>How account and activity data is handled.</small></div><span className="setting-action">Open →</span></button>
            </div>
          </>}
        </section>
      </div>

      {notice && <div className="notice">{notice}</div>}
    </main>
  );
}
