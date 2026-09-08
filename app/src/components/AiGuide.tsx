import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, ExternalLink, Sparkles, UserRound } from 'lucide-react';
import { SiteHeader } from './SiteHeader';
import { MobileTabBar } from './MobileTabBar';

type SourceRecord = { id: string; title: string; url: string; institution?: string };
type AiResponse = { status?: string; answer?: string; label?: string; reason?: string; sourceIds?: string[] };
type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  label?: string;
  sourceIds?: string[];
  declined?: boolean;
};

const SUGGESTIONS = [
  'What can I learn about Freedom Park in Pretoria?',
  'Tell me about Sol Plaatje and Kimberley.',
  'What is special about the Hex River route?',
  'What heritage can I explore near Beaufort West?',
];

const FALLBACKS: Record<string, string> = {
  'daily-assistance-budget-reached': "Today's free AI allowance has been used. You can still explore every prepared story.",
  'provider-not-configured': 'The AI service is not configured right now.',
  'provider-circuit-open': 'The AI guide is recovering from a temporary problem. Please try again shortly.',
  'provider-failed-or-output-not-grounded': 'I could not produce a properly sourced answer, so I withheld it.',
  'insufficient-source-evidence': 'I could not find enough support in the registered sources, so I will not invent an answer.',
  'no-eligible-source-passages': 'No eligible source passages are currently available.',
};

export function AiGuide() {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome',
    role: 'assistant',
    text: 'Ask me about the places, people, heritage and landscapes along the Pretoria to Cape Town trail. I answer only from the registered project sources.',
  }]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch('/data/sources.json', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('sources-unavailable')))
      .then((register: { records?: SourceRecord[] }) => setSources(register.records ?? []))
      .catch(() => setSources([]));
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, asking]);

  async function submit(rawQuestion: string) {
    const nextQuestion = rawQuestion.trim();
    if (!nextQuestion || asking) return;
    setQuestion('');
    setAsking(true);
    setMessages(current => [...current, { id: crypto.randomUUID(), role: 'user', text: nextQuestion }]);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ action: 'explain', question: nextQuestion }),
        signal: AbortSignal.timeout(18_000),
      });
      const result = await response.json() as AiResponse;
      if (!response.ok) throw new Error(result.reason || `Service returned ${response.status}`);
      const grounded = result.status === 'source-excerpt' && result.answer;
      setMessages(current => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: grounded ? result.answer! : (FALLBACKS[result.reason || ''] || 'I could not answer that from the registered sources.'),
        label: result.label,
        sourceIds: result.sourceIds,
        declined: !grounded,
      }]);
    } catch {
      setMessages(current => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'I could not reach the AI service. The journey, maps and prepared stories are still available.',
        declined: true,
      }]);
    } finally {
      setAsking(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(question);
  }

  const findSource = (id: string) => sources.find(source => source.id === id);

  return <div className="page light-page ai-guide-page">
    <SiteHeader />
    <main className="ai-guide-shell">
      <section className="ai-guide-intro">
        <p className="eyebrow gold-dark"><Sparkles /> Live trail intelligence</p>
        <h1>Ask the AI Guide.</h1>
        <p>Consult the trail's source library before, during or after the journey. Answers are restricted to registered evidence and unsupported questions are declined.</p>
        <small>Experimental Workers AI · 20 questions per visitor daily · human editorial review pending</small>
      </section>

      <section className="ai-chat" aria-label="Conversation with the Shosholoza Trail AI Guide">
        <header className="ai-chat-header">
          <span><Bot /></span>
          <div><strong>Shosholoza AI Guide</strong><small><i /> Online · source locked</small></div>
        </header>
        <div className="ai-chat-history" role="log" aria-live="polite">
          {messages.map(message => <article className={`ai-message ${message.role}${message.declined ? ' declined' : ''}`} key={message.id}>
            <span className="ai-avatar" aria-hidden="true">{message.role === 'assistant' ? <Bot /> : <UserRound />}</span>
            <div>
              <b>{message.role === 'assistant' ? 'AI Guide' : 'You'}</b>
              <p>{message.text}</p>
              {message.label && <small className="ai-message-label">{message.label}</small>}
              {message.sourceIds?.length ? <ul className="ai-source-links">
                {message.sourceIds.map(id => {
                  const source = findSource(id);
                  return <li key={id}>{source
                    ? <a href={source.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> {source.institution || source.title}</a>
                    : <span>Source: {id}</span>}</li>;
                })}
              </ul> : null}
            </div>
          </article>)}
          {asking && <article className="ai-message assistant thinking"><span className="ai-avatar"><Bot /></span><div><b>AI Guide</b><p>Searching the registered sources<span>...</span></p></div></article>}
          <div ref={endRef} />
        </div>
        <div className="ai-suggestions" aria-label="Suggested questions">
          {SUGGESTIONS.map(suggestion => <button disabled={asking} onClick={() => void submit(suggestion)} key={suggestion}>{suggestion}</button>)}
        </div>
        <form className="ai-chat-form" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="ai-question">Ask the AI Guide</label>
          <textarea id="ai-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={1200} rows={2} placeholder="Ask about a place, person, landmark or landscape..." />
          <button type="submit" disabled={asking || !question.trim()} aria-label="Send question"><ArrowUp /></button>
        </form>
        <p className="ai-chat-note">The guide selects exact passages from the source register. It does not provide safety, booking, timetable or live train advice.</p>
      </section>
    </main>
    <MobileTabBar />
  </div>;
}
