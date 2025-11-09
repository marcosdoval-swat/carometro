// ui.js — controla a transição: primeira tela (arte) -> resultados
document.addEventListener('DOMContentLoaded', () => {
  const input   = document.getElementById('municipio');
  const btn     = document.getElementById('btnBuscar');
  const results = document.getElementById('results');

  // Começa exibindo só a arte (hero)
  if (results) results.hidden = true;

  function revelarResultadosSeTiverTexto() {
    if (!input) return;
    const ok = (input.value || '').trim().length > 0;
    if (!ok) return;

    // Mostra a seção de resultados
    results.hidden = false;

    // Rola suave até o início dos resultados
    setTimeout(() => {
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  btn?.addEventListener('click', revelarResultadosSeTiverTexto);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') revelarResultadosSeTiverTexto();
  });
});
