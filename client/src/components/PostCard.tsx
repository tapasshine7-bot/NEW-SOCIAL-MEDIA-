import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Bookmark, Flag, Heart, MessageCircle, Send, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export type FeedPost = {
  id: number; publicId: string; caption: string | null; locationName: string | null; likesCount: number; commentsCount: number; savesCount: number; sharesCount: number; createdAt: Date;
  author: { username: string; displayName: string; avatarUrl: string | null };
  media: Array<{ id: number; kind: "image" | "video" | "audio" | "file"; url: string; altText: string | null }>;
  likedByMe: boolean; savedByMe: boolean;
};

function relativeTime(date: Date) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function PostCard({ post, signedIn, onMutate }: { post: FeedPost; signedIn: boolean; onMutate: () => void }) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [saved, setSaved] = useState(post.savedByMe);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<"spam" | "harassment" | "impersonation" | "inappropriate" | "violence" | "other">("spam");
  const [reportDetails, setReportDetails] = useState("");
  const commentInput = useMemo(() => ({ postId: post.publicId, page: 0, pageSize: 20 }), [post.publicId]);
  const persistedComments = trpc.social.comments.useQuery(commentInput, { enabled: commentsOpen });
  const toggleLike = trpc.social.toggleLike.useMutation({ onError: () => { setLiked(post.likedByMe); setLikesCount(post.likesCount); toast.error("Could not update your reaction."); }, onSettled: onMutate });
  const toggleSave = trpc.social.toggleSave.useMutation({ onError: () => { setSaved(post.savedByMe); toast.error("Could not update saved posts."); }, onSettled: onMutate });
  const share = trpc.social.recordShare.useMutation();
  const addComment = trpc.social.addComment.useMutation({ onSuccess: () => { setComment(""); persistedComments.refetch(); onMutate(); toast.success("Comment added."); }, onError: () => toast.error("Could not add your comment.") });
  const reportPost = trpc.social.reportPost.useMutation({ onSuccess: () => { setReportOpen(false); setReportDetails(""); toast.success("Thanks—your report has been recorded."); }, onError: () => toast.error("Could not submit this report.") });

  const handleLike = () => { if (!signedIn) return toast.info("Sign in to react to posts."); const next = !liked; setLiked(next); setLikesCount(count => count + (next ? 1 : -1)); toggleLike.mutate({ postId: post.publicId }); };
  const handleSave = () => { if (!signedIn) return toast.info("Sign in to save posts."); const next = !saved; setSaved(next); toggleSave.mutate({ postId: post.publicId }); };
  const handleShare = async () => { const url = `${window.location.origin}/post/${post.publicId}`; const canNativeShare = "share" in navigator; try { if (canNativeShare) await navigator.share({ title: `${post.author.displayName} on Luma`, text: post.caption ?? "", url }); else { await navigator.clipboard.writeText(url); toast.success("Link copied."); } if (signedIn) share.mutate({ postId: post.publicId, method: canNativeShare ? "native" : "copy_link" }); } catch (error) { if ((error as Error).name !== "AbortError") toast.error("Could not share this post."); } };
  const submitComment = (event: React.FormEvent) => { event.preventDefault(); if (!signedIn) return toast.info("Sign in to join the conversation."); if (comment.trim()) addComment.mutate({ postId: post.publicId, body: comment }); };

  return <article className="surface-panel overflow-hidden"><header className="flex items-center justify-between gap-4 px-5 py-4"><Link href={`/u/${post.author.username}`} className="flex min-w-0 items-center gap-3"><Avatar name={post.author.displayName} url={post.author.avatarUrl} /><div className="min-w-0"><p className="truncate text-sm font-semibold">{post.author.displayName}</p><p className="truncate text-xs text-muted-foreground">@{post.author.username}{post.locationName ? ` · ${post.locationName}` : ""}</p></div></Link>{signedIn && <button type="button" onClick={() => setReportOpen(open => !open)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Report post"><Flag size={17} /></button>}</header>{post.media.length > 0 && <div className={`flex snap-x snap-mandatory overflow-x-auto bg-muted ${post.media.length > 1 ? "gap-1" : ""}`}>{post.media.map(asset => <div key={asset.id} className="relative min-w-full snap-center"><MediaAsset asset={asset} /></div>)}</div>}<div className="px-5 pb-5 pt-4"><div className="flex items-center gap-1"><ActionButton label={liked ? "Unlike" : "Like"} onClick={handleLike} active={liked}><Heart size={20} fill={liked ? "currentColor" : "none"} /></ActionButton><ActionButton label="Comment" onClick={() => setCommentsOpen(open => !open)} active={commentsOpen}><MessageCircle size={20} /></ActionButton><ActionButton label="Share" onClick={handleShare}><Share2 size={19} /></ActionButton><ActionButton label={saved ? "Unsave" : "Save"} onClick={handleSave} active={saved} className="ml-auto"><Bookmark size={19} fill={saved ? "currentColor" : "none"} /></ActionButton></div><p className="mt-3 text-sm font-semibold">{likesCount.toLocaleString()} {likesCount === 1 ? "reaction" : "reactions"}</p>{post.caption && <p className="mt-2 whitespace-pre-wrap text-sm leading-6"><Link href={`/u/${post.author.username}`} className="mr-1 font-semibold hover:underline">{post.author.username}</Link>{post.caption}</p>}<button type="button" className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setCommentsOpen(open => !open)}>{post.commentsCount ? `View ${post.commentsCount} ${post.commentsCount === 1 ? "comment" : "comments"}` : "Start the conversation"}</button><p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{relativeTime(post.createdAt)} ago</p>{commentsOpen && <div className="mt-4 border-t border-border pt-4">{persistedComments.isLoading ? <p className="py-2 text-sm text-muted-foreground">Loading comments…</p> : persistedComments.data?.length ? <div className="mb-4 space-y-3">{persistedComments.data.map(({ comment: item, author }) => <div key={item.id} className="flex gap-2.5"><Avatar name={author.displayName} url={author.avatarUrl} /><p className="pt-0.5 text-sm leading-6"><Link href={`/u/${author.username}`} className="mr-1 font-semibold hover:underline">{author.username}</Link>{item.body}</p></div>)}</div> : <p className="mb-4 text-sm text-muted-foreground">No replies yet. Be the first to add one.</p>}<form onSubmit={submitComment} className="flex gap-2"><Input value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} placeholder={signedIn ? "Add a considered reply…" : "Sign in to comment"} aria-label="Write a comment" /><Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={!comment.trim() || addComment.isPending}><Send size={16} /></Button></form></div>}{reportOpen && <form onSubmit={event => { event.preventDefault(); reportPost.mutate({ postId: post.publicId, reason: reportReason, details: reportDetails || null }); }} className="mt-4 rounded-xl border border-border bg-muted/55 p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Report this post</p><button type="button" className="text-xs font-medium text-muted-foreground" onClick={() => setReportOpen(false)}>Cancel</button></div><div className="mt-3 flex flex-wrap gap-2"><select value={reportReason} onChange={event => setReportReason(event.target.value as typeof reportReason)} aria-label="Report reason" className="h-9 rounded-lg border border-border bg-card px-2 text-sm"><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="impersonation">Impersonation</option><option value="inappropriate">Inappropriate content</option><option value="violence">Violence</option><option value="other">Other</option></select><Input value={reportDetails} onChange={event => setReportDetails(event.target.value)} maxLength={1000} placeholder="Add context (optional)" /></div><Button type="submit" size="sm" variant="destructive" className="mt-3 rounded-full" disabled={reportPost.isPending}>{reportPost.isPending ? "Sending…" : "Submit report"}</Button></form>}</div></article>;
}

function Avatar({ name, url }: { name: string; url: string | null }) { return url ? <img src={url} alt="" className="h-10 w-10 rounded-[13px] object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-secondary text-sm font-bold text-secondary-foreground">{name.slice(0, 1).toUpperCase()}</span>; }
function MediaAsset({ asset }: { asset: FeedPost["media"][number] }) { if (asset.kind === "video") return <video src={asset.url} controls preload="metadata" className="aspect-square w-full bg-black object-cover" />; return <img src={asset.url} alt={asset.altText ?? "Shared post media"} loading="lazy" className="aspect-square w-full object-cover" />; }
function ActionButton({ children, label, active = false, className = "", onClick }: { children: React.ReactNode; label: string; active?: boolean; className?: string; onClick: () => void }) { return <button type="button" onClick={onClick} aria-label={label} className={`grid h-9 w-9 place-items-center rounded-full transition hover:bg-accent ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"} ${className}`}>{children}</button>; }
