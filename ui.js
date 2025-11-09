// ui.js — controla "Capa (hero)" x "Resultados"
// Mostra resultados SOMENTE quando o app.js já preencheu os dados.

(function () {
  const $ = (s) => document.querySelector(s);

  const input   = $('#municipio');
  const btn     = $('#btnBuscar');
  const results = $('#results');
  const hero    = $('.hero-wrap'); // capa

  // Esconde resultados ao carregar
  if (results) results.hidden = true;

  // Heurística: há resultados quando:
  // - nome do prefeito mudou do placeholder OU
  // - a tabela tem linhas OU
  // - já preencheu valores nos totais
  function hasResults() {
    const nome = ($('#nomePrefeito')?.textContent || '').trim();
    const okNome = nome && nome !== 'Selecione um município';

    const linhas = $('#tbody')?.querySelectorAll('tr')?.length || 0;
    const okTabela = linhas > 0;

    const tDest = ($('#tDestinado')?.textContent || '').trim();
    const okTotais = tDest && tDest !== 'R$ 0';

    return okNome || okTabela || okTotais;
  }

  function showResults(on) {
    if (!results) return;
    results.hidden = !on;
    if (hero) hero.style.display = on ? 'none' : '';
    document.body.classList.toggle('mode-results', !!on);
    document.body.classList.toggle('mode-hero', !on);
    // Rolagem confortável até o topo do conteúdo
    if (on) setTimeout(() => results.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  // Após clicar em BUSCAR (ou Enter), esperamos o app.js preencher e só então exibimos
  function handleSearchTrigger() {
    // Se campo vazio, volta pra capa
    const hasValue = (input?.value || '').trim().length > 0;
    if (!hasValue) { showResults(false); return; }

    // Espera curta pelo render do app.js
    const startedAt = Date.now();
    const timeoutMs = 1500;
    const tick = () => {
      if (hasResults()) {
        showResults(true);
      } else if (Date.now() - startedAt < timeoutMs) {
        setTimeout(tick, 80);
      } else {
        // Não veio nada: fica na capa
        showResults(false);
      }
    };
    tick();
  }

  btn?.addEventListener('click', handleSearchTrigger);

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearchTrigger();
  });

  // Expor gancho opcional: o app.js pode chamar quando terminar de renderizar
  window.setResultsMode = (on) => showResults(!!on);
})();
