import { createHash } from 'node:crypto';

export function sha256(text) { return createHash('sha256').update(text).digest('hex'); }

export async function rpc(config, fn, args = {}) {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`RPC ${fn} falhou: ${JSON.stringify(data)}`);
  return data;
}

export async function edge(config, name, payload = {}) {
  const res = await fetch(`${config.supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, 'Content-Type': 'application/json', 'x-worker-device-key': config.workerDeviceKey },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(`Edge ${name} falhou: ${JSON.stringify(data)}`);
  return data;
}

export async function registerWorker(config) {
  const hash = sha256(config.workerDeviceKey);
  const data = await edge(config, 'engine-register-worker', {
    name: config.workerName,
    appVersion: 'v2.0.0-local-engine',
    machineInfo: { platform: process.platform, arch: process.arch, node: process.version }
  });
  return { ...data.worker, deviceKeyHash: hash };
}

export async function heartbeat(config, worker) {
  return rpc(config, 'worker_heartbeat', { p_worker_id: worker.id, p_device_key_hash: worker.deviceKeyHash });
}
export async function claimNextJob(config, worker) {
  return rpc(config, 'claim_next_generation_job', { p_worker_id: worker.id, p_device_key_hash: worker.deviceKeyHash });
}
export async function failJob(config, worker, job, message, code = 'ENGINE_PROCESS_ERROR', providerResponse = {}) {
  return rpc(config, 'fail_generation_job', { p_worker_id: worker.id, p_device_key_hash: worker.deviceKeyHash, p_job_id: job.id, p_error_message: message, p_error_code: code, p_provider_response: providerResponse });
}
export async function saveJobResult(config, worker, job, result) {
  return edge(config, 'engine-save-result', { workerId: worker.id, jobId: job.id, ...result });
}
