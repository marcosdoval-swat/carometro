// ui.js — controla o fluxo de telas (primeira tela vs. resultados)
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('municipio');
  const btn   = document.getElementById('btnBuscar');
  const results = document.getElementById('results');

  // 1) Primeira carga: esconde resultados
  if (results) results.hidden = true;

  function revealIfReady() {
    const hasValue = (input?.value || '').trim().length > 0;
    if (!hasValue) return;

    // 2) Mostra resultados (a busca efetiva continua sendo feita pelo app.js)
    results.hidden = false;

    // 3) Opcional: rolar para o início dos resultados
    setTimeout(() => {
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  // Clicar no BUSCAR
  btn?.addEventListener('click', revealIfReady);

  // Teclar ENTER no campo
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      revealIfReady();
    }
  });
});
