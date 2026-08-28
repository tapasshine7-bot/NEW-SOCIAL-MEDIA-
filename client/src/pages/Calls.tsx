import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowRight, PhoneCall, ShieldCheck, Video } from "lucide-react";
import { Link } from "wouter";

export default function Calls() {
  return <AppShell><section className="mx-auto max-w-5xl"><div><p className="eyebrow">Voice and video</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.05em] sm:text-4xl">Calls</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">A clear place for call history today, and a dependable calling layer when realtime media is connected.</p></div><section className="surface-panel mt-7 overflow-hidden"><div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_18rem] lg:items-center"><div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><PhoneCall size={22} /></span><h2 className="mt-6 text-2xl font-semibold tracking-tight">Calling is not enabled yet</h2><p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Nuvora does not currently have a realtime voice or video provider configured. We won’t show fake call buttons or pretend a call was placed. When a provider is connected, this section is ready to surface incoming, outgoing, missed, voice, and video history.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/messages"><Button className="rounded-xl">Open a chat <ArrowRight size={16} /></Button></Link><Link href="/settings"><Button variant="outline" className="rounded-xl">View settings</Button></Link></div></div><div className="grid gap-3"><CallCapability icon={PhoneCall} label="Voice calls" /><CallCapability icon={Video} label="Video calls" /><CallCapability icon={ShieldCheck} label="Permission-aware" /></div></div><div className="border-t border-border bg-muted/30 px-6 py-4 text-xs leading-5 text-muted-foreground sm:px-9">Integration note: configure a WebRTC or managed realtime media service on the server before exposing call actions.</div></section></section></AppShell>;
}

function CallCapability({ icon: Icon, label }: { icon: typeof PhoneCall; label: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm font-semibold"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={17} /></span>{label}</div>;
}
