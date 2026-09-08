import type { Database, WorkersAiBinding } from '../backend.ts';

export interface HealthConfig {
  DB?: Database;
  AI?: WorkersAiBinding;
  AI_ENABLED?: string;
  AI_VALIDATED?: string;
  AI_EXPERIMENTAL?: string;
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  GEMINI_MODEL?: string;
  GEMINI_API_KEY?: string;
}

export async function health(config: HealthConfig) {
  // Configuration is not a provider probe. Never report availability without a real call.
  const requested = config.AI_ENABLED === 'true';
  const validationGatePassed = config.AI_VALIDATED === 'true';
  const experimental = config.AI_EXPERIMENTAL === 'true';
  const provider = config.AI_PROVIDER === 'gemini' ? 'gemini' : 'workers-ai';
  const workersModel = config.AI_MODEL || '@cf/zai-org/glm-4.7-flash';
  const geminiConfigured = Boolean(config.GEMINI_API_KEY && config.GEMINI_MODEL && /^[a-zA-Z0-9._-]+$/.test(config.GEMINI_MODEL) && config.GEMINI_MODEL !== 'unconfigured');
  const workersAiConfigured = Boolean(config.AI && /^@cf\/[a-zA-Z0-9._/-]+$/.test(workersModel));
  const providerConfigured = provider === 'gemini' ? geminiConfigured : workersAiConfigured;
  const enabled = requested && (validationGatePassed || experimental) && providerConfigured;
  let databaseStatus = 'not-configured';
  if (config.DB) {
    try {
      const probe = await config.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
      databaseStatus = probe?.ok === 1 ? 'available' : 'probe-failed';
    } catch {
      databaseStatus = 'probe-failed';
    }
  }
  return {
    service: 'ShosholozaTrail',
    version: '0.1.0',
    readiness: 'working-towards-trl5',
    ai: {
      enabled,
      requested,
      mode: validationGatePassed ? 'validated' : experimental ? 'experimental-source-locked' : 'disabled',
      provider,
      modelId: provider === 'gemini' ? (config.GEMINI_MODEL || 'unconfigured') : workersModel,
      providerStatus: providerConfigured ? 'configured-not-probed' : 'not-configured',
      quotaState: 'not-measured',
      reason: enabled && validationGatePassed
        ? 'Configuration and recorded validation gate permit requests; this endpoint does not probe provider availability.'
        : enabled
          ? 'Experimental source-locked assistance is configured; human review and provider evaluation remain pending.'
        : 'AI remains disabled until provider configuration and the grounding and failure gates pass.'
    },
    database: { status: databaseStatus },
    validation: { hostedPhone: 'not-yet-validated', trl5: 'not-yet-validated' }
  };
}
