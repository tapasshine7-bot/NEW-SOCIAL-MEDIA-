import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, LockKeyhole, MessageCircleMore, Sparkles, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  const { isAuthenticated } = useAuth();
  return <AppShell>{isAuthenticated ? <SignedInHome /> : <WelcomeHome />}</AppShell>;
}

function WelcomeHome() {
  return <div className="mx-auto max-w-5xl"><section className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-14 shadow-[0_24px_80px_rgba(42,34,104,.10)] sm:px-10 lg:px-14 lg:py-20"><div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(101,215,255,.42),rgba(99,91,255,.06)_54%,transparent_72%)] blur-2xl" /><div className="relative max-w-2xl"><p className="eyebrow">A quieter way to connect</p><h1 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-5xl lg:text-6xl">Share what matters. <span className="text-primary">Keep the rest close.</span></h1><p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">Luma is a thoughtful social space for sharing, discovering people, and holding conversations that feel more human.</p><div className="mt-9 flex flex-wrap gap-3"><Button className="rounded-full px-6" onClick={startLogin}>Enter Luma <ArrowUpRight size={16} /></Button><Link href="/explore" className="inline-flex h-10 items-center rounded-full border border-border bg-background px-5 text-sm font-semibold transition hover:bg-accent">Explore the space</Link></div></div></section><section className="mt-6 grid gap-4 md:grid-cols-3"><ValueCard icon={Sparkles} title="A considered feed" text="Create a calmer, more meaningful social rhythm." /><ValueCard icon={MessageCircleMore} title="Conversations with context" text="Messages, replies, and groups—kept deliberately organized." /><ValueCard icon={LockKeyhole} title="Privacy by default" text="Clear account controls, secure sessions, and member-first choices." /></section></div>;
}

function SignedInHome() {
  const [page, setPage] = useState(0);
  const [loadedPosts, setLoadedPosts] = useState<FeedPost[]>([]);
  const feedInput = useMemo(() => ({ page, pageSize: 10 }), [page]);
  const feed = trpc.social.feed.useQuery(feedInput);
  useEffect(() => { if (feed.data) setLoadedPosts(current => page === 0 ? feed.data as FeedPost[] : [...current, ...(feed.data as FeedPost[])].filter((post, index, all) => all.findIndex(item => item.publicId === post.publicId) === index)); }, [feed.data, page]);
  const reloadFeed = () => { setLoadedPosts([]); setPage(0); void feed.refetch(); };
  const hasMore = (feed.data?.length ?? 0) === 10;
  return <div className="mx-auto grid max-w-5xl gap-7 lg:grid-cols-[minmax(0,1fr)_240px]"><div className="space-y-5"><PostComposer onPublished={reloadFeed} />{feed.isLoading && page === 0 ? <FeedSkeleton /> : feed.isError && page === 0 ? <section className="surface-panel px-6 py-10 text-center"><h1 className="font-semibold">We couldn’t reach your feed.</h1><Button variant="outline" className="mt-5 rounded-full" onClick={() => feed.refetch()}>Try again</Button></section> : loadedPosts.length ? <>{loadedPosts.map(post => <PostCard key={post.publicId} post={post} signedIn onMutate={reloadFeed} />)}{hasMore && <div className="pt-1 text-center"><Button variant="outline" className="rounded-full" disabled={feed.isFetching} onClick={() => setPage(current => current + 1)}>{feed.isFetching ? "Loading…" : "Load more"}</Button></div>}</> : <section className="surface-panel px-6 py-12 text-center sm:px-10"><UsersRound className="mx-auto h-7 w-7 text-primary" /><p className="eyebrow mt-5">Your feed</p><h1 className="mt-3 text-2xl font-semibold tracking-tight">Your community is ready to take shape.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Follow people or publish your first post to begin tailoring your Luma feed.</p><Link href="/explore" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">Find people <ArrowUpRight size={16} /></Link></section>}</div><aside className="hidden lg:block"><section className="sticky top-24 surface-panel p-5"><p className="eyebrow">Built for your pace</p><h2 className="mt-3 text-lg font-semibold tracking-tight">A more intentional social space.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Share in your own time. Luma keeps privacy controls and meaningful conversations close at hand.</p></section></aside></div>;
}

function FeedSkeleton() { return <div className="space-y-5">{[0, 1].map(item => <div className="surface-panel animate-pulse p-5" key={item}><div className="h-10 w-40 rounded-xl bg-muted" /><div className="mt-4 aspect-square rounded-2xl bg-muted" /><div className="mt-4 h-4 w-2/3 rounded bg-muted" /></div>)}</div>; }

function ValueCard({ icon: Icon, title, text }: { icon: typeof Sparkles; title: string; text: string }) { return <article className="surface-panel px-5 py-6"><Icon size={20} className="text-primary" /><h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></article>; }
