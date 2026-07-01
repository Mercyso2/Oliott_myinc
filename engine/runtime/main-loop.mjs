#!/usr/bin/env node
import crypto from 'node:crypto';
import { loadDotenv, getConfig } from './env.mjs';
import { OpenAIClient } from '../openai/openai-client.mjs';
import { processJob } from '../processors/job-processor.mjs';
import { saveStatus } from './status-store.mjs';

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function sha256(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function safeText(data) {
  if (typeof data === 'string') return data;
  try { return JSON.stringify(data); } catch { return String(data); }
}

async function callFunction(config, name, payload = {}) {
  const response = await fetch(`${config.supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'x-worker-device-key': config.workerDeviceKey,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const hint = data?.hint ? ` | hint: ${data.hint}` : '';
    const detail = data?.error ? `${data.error}` : safeText(data);
    throw new Error(`${name} HTTP ${response.status}: ${detail}${hint}`);
  }
  return data;
}

async function rpc(config, fn, payload = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`${fn} HTTP ${response.status}: ${safeText(data)}`);
  return data;
}

async function main() {
  loadDotenv();
  const config = getConfig();
  const openai = new OpenAIClient(config);
  const keyHash = await sha256(config.workerDeviceKey);
  console.log(`[MYINC Engine V7] iniciando ${config.workerName}`);
  console.log('[MYINC Engine V7] Creative Engine final: conteúdo, imagem, carrossel, render com logo real e vídeo rodam localmente.');
  await saveStatus({ status: 'starting', workerName: config.workerName, version: 'v7-final', finalRender: config.finalRender, costMode: config.creativeCostMode }).catch(() => undefined);
  let workerId = null;
  while (true) {
    try {
      const registered = await callFunction(config, 'engine-register-worker', {
        name: config.workerName,
        appVersion: 'v7-final-creative-engine',
        machineInfo: { platform: process.platform, node: process.version }
      });
      workerId = registered?.worker?.id || registered?.workerId || workerId;
      if (!workerId) throw new Error(`engine-register-worker não retornou worker.id: ${safeText(registered)}`);
      await saveStatus({ status: 'online', workerId, workerName: config.workerName, version: 'v7-final' }).catch(() => undefined);

      const job = await rpc(config, 'claim_next_generation_job', { p_worker_id: workerId, p_device_key_hash: keyHash });
      if (!job || !job.id) { await wait(config.pollMs); continue; }

      console.log(`[MYINC Engine V7] job claimado ${JSON.stringify({ jobId: job.id, type: job.job_type || job.type, postId: job.post_id })}`);
      await saveStatus({ status: 'processing', workerId, jobId: job.id, jobType: job.job_type || job.type, postId: job.post_id, version: 'v7-final' }).catch(() => undefined);
      try {
        const output = await processJob(job, openai);
        await callFunction(config, 'engine-save-result', {
          workerId,
          jobId: job.id,
          type: output.type,
          result: output.result,
          artifact: output.artifact,
          posterArtifact: output.posterArtifact || null,
        });
        console.log(`[MYINC Engine V7] job concluído ${JSON.stringify({ jobId: job.id })}`);
        await saveStatus({ status: 'online', workerId, lastCompletedJobId: job.id, version: 'v7-final' }).catch(() => undefined);
      } catch (error) {
        console.error(`[MYINC Engine V7] job falhou ${JSON.stringify({ jobId: job.id, error: error.message })}`);
        await saveStatus({ status: 'job_failed', workerId, jobId: job.id, error: error.message, version: 'v7-final' }).catch(() => undefined);
        await rpc(config, 'fail_generation_job', {
          p_worker_id: workerId,
          p_device_key_hash: keyHash,
          p_job_id: job.id,
          p_error_message: error.message,
          p_error_code: 'ENGINE_V3_2_ERROR',
          p_provider_response: { message: error.message, stack: error.stack }
        }).catch((rpcError) => console.error('[MYINC Engine V7] falha ao registrar erro:', rpcError.message));
      }
    } catch (error) {
      console.error(`[MYINC Engine V7] aguardando Supabase/Edge/OpenAI: ${error.message}`);
      await saveStatus({ status: 'waiting', error: error.message, version: 'v7-final' }).catch(() => undefined);
      await wait(config.pollMs);
    }
  }
}

main().catch((error) => { console.error('[MYINC Engine V7] erro fatal:', error); process.exitCode = 1; });
