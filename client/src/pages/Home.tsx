import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, LockKeyhole, MessageCircleMore, Sparkles, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  const { isAuthenticated } = useAuth();
  const account = trpc.account.me.useQuery(undefined, { enabled: isAuthenticated });
  const [, navigate] = useLocation();
  useEffect(() => { if (isAuthenticated && account.data && !account.data.profile.onboardingCompletedAt) navigate("/onboarding", { replace: true }); }, [isAuthenticated, account.data?.profile.onboardingCompletedAt, navigate]);
  return <AppShell>{isAuthenticated ? <SignedInHome /> : <WelcomeHome />}</AppShell>;
}

function WelcomeHome() {
  return <div className="mx-auto flex min-h-[calc(100dvh-11rem)] max-w-md items-center"><section className="relative w-full overflow-hidden rounded-[2rem] border border-border bg-card px-7 py-11 text-center shadow-[0_24px_80px_rgba(42,34,104,.10)] sm:px-10"><div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(101,215,255,.42),rgba(99,91,255,.06)_56%,transparent_72%)] blur-xl" /><span className="relative mx-auto grid h-16 w-16 place-items-center rounded-[23px] bg-[linear-gradient(135deg,#6049ea,#a177ff_55%,#67d3ff)] text-2xl font-black text-white shadow-[0_12px_30px_rgba(99,91,255,.3)]">L</span><div className="relative"><p className="eyebrow mt-7">Social, in a softer light</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.05em]">A place for the people and moments that matter.</h1><p className="mt-5 text-sm leading-6 text-muted-foreground">Share your perspective, discover thoughtful voices, and keep conversations close.</p><div className="mt-8 grid gap-3"><Button className="h-12 rounded-xl text-base" onClick={startLogin}>Create account <ArrowUpRight size={17} /></Button><Button variant="outline" className="h-12 rounded-xl text-base" onClick={startLogin}>Log in</Button></div><p className="mt-5 text-xs leading-5 text-muted-foreground">Sign in securely with the configured account provider. Additional social providers appear only when configured.</p></div></section></div>;
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
