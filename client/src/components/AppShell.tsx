import { Link, useLocation } from "wouter";
import { Bell, Clapperboard, Compass, House, Laptop, MessageCircle, Moon, Plus, Sun, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "@/contexts/ThemeContext";

const navigation = [
  { href: "/", label: "Home", icon: House },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/reels", label: "Reels", icon: Clapperboard },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/notifications", label: "Activity", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserRound },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Color theme">
      <button type="button" onClick={() => setTheme?.("light")} className={`grid h-8 w-8 place-items-center rounded-full ${theme === "light" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`} aria-label="Use light theme"><Sun size={15} /></button>
      <button type="button" onClick={() => setTheme?.("system")} className={`grid h-8 w-8 place-items-center rounded-full ${theme === "system" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`} aria-label="Use system theme"><Laptop size={15} /></button>
      <button type="button" onClick={() => setTheme?.("dark")} className={`grid h-8 w-8 place-items-center rounded-full ${theme === "dark" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`} aria-label="Use dark theme"><Moon size={15} /></button>
    </div>
  );
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
function InstallButton() { const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null); useEffect(() => { const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); }; window.addEventListener("beforeinstallprompt", capture); return () => window.removeEventListener("beforeinstallprompt", capture); }, []); if (!prompt) return null; return <button type="button" className="hidden h-9 items-center rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground sm:inline-flex" onClick={async () => { await prompt.prompt(); setPrompt(null); }}>Install app</button>; }

export function AppShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  const [location] = useLocation();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="luma-mark grid h-8 w-8 place-items-center rounded-[12px] bg-[linear-gradient(135deg,#635BFF,#B97BFF_55%,#65D7FF)] text-sm font-black text-white shadow-[0_8px_22px_rgba(99,91,255,0.28)]">L</span>
            <span className="text-[1.05rem]">luma</span>
          </Link>
          {!compact && <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {navigation.slice(0, 2).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${location === href ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}><Icon size={16} />{label}</Link>)}
            <Link href="/create" className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${location === "/create" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}><Plus size={16} />Create</Link>
            {navigation.slice(3, 5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${location === href ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}><Icon size={16} />{label}</Link>)}
          </nav>}
          <div className="flex items-center gap-1"><div className="flex md:hidden"><Link href="/messages" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Open messages"><MessageCircle size={19} /></Link><Link href="/notifications" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Open activity"><Bell size={19} /></Link></div><InstallButton /><div className="hidden sm:block"><ThemeToggle /></div><Link href="/profile" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground" aria-label="Open profile"><UserRound size={17} /></Link></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-9">{children}</main>
      {!compact && <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/90 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:hidden" aria-label="Mobile navigation"><div className="mx-auto flex max-w-lg items-center justify-around">{navigation.slice(0, 2).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-w-[56px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition ${location === href ? "text-primary" : "text-muted-foreground"}`}><Icon size={20} strokeWidth={location === href ? 2.5 : 2} /><span>{label}</span></Link>)}<Link href="/create" className={`-mt-5 flex min-w-[62px] flex-col items-center gap-1 text-[10px] font-semibold ${location === "/create" ? "text-primary" : "text-muted-foreground"}`}><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_9px_22px_rgba(99,91,255,.34)]"><Plus size={23} /></span><span>Create</span></Link>{navigation.slice(2, 3).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-w-[56px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition ${location === href ? "text-primary" : "text-muted-foreground"}`}><Icon size={20} strokeWidth={location === href ? 2.5 : 2} /><span>Videos</span></Link>)}{navigation.slice(5, 6).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-w-[56px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition ${location === href ? "text-primary" : "text-muted-foreground"}`}><Icon size={20} strokeWidth={location === href ? 2.5 : 2} /><span>{label}</span></Link>)}</div></nav>}
    </div>
  );
}
