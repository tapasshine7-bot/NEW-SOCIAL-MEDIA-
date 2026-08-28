import { ArrowRight, Check, MessageSquareText, ShieldCheck, UsersRound, Waves } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/AppShell";
import Messages from "@/pages/Messages";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const account = trpc.account.me.useQuery(undefined, { enabled: isAuthenticated });
  useEffect(() => {
    if (isAuthenticated && account.data && !account.data.profile.onboardingCompletedAt) window.location.assign("/onboarding");
  }, [isAuthenticated, account.data?.profile.onboardingCompletedAt]);
  if (loading || (isAuthenticated && account.isLoading)) return <AppShell><div className="grid min-h-[65vh] place-items-center"><div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="chat-dot animate-pulse" />Preparing your conversations…</div></div></AppShell>;
  if (isAuthenticated) return <Messages />;
  return <WelcomeHome />;
}

function WelcomeHome() {
  return <AppShell compact><main className="mx-auto grid min-h-[calc(100dvh-8rem)] max-w-6xl items-center gap-12 py-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-20"><section className="max-w-xl"><div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary"><span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><MessageSquareText size={12} /></span>A calmer way to stay close</div><h1 className="mt-7 text-5xl font-semibold leading-[1.04] tracking-[-.065em] sm:text-6xl">Keep the conversation <span className="text-primary">moving.</span></h1><p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">Nuvora brings private chats, small groups, communities, and meaningful updates into one focused space. Open the app and start where people are already talking.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/signup"><Button className="h-12 rounded-xl px-5 text-base">Create your account <ArrowRight size={17} /></Button></Link><Link href="/login"><Button variant="outline" className="h-12 rounded-xl px-5 text-base">Sign in</Button></Link></div><div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-muted-foreground"><span className="inline-flex items-center gap-2"><Check size={15} className="text-primary" />Email and password only</span><span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-primary" />Private by default</span></div></section><section className="relative mx-auto w-full max-w-md"><div className="absolute -inset-5 rounded-[2.5rem] bg-primary/10 blur-3xl" /><div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-3 shadow-[0_24px_80px_rgba(20,73,57,.14)]"><div className="rounded-[1.5rem] bg-background p-4"><div className="flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-primary">Today</p><h2 className="mt-1 font-display text-xl font-semibold">Your chats</h2></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><MessageSquareText size={17} /></span></div><div className="mt-6 space-y-2"><PreviewChat name="Mina" message="I saved you a seat." time="09:42" tint="bg-amber-100 text-amber-800" /><PreviewChat name="Weekend crew" message="Three new messages" time="09:18" tint="bg-primary/15 text-primary" /><PreviewChat name="Studio notes" message="Voice note · 0:34" time="Yesterday" tint="bg-sky-100 text-sky-800" /></div><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-2xl border border-border bg-card p-3"><UsersRound size={17} className="text-primary" /><p className="mt-5 text-xs font-semibold">Small groups</p><p className="mt-1 text-[11px] text-muted-foreground">Plan together</p></div><div className="rounded-2xl border border-border bg-card p-3"><Waves size={17} className="text-primary" /><p className="mt-5 text-xs font-semibold">Updates</p><p className="mt-1 text-[11px] text-muted-foreground">Share lightly</p></div></div></div></div></section></main></AppShell>;
}

function PreviewChat({ name, message, time, tint }: { name: string; message: string; time: string; tint: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] text-sm font-bold ${tint}`}>{name.slice(0, 1)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{name}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{message}</span></span><span className="self-start pt-0.5 text-[10px] font-medium text-muted-foreground">{time}</span></div>;
}
