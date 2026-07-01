import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarView,
  CreativeReviewModal,
  EmptyState,
  ErrorState,
  LoadingState,
  PublishControlPanel,
} from "@/components/social-components";
import { useAuth } from "@/lib/auth";
import {
  approvePost,
  archivePost,
  contentCommentRepository,
  generatePostContent,
  generatePostImage,
  hydratePostRelations,
  postRepository,
  publishPostNow,
  updatePostContent,
} from "@/lib/repositories/post-repository";
import { schedulePost } from "@/lib/repositories/publish-queue-repository";
import { postRowToSocialPost } from "@/lib/social-mappers";
import type { PostRow } from "@/lib/supabase/types";
import type { SocialPost } from "@/lib/social-types";

export const Route = createFileRoute("/calendario")({
  head: () => ({ meta: [{ title: "Calendário — MYINC" }] }),
  component: Calendario,
});

const HIDDEN_STATUSES = new Set([
  "arquivado",
  "excluido",
  "excluído",
  "deletado",
  "deleted",
]);

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}
function isVisiblePost(row: PostRow) {
  return (
    !row.deleted_at &&
    !row.archived_at &&
    !HIDDEN_STATUSES.has(String(row.status ?? "").toLowerCase())
  );
}

function Calendario() {
  const { session, profile } = useAuth();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState<SocialPost | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [manualPostId, setManualPostId] = useState("");
  const [manualScheduledAt, setManualScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const min = startOfMonth(month).toISOString();
      const max = endOfMonth(month).toISOString();
      const filter = [
        `scheduled_at=gte.${encodeURIComponent(min)}`,
        `scheduled_at=lte.${encodeURIComponent(max)}`,
        "deleted_at=is.null",
        "archived_at=is.null",
        "status=not.in.(arquivado,excluido,excluído,deletado,deleted)",
        "order=scheduled_at.asc",
      ].join("&");
      const rawRows = profile?.brand_id
        ? await postRepository.listByBrand(
            session.access_token,
            profile.brand_id,
            filter,
            false,
          )
        : await postRepository.list(session.access_token, `select=*&${filter}`);
      const rows = rawRows.filter(isVisiblePost);
      const relations = await hydratePostRelations(session.access_token, rows);
      const mapped = rows.map((row) =>
        postRowToSocialPost(
          row,
          relations.versions.get(row.id) ?? [],
          relations.comments.get(row.id) ?? [],
        ),
      );
      setPosts(mapped);
      setSelected((current) =>
        current
          ? (mapped.find((post) => post.id === current.id) ?? null)
          : null,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao carregar calendário real.",
      );
    } finally {
      setLoading(false);
    }
  }, [month, profile?.brand_id, session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(
    label: string,
    action: () => Promise<unknown>,
    options: { closeModal?: boolean } = {},
  ) {
    setLoading(true);
    setError("");
    try {
      await action();
      toast.success(label);
      if (options.closeModal) setSelected(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ação do calendário falhou.",
      );
    } finally {
      setLoading(false);
    }
  }

  const approved = useMemo(
    () => posts.filter((post) => post.status === "aprovado"),
    [posts],
  );
  const scheduled = useMemo(
    () =>
      posts.filter((post) =>
        ["agendado", "publicado", "erro"].includes(post.status),
      ),
    [posts],
  );
  const manualCandidates = useMemo(
    () =>
      posts.filter(
        (post) =>
          ![
            "publicado",
            "arquivado",
            "excluido",
            "excluído",
            "deleted",
          ].includes(post.status),
      ),
    [posts],
  );
  const manualPost = useMemo(
    () =>
      manualCandidates.find((post) => post.id === manualPostId) ??
      manualCandidates[0] ??
      null,
    [manualCandidates, manualPostId],
  );

  function assertReadyForManualPublish(post: SocialPost | null) {
    if (!post) throw new Error("Selecione um post para publicação manual.");
    const hasMedia = Boolean(
      post.videoUrl || post.mediaUrl || post.carouselMediaUrls?.length,
    );
    if (!hasMedia)
      throw new Error(
        "O post selecionado ainda não tem mídia final. Gere imagem/carrossel/vídeo antes de publicar.",
      );
    return post;
  }

  async function scheduleApproved() {
    await Promise.all(
      approved.map((post) =>
        schedulePost(
          session!.access_token,
          post as unknown as PostRow,
          post.scheduledAt,
        ),
      ),
    );
  }

  async function publishFirstReady() {
    const ready = posts.find((post) =>
      ["aprovado", "agendado"].includes(post.status),
    );
    if (!ready)
      throw new Error("Nenhum post aprovado/agendado para publicar agora.");
    await publishPostNow(session!.access_token, ready.id);
  }

  async function archiveAndRemove(post: SocialPost) {
    await archivePost(session!.access_token, post.id);
    setPosts((current) => current.filter((item) => item.id !== post.id));
    setSelected((current) => (current?.id === post.id ? null : current));
  }

  async function scheduleManualPost() {
    const post = assertReadyForManualPublish(manualPost);
    if (!manualScheduledAt)
      throw new Error("Informe data e hora para programar a publicação.");
    await schedulePost(
      session!.access_token,
      post as unknown as PostRow,
      new Date(manualScheduledAt).toISOString(),
    );
  }

  async function publishManualPostNow() {
    const post = assertReadyForManualPublish(manualPost);
    await publishPostNow(session!.access_token, post.id);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <PageHeader
        title="Calendário e Fila de Publicação"
        description="Mês real, agendamento persistente, publicação imediata, processamento de fila e revisão por post. Arquivados/excluídos não aparecem mais no calendário."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={loading}
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="h-4 w-4" /> Mês anterior
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={loading}
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              Próximo mês <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={loading || !approved.length}
              onClick={() =>
                run(
                  "Aprovados enviados para fila de publicação.",
                  scheduleApproved,
                )
              }
            >
              <CalendarDays className="h-4 w-4" /> Agendar aprovados
            </Button>

            <Button
              className="rounded-full bg-gradient-primary text-primary-foreground"
              disabled={loading}
              onClick={() =>
                run("Publicação Meta solicitada.", publishFirstReady)
              }
            >
              <Play className="h-4 w-4" /> Publicar agora
            </Button>
          </div>
        }
      />
      {loading ? (
        <LoadingState label="Sincronizando calendário, posts e fila real..." />
      ) : null}
      {error ? <ErrorState message={error} /> : null}
      <Tabs defaultValue="mes" className="space-y-5">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted p-1">
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="lista">Lista e fila</TabsTrigger>
          <TabsTrigger value="manual">Publicação manual</TabsTrigger>
          <TabsTrigger value="agendados">Agendados/publicados</TabsTrigger>
        </TabsList>
        <TabsContent value="mes">
          {posts.length ? (
            <CalendarView posts={posts} onOpen={setSelected} />
          ) : (
            <EmptyState
              title="Nenhum post neste mês"
              description="Aprove e agende posts para preencher o calendário editorial."
            />
          )}
        </TabsContent>
        <TabsContent value="semana">
          {posts.length ? (
            <CalendarView posts={posts.slice(0, 7)} onOpen={setSelected} />
          ) : (
            <EmptyState
              title="Semana vazia"
              description="Nenhum post real encontrado para a semana."
            />
          )}
        </TabsContent>
        <TabsContent value="lista">
          {posts.length ? (
            <PublishControlPanel
              posts={posts}
              onOpen={setSelected}
              onSchedule={(post, scheduledAt) =>
                run("Post agendado na fila real.", () =>
                  schedulePost(
                    session!.access_token,
                    post as unknown as PostRow,
                    scheduledAt,
                  ),
                )
              }
              onArchive={(post) =>
                run("Post arquivado e removido do calendário.", () =>
                  archiveAndRemove(post),
                )
              }
            />
          ) : (
            <EmptyState
              title="Fila vazia"
              description="Aprove posts e use Agendar aprovados para criar itens em publish_queue."
            />
          )}
        </TabsContent>
        <TabsContent value="manual">
          <div className="grid gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">Publicação manual</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha um post com mídia final, publique agora pela Meta ou
                  programe na fila real.
                </p>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Post</span>
                <select
                  className="h-11 rounded-2xl border border-input bg-background px-3 text-sm"
                  value={manualPost?.id ?? ""}
                  onChange={(event) => setManualPostId(event.target.value)}
                >
                  {manualCandidates.map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.title || post.headline || post.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Data e hora</span>
                <input
                  type="datetime-local"
                  className="h-11 rounded-2xl border border-input bg-background px-3 text-sm"
                  value={manualScheduledAt}
                  onChange={(event) => setManualScheduledAt(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={loading || !manualPost}
                  onClick={() =>
                    run(
                      "Publicação programada na fila real.",
                      scheduleManualPost,
                    )
                  }
                >
                  <CalendarDays className="h-4 w-4" /> Programar
                </Button>
                <Button
                  className="rounded-full bg-gradient-primary text-primary-foreground"
                  disabled={loading || !manualPost}
                  onClick={() =>
                    run("Publicação Meta solicitada.", publishManualPostNow)
                  }
                >
                  <Play className="h-4 w-4" /> Publicar agora
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              {manualPost ? (
                <div className="space-y-3 text-sm">
                  <div className="font-semibold">
                    {manualPost.title || manualPost.headline}
                  </div>
                  <div className="text-muted-foreground">
                    {manualPost.format} · {manualPost.status}
                  </div>
                  <div className="grid gap-2">
                    <span
                      className={
                        manualPost.mediaUrl
                          ? "text-success"
                          : "text-muted-foreground"
                      }
                    >
                      Imagem: {manualPost.mediaUrl ? "pronta" : "ausente"}
                    </span>
                    <span
                      className={
                        manualPost.carouselMediaUrls?.length
                          ? "text-success"
                          : "text-muted-foreground"
                      }
                    >
                      Carrossel: {manualPost.carouselMediaUrls?.length || 0}{" "}
                      mídia(s)
                    </span>
                    <span
                      className={
                        manualPost.videoUrl
                          ? "text-success"
                          : "text-muted-foreground"
                      }
                    >
                      Vídeo: {manualPost.videoUrl ? "pronto" : "ausente"}
                    </span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Nenhum post disponível"
                  description="Crie e aprove um post antes de publicar manualmente."
                />
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="agendados">
          {scheduled.length ? (
            <PublishControlPanel
              posts={scheduled}
              onOpen={setSelected}
              onSchedule={(post, scheduledAt) =>
                run("Post reagendado.", () =>
                  schedulePost(
                    session!.access_token,
                    post as unknown as PostRow,
                    scheduledAt,
                  ),
                )
              }
              onArchive={(post) =>
                run("Post arquivado e removido do calendário.", () =>
                  archiveAndRemove(post),
                )
              }
            />
          ) : (
            <EmptyState
              title="Nenhum agendamento ativo"
              description="Quando um post for agendado/publicado, ele fica rastreável aqui."
            />
          )}
        </TabsContent>
      </Tabs>
      <CreativeReviewModal
        post={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onSave={(patch) =>
          run(
            "Edição salva no calendário.",
            () =>
              updatePostContent(session!.access_token, selected!.id, {
                title: patch.title,
                caption: patch.caption,
                hashtags: patch.hashtags,
                cta: patch.cta,
                image_prompt: patch.imagePrompt,
                creative_brief: patch.creativeBrief,
                scheduled_at: patch.scheduledAt,
              } as Partial<PostRow>),
            { closeModal: true },
          )
        }
        onApprove={() =>
          run(
            "Post aprovado.",
            () => approvePost(session!.access_token, selected!.id),
            { closeModal: true },
          )
        }
        onSchedule={(scheduledAt) =>
          run(
            "Post agendado.",
            () =>
              schedulePost(
                session!.access_token,
                selected as unknown as PostRow,
                scheduledAt,
              ),
            { closeModal: true },
          )
        }
        onPublish={() =>
          run(
            "Publicação Meta solicitada.",
            () => publishPostNow(session!.access_token, selected!.id),
            { closeModal: true },
          )
        }
        onRegenerate={(feedback) =>
          run("Nova versão solicitada.", () =>
            generatePostContent(session!.access_token, selected!.id, feedback),
          )
        }
        onGenerateImage={() =>
          run("Imagem gerada.", () =>
            generatePostImage(session!.access_token, selected!.id),
          )
        }
        onArchive={() =>
          run(
            "Post arquivado e removido do calendário.",
            () => archiveAndRemove(selected!),
            { closeModal: true },
          )
        }
        onAddComment={(comment) =>
          run("Comentário salvo.", () =>
            contentCommentRepository.create(session!.access_token, {
              post_id: selected!.id,
              comment,
              status: "aberto",
              feedback_for_ai: true,
            }),
          )
        }
      />
    </div>
  );
}
