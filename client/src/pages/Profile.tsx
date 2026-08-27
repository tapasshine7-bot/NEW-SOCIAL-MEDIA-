import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Loader2, PencilLine, Settings } from "lucide-react";
import { Link } from "wouter";

export default function Profile() {
  const { isAuthenticated, loading } = useAuth();
  const profile = trpc.account.me.useQuery(undefined, { enabled: isAuthenticated });
  if (loading) return <AppShell compact><div className="grid min-h-[55vh] place-items-center"><Loader2 className="animate-spin text-primary" /></div></AppShell>;
  if (!isAuthenticated) return <AppShell compact><section className="surface-panel mx-auto max-w-lg px-6 py-12 text-center"><p className="eyebrow">Your space</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to shape your profile.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Your identity and preferences are protected behind your secure session.</p><Button className="mt-7 rounded-full px-6" onClick={startLogin}>Continue securely</Button></section></AppShell>;
  if (profile.isLoading) return <AppShell compact><div className="grid min-h-[55vh] place-items-center"><Loader2 className="animate-spin text-primary" /></div></AppShell>;
  if (profile.isError) return <AppShell compact><section className="surface-panel mx-auto max-w-lg px-6 py-12 text-center"><h1 className="text-xl font-semibold">We couldn’t load your profile.</h1><p className="mt-3 text-sm text-muted-foreground">Please refresh and try again.</p></section></AppShell>;
  const p = profile.data?.profile;
  return <AppShell><section className="surface-panel mx-auto max-w-2xl overflow-hidden"><div className="h-28 bg-[radial-gradient(circle_at_15%_15%,rgba(101,215,255,.65),transparent_26%),radial-gradient(circle_at_77%_40%,rgba(185,123,255,.7),transparent_30%),#5a52de]" /><div className="px-6 pb-7 sm:px-9"><div className="-mt-11 flex items-end justify-between"><div className="grid h-22 w-22 place-items-center rounded-[28px] border-4 border-card bg-secondary text-2xl font-semibold text-secondary-foreground">{p?.displayName?.slice(0, 1).toUpperCase() || "L"}</div><Link href="/settings" className="mb-2 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium transition hover:bg-accent"><PencilLine size={15} />Edit profile</Link></div><div className="mt-5"><p className="text-xl font-semibold tracking-tight">{p?.displayName}</p><p className="mt-0.5 text-sm text-muted-foreground">@{p?.username}</p>{p?.bio && <p className="mt-4 max-w-xl text-sm leading-6">{p.bio}</p>}{p?.website && <a href={p.website} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">{p.website.replace(/^https?:\/\//, "")}</a>}</div><div className="mt-7 grid max-w-sm grid-cols-3 divide-x divide-border text-center"><div><p className="font-semibold">{p?.postsCount ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">Posts</p></div><div><p className="font-semibold">{p?.followersCount ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">Followers</p></div><div><p className="font-semibold">{p?.followingCount ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">Following</p></div></div></div></section></AppShell>;
}
