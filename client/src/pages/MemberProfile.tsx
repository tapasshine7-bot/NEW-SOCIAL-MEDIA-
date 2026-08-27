import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Ban, Loader2, MoreHorizontal } from "lucide-react";
import { useRoute } from "wouter";
import { toast } from "sonner";

export default function MemberProfile() {
  const [, params] = useRoute("/u/:username");
  const username = params?.username ?? "";
  const { isAuthenticated } = useAuth();
  const profile = trpc.account.byUsername.useQuery({ username }, { enabled: Boolean(username) });
  const block = trpc.account.block.useMutation({ onSuccess: () => toast.success("Member blocked.") });
  const follow = trpc.social.follow.useMutation({ onSuccess: result => toast.success(result.state === "requested" ? "Follow request sent." : "Following member."), onError: error => toast.error(error.message) });
  const unfollow = trpc.social.unfollow.useMutation({ onSuccess: () => toast.success("No longer following this member."), onError: error => toast.error(error.message) });
  const relationship = trpc.social.relationship.useQuery({ username }, { enabled: isAuthenticated && Boolean(username) });
  if (profile.isLoading) return <AppShell><div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-primary" /></div></AppShell>;
  if (!profile.data) return <AppShell><section className="surface-panel mx-auto max-w-lg px-6 py-12 text-center"><h1 className="text-xl font-semibold">This profile is unavailable.</h1><p className="mt-3 text-sm text-muted-foreground">It may have been removed or the username may be incorrect.</p></section></AppShell>;
  const person = profile.data;
  const relationshipState = relationship.data;
  const toggleFollow = () => { if (relationshipState?.following) unfollow.mutate({ username: person.username }, { onSuccess: () => relationship.refetch() }); else follow.mutate({ username: person.username }, { onSuccess: () => relationship.refetch() }); };
  return <AppShell><section className="surface-panel mx-auto max-w-2xl overflow-hidden"><div className="h-28 bg-[linear-gradient(115deg,rgba(99,91,255,.88),rgba(101,215,255,.64))]" /><div className="px-6 pb-8 sm:px-9"><div className="-mt-10 flex items-end justify-between"><div className="grid h-20 w-20 place-items-center rounded-[25px] border-4 border-card bg-secondary text-xl font-semibold text-secondary-foreground">{person.displayName.slice(0, 1).toUpperCase()}</div><Button variant="outline" size="icon" className="mb-1 rounded-full" aria-label="Member options"><MoreHorizontal size={18} /></Button></div><h1 className="mt-5 text-2xl font-semibold tracking-tight">{person.displayName}</h1><p className="mt-1 text-sm text-muted-foreground">@{person.username}</p>{person.bio && <p className="mt-4 text-sm leading-6">{person.bio}</p>}<div className="mt-7 flex flex-wrap gap-3">{isAuthenticated && <Button className="rounded-full" variant={relationshipState?.following ? "outline" : "default"} disabled={follow.isPending || unfollow.isPending || relationship.isLoading} onClick={toggleFollow}>{relationship.isLoading ? "Loading…" : relationshipState?.following ? "Following" : relationshipState?.requestPending ? "Requested" : "Follow"}</Button>}{isAuthenticated && <Button variant="ghost" className="rounded-full text-muted-foreground hover:text-destructive" disabled={block.isPending} onClick={() => block.mutate({ username: person.username })}><Ban size={16} />Block</Button>}</div></div></section></AppShell>;
}
