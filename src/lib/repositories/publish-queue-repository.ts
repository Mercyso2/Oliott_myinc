import { BaseRepository } from "./base-repository";
import { selectRows } from "@/lib/supabase/client";
import type { PostRow, PublishQueueRow } from "@/lib/supabase/types";

export const publishQueueRepository = new BaseRepository<PublishQueueRow>("publish_queue");
export const publishLogRepository = new BaseRepository<{
  id: string;
  post_id?: string | null;
  archived_at?: string | null;
}>("publish_logs");

async function getPostForPublish(token: string, postId: string) {
  const [post] = await selectRows<PostRow>(
    "posts",
    token,
    `select=*&id=eq.${encodeURIComponent(postId)}&limit=1`,
  );
  if (!post) throw new Error("Post não encontrado para agendamento.");
  if (!post.brand_id) throw new Error("Post sem brand_id. Não é possível criar publish_queue.");
  const status = String(post.status ?? "").toLowerCase();
  if (["arquivado", "excluido", "excluído", "deleted", "deletado"].includes(status)) {
    throw new Error("Post arquivado/excluído não pode ser agendado.");
  }
  if (!post.media_url && !(post.carousel_media_urls ?? []).length && !post.video_url) {
    throw new Error("Post ainda não possui mídia final. Gere a mídia antes de agendar/publicar.");
  }
  return post;
}

export async function queuePost(token: string, postId: string, channel: string, scheduledAt: string) {
  const post = await getPostForPublish(token, postId);
  return publishQueueRepository.create(token, {
    brand_id: post.brand_id,
    post_id: postId,
    channel,
    scheduled_at: scheduledAt,
    status: "scheduled",
    payload: {
      caption: post.caption,
      format: post.format,
      media_url: post.media_url,
      carousel_media_urls: post.carousel_media_urls ?? [],
      video_url: post.video_url,
    },
  } as Partial<PublishQueueRow>);
}

export async function schedulePost(
  token: string,
  post: { id: string; channel: string },
  scheduledAt: string,
) {
  const queue = await queuePost(token, post.id, post.channel, scheduledAt);
  return { ok: true as const, queue, message: "Post agendado na publish_queue V2." };
}

export async function processPublishQueue(_token?: string, _limit = 5) {
  throw new Error(
    "Publicação automática é feita pela Edge Function publish-scheduled-posts via Supabase/Vercel Cron. O frontend não processa a fila de publicação.",
  );
}
