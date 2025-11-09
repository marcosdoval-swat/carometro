// ui.js — controla o modo "capa" (hero) x "resultados" e mantém a busca sempre visível
(function () {
  const $ = (sel) => document.querySelector(sel);

  // Seleções de blocos que só devem aparecer DEPOIS da busca
  const blocks = [
    '#card',          // card do prefeito
    '.totais',        // totais
    '.charts',        // gráficos
    '.filters',       // filtros
    '.table',         // tabela
    '.export'         // botão PDF
  ]
  .map(sel => $(sel))
  .filter(Boolean);

  // Se existir, o bloco da capa (arte/“hero”)
  const hero = $('.hero-wrap'); // ok se não existir

  function setMode(hasResult) {
    if (hasResult) {
      // Mostrar resultados, ocultar capa
      blocks.forEach(el => el.style.display = '');
      if (hero) hero.style.display = 'none';
      document.body.classList.add('mode-results');
      document.body.classList.remove('mode-hero');
    } else {
      // Ocultar resultados, mostrar capa
      blocks.forEach(el => el.style.display = 'none');
      if (hero) hero.style.display = '';
      document.body.classList.add('mode-hero');
      document.body.classList.remove('mode-results');
    }
  }

  // Exibe CAPA ao carregar
  setMode(false);

  // Deixa disponível para o app.js forçar o modo resultados quando terminar o render
  window.setResultsMode = (on) => setMode(!!on);

  // Integração sem mexer no app.js: após clicar Buscar, checa se veio resultado
  const btn = $('#btnBuscar');
  const input = $('#municipio');

  // Enter no campo dispara o clique do botão
  input && input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btn && btn.click();
  });

  // Depois do clique, dá um tempo pro app.js preencher e decide o modo
  btn && btn.addEventListener('click', () => {
    setTimeout(() => {
      const nome = ($('#nomePrefeito')?.textContent || '').trim();
      const has = nome && nome !== 'Selecione um município';
      setMode(has);
    }, 120);
  });
})();
