import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ImagePlus, Loader2, Video, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const MAX_CLIENT_MEDIA_BYTES = 50 * 1024 * 1024;

function base64For(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("The selected file could not be read.")); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.readAsDataURL(file); }); }

export function PostComposer({ onPublished }: { onPublished: () => void }) {
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [locationName, setLocationName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const upload = trpc.uploads.create.useMutation();
  const publish = trpc.social.createPost.useMutation();
  const busy = upload.isPending || publish.isPending;
  const selectFiles = (selection: FileList | null) => { const next = Array.from(selection ?? []); if (!next.length) return; if (files.length + next.length > 10) return toast.error("A post can include up to 10 items."); if (next.some(file => file.size > MAX_CLIENT_MEDIA_BYTES)) return toast.error("Each video or image must be 50 MB or smaller."); if (next.some(file => !file.type.startsWith("image/") && !file.type.startsWith("video/"))) return toast.error("Posts support images and videos only."); setFiles(current => [...current, ...next]); if (input.current) input.current.value = ""; };
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!files.length) return toast.error("Choose at least one image or video."); try { const uploadIds: string[] = []; for (const file of files) { const dataBase64 = await base64For(file); const asset = await upload.mutateAsync({ purpose: file.type.startsWith("video/") ? "video" : "post", originalName: file.name, mimeType: file.type, dataBase64 }); uploadIds.push(asset.publicId); } await publish.mutateAsync({ caption: caption || null, locationName: locationName || null, uploadIds }); toast.success("Post published."); setCaption(""); setLocationName(""); setFiles([]); setOpen(false); onPublished(); } catch (error) { toast.error(error instanceof Error ? error.message : "Your post could not be published."); } };
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="surface-panel flex w-full items-center gap-3 px-5 py-4 text-left transition hover:border-primary/30"><span className="grid h-9 w-9 place-items-center rounded-[13px] bg-secondary text-sm font-bold text-secondary-foreground">You</span><span className="text-sm text-muted-foreground">Share a moment, an idea, or a new view…</span></button>;
  return <form onSubmit={submit} className="surface-panel p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Create a post</h2><p className="mt-1 text-sm text-muted-foreground">Images and videos stay connected to your account.</p></div><Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => setOpen(false)}><X size={18} /></Button></div><Textarea value={caption} onChange={event => setCaption(event.target.value)} maxLength={2200} placeholder="What is worth sharing?" className="mt-5 min-h-28 resize-y border-0 bg-muted/60 focus-visible:ring-1" /><div className="mt-3 flex flex-wrap items-center gap-3"><Input value={locationName} onChange={event => setLocationName(event.target.value)} maxLength={160} placeholder="Add a location (optional)" className="max-w-xs" /><input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple className="sr-only" onChange={event => selectFiles(event.target.files)} /><Button type="button" variant="outline" className="rounded-full" onClick={() => input.current?.click()}><ImagePlus size={16} />Add media</Button></div>{files.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{files.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">{file.type.startsWith("video/") ? <Video size={13} /> : <ImagePlus size={13} />}{file.name.slice(0, 24)}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, position) => position !== index))}><X size={13} /></button></span>)}</div>}<div className="mt-5 flex justify-end"><Button type="submit" className="rounded-full px-5" disabled={busy}>{busy && <Loader2 className="animate-spin" size={16} />}{busy ? "Publishing…" : "Publish"}</Button></div></form>;
}
