import { AppShell } from "@/components/AppShell";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useRoute } from "wouter";

export default function PostDetail() {
  const [, params] = useRoute("/post/:postId");
  const postId = params?.postId ?? "";
  const { isAuthenticated } = useAuth();
  const post = trpc.social.postById.useQuery({ postId }, { enabled: Boolean(postId) });
  return <AppShell><div className="mx-auto max-w-2xl"><Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"><ArrowLeft size={16} />Back to home</Link>{post.isLoading ? <div className="grid min-h-[45vh] place-items-center"><Loader2 className="animate-spin text-primary" /></div> : post.data ? <PostCard post={post.data as FeedPost} signedIn={isAuthenticated} onMutate={() => post.refetch()} /> : <section className="surface-panel px-6 py-12 text-center"><h1 className="text-xl font-semibold">This post is unavailable.</h1><p className="mt-3 text-sm text-muted-foreground">It may have been removed, or you may not have access to it.</p></section>}</div></AppShell>;
}
