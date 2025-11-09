// ui.js — popula o datalist, revela resultados e aciona o BUSCAR
document.addEventListener('DOMContentLoaded', () => {
  const input   = document.getElementById('municipio');
  const lista   = document.getElementById('municipios');
  const btn     = document.getElementById('btnBuscar');
  const results = document.getElementById('results');

  // 1) Na primeira carga, esconda a área de resultados
  if (results) results.hidden = true;

  // 2) Preenche o <datalist> com os municípios (caso ainda não esteja preenchido)
  async function preencherDatalistSeVazio() {
    if (!lista || (lista.options && lista.options.length > 0)) return;
    try {
      const resp = await fetch('carometro_normalizado.json', { cache: 'no-store' });
      const data = await resp.json();
      // tenta achar o campo de município, normalizando nomes
      const nomes = Array.from(
        new Set(
          data.map(r =>
            (r.municipio || r.Municipio || r.city || '').toString().trim()
          ).filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      nomes.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        lista.appendChild(opt);
      });
    } catch (e) {
      // silencioso para não quebrar a página se estiver offline
      console.warn('Não foi possível preencher o datalist:', e);
    }
  }

  preencherDatalistSeVazio();

  // 3) Quando tiver texto no campo e o usuário mandar buscar, revela resultados
  function revelarEAcionarBusca() {
    const hasValue = (input?.value || '').trim().length > 0;
    if (!hasValue) return;
    if (results) results.hidden = false;

    // aciona o clique do botão para o app.js tratar a busca
    // (isso preserva toda a sua lógica existente)
    btn?.click();

    // Role até o card de resultados
    setTimeout(() => {
      results?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  // ENTER no campo dispara a busca
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      revelarEAcionarBusca();
    }
  });

  // Clique no botão BUSCAR
  btn?.addEventListener('click', (e) => {
    // Se o app.js já “pegou” o clique, só garantimos que a área apareça
    if (results) results.hidden = false;
  });

  // Caso o botão não tenha listener do app.js ainda (ordem de scripts),
  // fazemos um fallback: ao soltar o clique, garantimos a busca.
  btn?.addEventListener('mouseup', () => {
    revelarEAcionarBusca();
  });
});
