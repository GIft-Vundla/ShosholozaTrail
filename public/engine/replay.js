export function parseTrace(jsonl) {
  const rows = jsonl.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const [header, ...fixes] = rows;
  if (!header?.traceId || !['synthetic', 'measured', 'sourced'].includes(header.provenance)) throw new Error('Trace provenance header required');
  return { header, fixes };
}

export function createReplaySource(trace, { rate = 1, onError = () => {} } = {}) {
  const parsed = typeof trace === 'string' ? parseTrace(trace) : trace;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Replay rate must be positive');
  let timer = null, stopped = true, index = 0, generation = 0;
  return {
    source: 'replay', traceId: parsed.header.traceId,
    start(consume) {
      this.stop(); stopped = false; index = 0;
      const run = generation;
      const step = async () => {
        if (stopped || run !== generation || index >= parsed.fixes.length) return;
        const fix = parsed.fixes[index++];
        try { await consume({ ...fix, source: 'replay', traceId: parsed.header.traceId }); }
        catch (error) { stopped = true; onError(error); return; }
        if (!stopped && run === generation && index < parsed.fixes.length) timer = setTimeout(step, Math.max(0, (parsed.fixes[index].t - fix.t) / rate));
      };
      void step();
    },
    stop() { stopped = true; generation++; clearTimeout(timer); },
    async replayAll(consume) {
      for (const fix of parsed.fixes) await consume({ ...fix, source: 'replay', traceId: parsed.header.traceId });
    },
  };
}
