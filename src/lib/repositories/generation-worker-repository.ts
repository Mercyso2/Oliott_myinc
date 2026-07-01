export type ProcessNextGenerationJobResult = {
  ok: boolean;
  processed: number;
  jobId?: string;
  jobType?: string;
  postId?: string;
  result?: unknown;
  message?: string;
  error?: string;
};

export function useExternalAiWorker() {
  return true;
}

export async function processNextGenerationJob(): Promise<ProcessNextGenerationJobResult> {
  return {
    ok: true,
    processed: 0,
    message:
      "Arquitetura V2 ativa: o frontend não processa geração pesada. O Motor Local EXE busca e executa os jobs no Supabase.",
  };
}

export async function processGenerationBatchSequentially(
  _token: string,
  payload: {
    batchId?: string;
    maxSteps?: number;
    onStep?: (step: { index: number; result: ProcessNextGenerationJobResult }) => void;
    forceEdge?: boolean;
  } = {},
) {
  const result: ProcessNextGenerationJobResult = {
    ok: true,
    processed: 0,
    message: payload.batchId
      ? `Fila ${payload.batchId} criada. O Motor Local EXE processará os jobs fora da Vercel/Supabase Edge.`
      : "Fila criada. O Motor Local EXE processará os jobs fora da Vercel/Supabase Edge.",
  };
  payload.onStep?.({ index: 0, result });
  return [result];
}
