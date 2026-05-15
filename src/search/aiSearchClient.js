var AISearchClient = {
  async interpret(query) {
    const q = String(query || '').trim();
    if (!q) return { source: 'empty', filters: [], warnings: [], messages: ['Digite uma busca para interpretar.'], confidence: 0 };

    try {
      const response = await fetch('/api/interpret-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'API de IA indisponível.');
      }

      const data = await response.json();
      if (!Array.isArray(data.filters)) throw new Error('A IA retornou uma interpretação inválida.');

      return {
        source: data.source || 'openai',
        filters: data.filters,
        warnings: data.warnings || [],
        messages: data.messages || [],
        confidence: data.confidence || 0.8,
        raw: data.raw || null
      };
    } catch (error) {
      const local = ProfileFinder.interpretQuery(q);
      return {
        source: 'fallback-local',
        filters: local.filters || [],
        warnings: [`IA indisponível: ${error.message}`, ...(local.warnings || [])],
        messages: ['Usei o interpretador local como fallback.', ...(local.messages || [])],
        confidence: Math.min(local.confidence || 0.35, 0.55)
      };
    }
  }
};
window.AISearchClient = AISearchClient;
