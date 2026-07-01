import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/social-components";
import { useAuth } from "@/lib/auth";
import { callRpc, readableError } from "@/lib/supabase/client";
import type { GenerationJobRow } from "@/lib/supabase/types";

export const Route = createFileRoute("/fila-v2")({
  head: () => ({
    meta: [
      { title: "Fila V2 — MYINC" },
      { name: "description", content: "Fila de geração controlada pelo Motor Local EXE." },
    ],
  }),
  component: FilaV2,
});

type LightJob = GenerationJobRow & {
  attempts?: number | null;
  attempt_count?: number | null;
  max_attempts?: number | null;
  batch_id?: string | null;
  failed_at?: string | null;
};

function tone(status?: string | null) {
  const s = String(status ?? "queued").toLowerCase();
  if (["completed", "concluido", "concluído"].includes(s)) return "bg-success/10 text-success";
  if (["failed", "erro", "erro_ia", "timeout", "error"].includes(s)) return "bg-destructive/10 text-destructive";
  if (["processing", "processando", "running"].includes(s)) return "bg-warning/10 text-warning";
  return "bg-primary/10 text-primary";
}

function iconFor(status?: string | null) {
  const s = String(status ?? "queued").toLowerCase();
  if (["completed", "concluido", "concluído"].includes(s)) return CheckCircle2;
  if (["failed", "erro", "erro_ia", "timeout", "error"].includes(s)) return AlertTriangle;
  if (["processing", "processando", "running"].includes(s)) return Loader2;
  return Clock;
}

function FilaV2() {
  const { session } = useAuth();
  const [jobs, setJobs] = useState<LightJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const rows = await callRpc<LightJob[]>("list_generation_jobs_light", session.access_token, { p_limit: 120 });
      setJobs(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(readableError(err) || "Falha ao carregar fila V2.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function retryAllFailed() {
    if (!session) return;
    setProcessing(true);
    setError("");
    try {
      const result = await callRpc<{ ok: boolean; requeued?: number }>("retry_all_failed_generation_jobs", session.access_token, { p_limit: 100 });
      toast.success(`${result.requeued ?? 0} falha(s) reenfileirada(s).`);
      await load();
    } catch (err) {
      const message = readableError(err) || "Falha ao reprocessar jobs.";
      setError(message);
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  }

  async function retryOne(jobId: string) {
    if (!session) return;
    setProcessing(true);
    setError("");
    try {
      await callRpc("retry_generation_job", session.access_token, { p_job_id: jobId });
      toast.success("Job reenfileirado para o Motor Local.");
      await load();
    } catch (err) {
      const message = readableError(err) || "Falha ao reprocessar job.";
      setError(message);
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  }

  async function wakeQueue() {
    if (!session) return;
    setProcessing(true);
    setError("");
    try {
      const result = await callRpc<{ ok: boolean; queued?: number; message?: string }>("trigger_worker_now", session.access_token, { p_limit: 100, p_retry_failed: false });
      toast.success(result.message ?? `Fila pronta com ${result.queued ?? 0} pendente(s).`);
      await load();
    } catch (err) {
      const message = readableError(err) || "Falha ao acordar fila.";
      setError(message);
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  }

  const counts = {
    queued: jobs.filter((j) => ["queued", "pending", "retrying"].includes(String(j.status).toLowerCase())).length,
    processing: jobs.filter((j) => ["processing", "running"].includes(String(j.status).toLowerCase())).length,
    completed: jobs.filter((j) => ["completed", "concluido", "concluído"].includes(String(j.status).toLowerCase())).length,
    failed: jobs.filter((j) => ["failed", "erro", "erro_ia", "timeout", "error"].includes(String(j.status).toLowerCase())).length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <PageHeader
        title="Fila V2 · Motor Local"
        description="O frontend apenas enfileira. O Supabase organiza. O EXE local processa conteúdo, imagem, carrossel e vídeo. Sem Edge pesada."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => void retryAllFailed()} disabled={loading || processing || !counts.failed}>
              <RotateCcw className="h-4 w-4" /> Reprocessar falhas
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => void wakeQueue()} disabled={loading || processing}>
              <RefreshCw className="h-4 w-4" /> Acordar fila
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => void load()} disabled={loading || processing}>
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
          </div>
        }
      />

      {loading ? <LoadingState label="Carregando fila real do Supabase..." /> : null}
      {processing ? <LoadingState label="Atualizando fila..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Pendentes" value={counts.queued} />
        <Metric label="Processando" value={counts.processing} />
        <Metric label="Concluídos" value={counts.completed} />
        <Metric label="Falhas" value={counts.failed} />
      </div>

      <Card className="rounded-3xl shadow-soft">
        <CardHeader>
          <CardTitle>Jobs recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!jobs.length && !loading ? (
            <EmptyState title="Fila vazia" description="Aprove posts e envie para produção para criar jobs para o Motor Local." />
          ) : null}
          {jobs.map((job) => {
            const Icon = iconFor(job.status);
            const failed = ["failed", "erro", "erro_ia", "timeout", "error"].includes(String(job.status).toLowerCase());
            return (
              <div key={job.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={tone(job.status)}><Icon className="mr-1 h-3.5 w-3.5" />{job.status ?? "queued"}</Badge>
                      <Badge variant="outline">{job.job_type ?? job.type ?? "job"}</Badge>
                      <Badge variant="outline">tentativa {job.attempts ?? job.attempt_count ?? 0}/{job.max_attempts ?? 3}</Badge>
                    </div>
                    <p className="mt-2 truncate text-sm text-muted-foreground">job: {job.id}</p>
                    {job.post_id ? <p className="truncate text-sm text-muted-foreground">post: {job.post_id}</p> : null}
                    {job.error_message ? <p className="mt-2 whitespace-pre-wrap text-sm text-destructive">{job.error_message}</p> : null}
                  </div>
                  <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground md:items-end">
                    <p>Progresso: {job.progress ?? 0}%</p>
                    <p>{job.created_at ? new Date(job.created_at).toLocaleString("pt-BR") : ""}</p>
                    {failed ? (
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => void retryOne(job.id)} disabled={processing}>
                        <RotateCcw className="h-4 w-4" /> Retry
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
