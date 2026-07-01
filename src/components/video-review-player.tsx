import { useRef, useState } from "react";
import { AlertCircle, ExternalLink, Image as ImageIcon, Pause, Play, RefreshCw, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function looksPlayableVideo(value?: string | null) {
  const url = String(value ?? "").trim().toLowerCase();
  if (!url) return false;
  if (url.startsWith("data:image/")) return false;
  if (url.includes(".png") || url.includes(".jpg") || url.includes(".jpeg") || url.includes(".webp")) return false;
  return true;
}

export function VideoReviewPlayer({
  title,
  videoUrl,
  posterUrl,
  audioUrl,
  soundProfile,
  compact = false,
}: {
  title: string;
  videoUrl?: string | null;
  posterUrl?: string | null;
  audioUrl?: string | null;
  soundProfile?: string | null;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasVideo = looksPlayableVideo(videoUrl) && !failed;
  const hasPoster = Boolean(posterUrl);
  const hasAudio = Boolean(audioUrl || hasVideo);

  async function togglePlay() {
    const node = videoRef.current;
    if (!node || !hasVideo) return;
    if (node.paused) {
      await node.play();
      setPlaying(true);
    } else {
      node.pause();
      setPlaying(false);
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border bg-card shadow-soft", compact && "rounded-2xl")}>
      <div className="relative aspect-[9/16] bg-black">
        {hasVideo ? (
          <video
            ref={videoRef}
            src={videoUrl || undefined}
            poster={posterUrl || undefined}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : hasPoster ? (
          <div className="relative h-full w-full">
            <img src={posterUrl || undefined} alt={title} className="h-full w-full object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/65" />
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/65 p-3 text-white backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                <ImageIcon className="h-3.5 w-3.5" /> Capa pronta
              </div>
              <p className="mt-1 text-sm font-semibold">O MP4 ainda não está pronto ou não foi carregado.</p>
              <p className="mt-1 text-xs text-white/65">Clique em Gerar vídeo no card e aguarde o Motor Local concluir o MP4.</p>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,#ff6b2c55,transparent_35%),linear-gradient(135deg,#111827,#09090b_55%,#ff6b2c22)] p-6 text-center text-white">
            <div className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-white/70">MYINC</div>
            <p className="mt-6 max-w-56 text-lg font-extrabold">Vídeo ainda não gerado</p>
            <p className="mt-2 text-xs text-white/55">Use Gerar vídeo para criar o MP4 pelo Motor Local.</p>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge className="bg-black/60 text-white hover:bg-black/60">Review vídeo</Badge>
          {hasAudio ? <Badge className="bg-black/60 text-white hover:bg-black/60"><Volume2 className="mr-1 h-3 w-3" /> som</Badge> : null}
          {!hasVideo ? <Badge className="bg-warning/90 text-black hover:bg-warning/90"><RefreshCw className="mr-1 h-3 w-3" /> gerar MP4</Badge> : null}
          {failed ? <Badge className="bg-destructive text-white hover:bg-destructive"><AlertCircle className="mr-1 h-3 w-3" /> vídeo inválido</Badge> : null}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold">Player de revisão</p>
            <p className="text-xs text-muted-foreground">Aprovação visual e sonora antes de publicar.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!hasVideo} onClick={() => void togglePlay()}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Pausar" : "Play"}
            </Button>
            {hasVideo && videoUrl ? (
              <Button size="sm" variant="ghost" asChild>
                <a href={videoUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
            ) : null}
          </div>
        </div>
        {soundProfile ? (
          <div className="rounded-2xl border border-border bg-background p-3 text-xs text-muted-foreground">
            <b className="text-foreground">Direção sonora:</b> {soundProfile}
          </div>
        ) : null}
        {audioUrl && !hasVideo ? <audio src={audioUrl} controls className="w-full" /> : null}
      </div>
    </div>
  );
}
