import { ArrowRight, LockKeyhole } from "lucide-react";
import { Link } from "wouter";

export function ComingOnline({ title, description, actionHref = "/" }: { title: string; description: string; actionHref?: string }) {
  return <section className="surface-panel mx-auto max-w-xl px-6 py-11 text-center sm:px-10"><div className="mx-auto mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole size={20} /></div><h1 className="text-xl font-semibold tracking-tight">{title}</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p><Link href={actionHref} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-primary/80">Return to your space <ArrowRight size={16} /></Link></section>;
}
