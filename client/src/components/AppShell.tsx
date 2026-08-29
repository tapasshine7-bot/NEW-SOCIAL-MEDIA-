import { Bell, CircleUserRound, Laptop, MessageSquareText, Moon, Search, Sun, UsersRound, Waves } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";

const navigation = [
  { href: "/", label: "Chats", icon: MessageSquareText },
  { href: "/updates", label: "Updates", icon: Waves },
  { href: "/communities", label: "Communities", icon: UsersRound },
  { href: "/profile", label: "Profile", icon: CircleUserRound },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Color theme">
      <button type="button" onClick={() => setTheme?.("light")} className={`grid h-8 w-8 place-items-center rounded-full ${theme === "light" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`} aria-label="Use light theme"><Sun size={15} /></button>
      <button type="button" onClick={() => setTheme?.("system")} className={`grid h-8 w-8 place-items-center rounded-full ${theme === "system" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`} aria-label="Use system theme"><Laptop size={15} /></button>
      <button type="button" onClick={() => setTheme?.("dark")} className={`grid h-8 w-8 place-items-center rounded-full ${theme === "dark" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`} aria-label="Use dark theme"><Moon size={15} /></button>
    </div>
  );
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);
  if (!prompt) return null;
  return <button type="button" className="inline-flex h-9 items-center rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground" onClick={async () => { await prompt.prompt(); setPrompt(null); }}>Install app</button>;
}

export function AppShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  const [location] = useLocation();
  return (
    <div className="relative isolate min-h-dvh bg-transparent text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight" aria-label="Nuvora home">
            <span className="nuvora-mark grid h-9 w-9 place-items-center rounded-[13px] bg-primary text-primary-foreground shadow-[0_8px_22px_color-mix(in_oklch,var(--primary)_32%,transparent)]"><MessageSquareText size={18} strokeWidth={2.5} /></span>
            <span className="font-display text-[1.1rem] tracking-[-.03em]">nuvora</span>
          </Link>
          {!compact && <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {navigation.slice(0, 4).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${location === href || (href === "/updates" && location === "/stories") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Icon size={16} />{label}</Link>)}
          </nav>}
          <div className="flex items-center gap-1.5">
            {!compact && <Link href="/explore" className="hidden h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground sm:grid" aria-label="Search people and topics"><Search size={18} /></Link>}
            <Link href="/notifications" className="hidden h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground sm:grid" aria-label="Open notifications"><Bell size={18} /></Link>
            <InstallButton />
            <div className="hidden sm:block"><ThemeToggle /></div>
            <Link href="/accounts" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary/40 hover:text-foreground" aria-label="Open account center"><CircleUserRound size={17} /></Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
      {!compact && <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden" aria-label="Mobile navigation"><div className="mx-auto grid max-w-lg grid-cols-4 items-center gap-1">{navigation.map(({ href, label, icon: Icon }) => { const active = location === href || (href === "/updates" && location === "/stories"); return <Link key={href} href={href} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition ${active ? "text-primary" : "text-muted-foreground"}`} aria-current={active ? "page" : undefined}><Icon size={19} strokeWidth={active ? 2.5 : 2} /><span className="truncate">{label}</span></Link>; })}</div></nav>}
    </div>
  );
}
