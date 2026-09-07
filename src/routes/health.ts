import type { Database } from '../backend.ts';

export interface HealthConfig {
  DB?: Database;
  AI_ENABLED?: string;
  AI_VALIDATED?: string;
  GEMINI_MODEL?: string;
  GEMINI_API_KEY?: string;
}

export async function health(config: HealthConfig) {
  // Configuration is not a provider probe. Never report availability without a real call.
  const requested = config.AI_ENABLED === 'true';
  const validationGatePassed = config.AI_VALIDATED === 'true';
  const providerConfigured = Boolean(config.GEMINI_API_KEY && config.GEMINI_MODEL && /^[a-zA-Z0-9._-]+$/.test(config.GEMINI_MODEL) && config.GEMINI_MODEL !== 'unconfigured');
  const enabled = requested && validationGatePassed && providerConfigured;
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
      modelId: config.GEMINI_MODEL || 'unconfigured',
      providerStatus: providerConfigured ? 'configured-not-probed' : 'not-configured',
      quotaState: 'not-measured',
      reason: enabled
        ? 'Configuration and recorded validation gate permit requests; this endpoint does not probe provider availability.'
        : 'AI remains disabled until provider configuration and the grounding and failure gates pass.'
    },
    database: { status: databaseStatus },
    validation: { hostedPhone: 'not-yet-validated', trl5: 'not-yet-validated' }
  };
}
