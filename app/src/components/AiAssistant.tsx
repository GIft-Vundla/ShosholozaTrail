import { useEffect, useState } from 'react';
import { MessageCircle, PenLine, Sparkles } from 'lucide-react';

type Action = 'explain' | 'icebreaker' | 'draft';
type Result = { status?: string; label?: string; answer?: string; reason?: string; sourceIds?: string[]; sourceReview?: string };

const REASONS: Record<string, string> = {
  'preview-server-no-backend': 'This static preview has no AI backend. Run npm run dev to use the Worker-powered assistant.',
  'daily-assistance-budget-reached': "Today's free AI allowance has been used. The local story and activities still work.",
  'provider-not-configured': 'The AI provider is not configured in this build. The local story remains available.',
  'provider-circuit-open': 'The AI provider is recovering from repeated failures. Try again shortly.',
  'provider-failed-or-output-not-grounded': 'The provider did not return a grounded source excerpt, so the app withheld it.',
  'insufficient-source-evidence': 'The registered sources do not support that request, so the assistant declined to invent an answer.',
  'no-eligible-source-passages': 'No eligible source passages are available for AI selection in this build.',
};

const prompts: Record<Action, (place: string) => string> = {
  explain: place => `Find the most relevant sourced excerpt about ${place}.`,
  icebreaker: place => `Select one exact source passage about ${place}; the interface will place it beside a local conversation prompt.`,
  draft: place => `Select one exact source passage about ${place}; the interface will place it beside a local postcard prompt.`,
};

export function AiAssistant({ place }: { place: string }) {
  const [loading, setLoading] = useState<Action | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => { setLoading(null); setResult(null); }, [place]);

  async function ask(action: Action) {
    setLoading(action);
    setResult(null);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ action, question: prompts[action](place) }),
        signal: AbortSignal.timeout(18000),
      });
      const responseBody = await response.json() as Result;
      if (!response.ok) throw new Error(responseBody.reason || `Service returned ${response.status}`);
      setResult(responseBody);
    } catch (error) {
      setResult({ status: 'fallback', reason: error instanceof Error ? error.message : 'request-failed' });
    } finally {
      setLoading(null);
    }
  }

  const message = result?.status === 'source-excerpt'
    ? result.answer
    : result ? (REASONS[result.reason || ''] || `AI assistance is unavailable (${result.reason || 'unknown reason'}).`) : '';

  return <section className="ai-companion" aria-labelledby="ai-companion-title">
    <p className="eyebrow gold-dark"><Sparkles /> Source-locked AI</p>
    <h3 id="ai-companion-title">Ask the trail</h3>
    <p>The assistant can only return an exact excerpt from the registered sources. Unsupported questions are declined.</p>
    <div className="ai-actions">
      <button onClick={() => void ask('explain')} disabled={loading !== null}><Sparkles /> Explain this place</button>
      <button onClick={() => void ask('icebreaker')} disabled={loading !== null}><MessageCircle /> Start a conversation</button>
      <button onClick={() => void ask('draft')} disabled={loading !== null}><PenLine /> Inspire a postcard</button>
    </div>
    <div className="ai-answer" role="status" aria-live="polite">
      {loading && <p>Finding a grounded excerpt…</p>}
      {message && <p>{message}</p>}
      {result?.label && <small>{result.label}</small>}
      {result?.sourceIds?.length ? <small>Source: {result.sourceIds.join(', ')}{result.sourceReview === 'editorial-draft-human-review-pending' ? ' · human review pending' : ''}</small> : null}
    </div>
  </section>;
}
