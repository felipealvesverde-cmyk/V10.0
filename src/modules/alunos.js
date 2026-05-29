// V35.3.0 — Área de Alunos (placeholder).
//
// Visual em paleta semântica CS (#6BBEF9). Quando Felipe der OK,
// virá a integração com Hotmart Club API:
//   - Lista de alunos por curso
//   - Progresso por módulo (% completo)
//   - Webhooks CLUB_FIRST_ACCESS e CLUB_MODULE_COMPLETED já mapeados
//     em EVENT_MAP do service (V35.2.0) — só falta plugar.
//
// Roadmap futuro (não implementar até comando explícito):
//   - GET /api/hotmart-club-students (paginated)
//   - Tab "Geral" + sub-tabs por curso
//   - Tags lj-club-acessou, lj-club-modulo-X-completo, lj-club-zero-acesso-30d

window.AlunosModule = {
  render() {
    return `<div class="space-y-4">
      <!-- Hero da página, paleta CS azul -->
      <div class="rounded-3xl p-6 lg:p-8" style="background: linear-gradient(135deg, rgba(107,190,249,.18), rgba(147,197,253,.10)); border: 1px solid rgba(107,190,249,.30);">
        <div class="flex items-start gap-4">
          <div class="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center" style="background: rgba(107,190,249,.20); border: 1px solid rgba(107,190,249,.40);">
            <i data-lucide="graduation-cap" class="w-7 h-7" style="color: #6BBEF9;"></i>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black uppercase tracking-widest mb-1" style="color: #6BBEF9;">CS · Pós-venda</p>
            <h2 class="text-2xl lg:text-3xl font-black text-slate-900">Área de Alunos</h2>
            <p class="text-sm text-slate-600 mt-2">Acompanhe o progresso dos seus alunos nos cursos da Hotmart. Quem acessou, quem completou módulos, quem está em risco de churn.</p>
          </div>
        </div>
      </div>

      <!-- Card "Em construção" -->
      <div class="rounded-3xl bg-white border-2 border-dashed p-8 text-center" style="border-color: rgba(107,190,249,.35);">
        <div class="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4" style="background: rgba(107,190,249,.10);">
          <i data-lucide="hard-hat" class="w-8 h-8" style="color: #6BBEF9;"></i>
        </div>
        <h3 class="text-xl font-black text-slate-900 mb-2">Em construção</h3>
        <p class="text-sm text-slate-600 max-w-md mx-auto mb-6">
          Esta área vai conectar com a <strong>Hotmart Club API</strong> pra trazer dados de engajamento pós-venda. Disponível em breve.
        </p>

        <!-- Preview do que vai vir -->
        <div class="max-w-2xl mx-auto text-left">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">O que vai chegar:</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${[
              { icon: 'list-checks', title: 'Lista de alunos por curso', desc: 'Quem comprou e quem entrou na área de membros.' },
              { icon: 'trending-up',  title: 'Progresso por módulo',     desc: 'Percentual completo, último acesso, conclusão.' },
              { icon: 'alert-circle', title: 'Alunos em risco',           desc: 'Quem comprou mas nunca acessou em 30+ dias.' },
              { icon: 'award',        title: 'Conclusão de curso',        desc: 'Tags lj-club-completou aplicadas automaticamente.' }
            ].map(p => `<div class="flex items-start gap-3 p-3 rounded-2xl border" style="background: rgba(107,190,249,.04); border-color: rgba(107,190,249,.20);">
              <div class="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style="background: rgba(107,190,249,.12);">
                <i data-lucide="${p.icon}" class="w-4 h-4" style="color: #6BBEF9;"></i>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-black text-slate-900">${p.title}</p>
                <p class="text-xs text-slate-500 mt-0.5">${p.desc}</p>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <!-- Status técnico (transparência) -->
        <div class="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest" style="background: rgba(107,190,249,.10); color: #6BBEF9;">
          <span class="w-1.5 h-1.5 rounded-full" style="background: #6BBEF9;"></span>
          Roadmap V35.3 · Hotmart Club API standby
        </div>
      </div>
    </div>`;
  }
};
