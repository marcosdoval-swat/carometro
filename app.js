// app.js — Carômetro Prefeituras (versão robusta)
// Requer: Chart.js 4.x carregado no <head>, e elementos/IDs do seu index.html

(() => {
  const ENDPOINT = 'carometro_normalizado.json';

  // Utilidades ----------------------------
  const fmtBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const byId = (id) => document.getElementById(id);
  const setText = (id, v) => { const el = byId(id); if (el) el.textContent = v ?? ''; };

  const norm = (s='') => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

  // Estado de gráficos (para destruir entre buscas)
  let barChartInst = null;
  let pieChartInst = null;

  // DOM refs principais -------------------
  const $municipio = byId('municipio');
  const $btnBuscar = byId('btnBuscar');
  const $datalist  = byId('municipios');
  const $results   = byId('results') || document; // se não existir "results", usa document

  // Carregamento inicial ------------------
  let DB = [];

  fetch(ENDPOINT)
    .then(r => r.json())
    .then(json => {
      DB = Array.isArray(json) ? json : [];
      popularDatalist(DB);
      // Se o usuário já digitou antes (autocomplete do iOS), deixa pronto:
      if ($municipio && $municipio.value) buscarMunicipio($municipio.value);
    })
    .catch(console.error);

  // Preenche datalist com nomes de municípios
  function popularDatalist(data) {
    if (!$datalist) return;
    $datalist.innerHTML = data
      .map(m => `<option value="${escapeHtml(m.municipio)}"></option>`)
      .join('');
  }

  // Busca e render ------------------------
  function buscarMunicipio(entrada) {
    if (!entrada) return;

    const alvo = norm(entrada);
    const item = DB.find(m => norm(m.municipio) === alvo) ||
                 DB.find(m => norm(m.municipio).includes(alvo));

    if (!item) {
      alert('Município não encontrado.');
      return;
    }

    // 1) Cabeçalho (nome + foto)
    const foto = byId('fotoPrefeito');
    if (foto) {
      const src = item.foto_asset ? item.foto_asset : 'icons/icon-512.png';
      foto.src = src;
      foto.onload = () => (foto.style.display = '');
      foto.onerror = () => { foto.src = 'icons/icon-512.png'; foto.style.display = ''; };
    }

    const nome = item?.prefeito?.nome || 'Prefeito(a)';
    setText('nomePrefeito', `${nome} — ${item.municipio}`);

    // 2) Dados do prefeito/contatos
    setText('partido',   item?.prefeito?.partido || '');
    setText('mandato',   item?.prefeito?.mandato || '');
    setText('vice',      item?.prefeito?.vice || '');

    // Mapeamento de contatos conforme JSON
    const emailPref = item?.prefeito?.contatos?.email_prefeitura || '';
    const emailPers = item?.prefeito?.contatos?.email_pessoal    || '';
    const celular   = item?.prefeito?.contatos?.celular          || '';

    // Seu HTML tem campos "gabinete" e "prefeitura": usamos e-mail pessoal como "Gabinete" e
    // e-mail institucional como "Prefeitura". Ajuste se desejar outro texto.
    setText('gabinete',   emailPers);
    setText('prefeitura', emailPref);
    setText('email',      emailPref || emailPers);
    setText('celular',    celular);

    // 3) Totais
    const T = item?.totais || {};
    const vDest = num(T.destinado);
    const vEmp  = num(T.empenhado);
    const vPago = num(T.pago);
    const vSaldo= num(T.saldo ?? (vDest - vPago)); // fallback simples

    setText('tDestinado', fmtBR.format(vDest));
    setText('tEmpenhado', fmtBR.format(vEmp));
    setText('tPago',      fmtBR.format(vPago));
    setText('tSaldo',     fmtBR.format(vSaldo));

    // 4) Gráficos
    const rep = Array.isArray(item.repasses) ? item.repasses : [];

    // Macro-área: usa "totais_macroarea" se existir; senão soma pelos repasses
    const macroAgg = item.totais_macroarea
      ? item.totais_macroarea
      : aggregateMacroArea(rep);

    desenharBarChart(macroAgg);

    // Situação: soma por situação usando valor "mais realista" (pago > empenhado > emenda)
    const situAgg = aggregateSituacao(rep);
    desenharPieChart(situAgg);

    // 5) Filtros + Tabela
    montarFiltros(rep);
    renderTabela(rep);

    // Revela a área de resultados, se existir
    if ($results && $results.id === 'results') {
      $results.hidden = false;
      setTimeout(() => $results.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    }
  }

  // Filtros --------------------------------
  function montarFiltros(repasses) {
    const anos = [...new Set(repasses.map(r => r.ano).filter(Boolean))].sort((a,b)=>a-b);
    const tipos = uniqueSorted(repasses.map(r => r.tipo).filter(Boolean));
    const sits  = uniqueSorted(repasses.map(r => r.situacao || 'SEM-INFO'));

    fillSelect('fAno',  ['Ano (todos)', ...anos], [''].concat(anos));
    fillSelect('fTipo', ['Tipo (todos)', ...tipos], [''].concat(tipos));
    fillSelect('fSit',  ['Situação (todas)', ...sits], [''].concat(sits));

    ['fAno','fTipo','fSit'].forEach(id => {
      const sel = byId(id);
      if (!sel) return;
      sel.onchange = () => {
        const filtrado = filtraRepasses(repasses);
        renderTabela(filtrado);
        desenharBarChart(aggregateMacroArea(filtrado));
        desenharPieChart(aggregateSituacao(filtrado));
      };
    });
  }

  function filtraRepasses(repasses) {
    const ano = byId('fAno')?.value || '';
    const tipo= byId('fTipo')?.value || '';
    const sit = byId('fSit')?.value || '';

    return repasses.filter(r =>
      (ano  ? String(r.ano) === String(ano) : true) &&
      (tipo ? r.tipo === tipo : true) &&
      (sit  ? (r.situacao || 'SEM-INFO') === sit : true)
    );
  }

  function fillSelect(id, labels, values) {
    const sel = byId(id);
    if (!sel) return;
    sel.innerHTML = labels.map((lab,i) => `<option value="${escapeHtml(String(values[i]))}">${escapeHtml(String(lab))}</option>`).join('');
  }

  // Tabela ---------------------------------
  function renderTabela(repasses) {
    const tbody = byId('tbody');
    if (!tbody) return;

    tbody.innerHTML = repasses.map(r => {
      const emenda = num(r.valor_emenda);
      const empenh = num(r.valor_empenhado);
      const pago   = num(r.valor_pago);

      return `
        <tr>
          <td>${escapeHtml(r.ano ?? '')}</td>
          <td>${escapeHtml(r.tipo ?? '')}</td>
          <td>${escapeHtml(r.macro_area ?? r.area ?? '')}</td>
          <td>${escapeHtml(r.beneficiario ?? '')}</td>
          <td>${escapeHtml(r.objeto ?? '')}</td>
          <td>${escapeHtml(r.situacao ?? 'SEM-INFO')}</td>
          <td>${fmtBR.format(emenda)}</td>
          <td>${fmtBR.format(empenh)}</td>
          <td>${fmtBR.format(pago)}</td>
        </tr>`;
    }).join('');
  }

  // Agregações -----------------------------
  function aggregateMacroArea(repasses) {
    const map = new Map();
    for (const r of repasses) {
      const key = r.macro_area || 'Outras';
      const v = num(r.valor_pago ?? r.valor_empenhado ?? r.valor_emenda);
      map.set(key, (map.get(key) || 0) + v);
    }
    return Object.fromEntries(map);
  }

  function aggregateSituacao(repasses) {
    const map = new Map();
    for (const r of repasses) {
      const key = (r.situacao || 'SEM-INFO').toUpperCase();
      const v = num(r.valor_pago ?? r.valor_empenhado ?? r.valor_emenda);
      map.set(key, (map.get(key) || 0) + v);
    }
    return Object.fromEntries(map);
  }

  // Charts ---------------------------------
  function desenharBarChart(macroAgg) {
    const ctx = byId('barChart');
    if (!ctx) return;

    const labels = Object.keys(macroAgg);
    const data   = labels.map(k => macroAgg[k]);

    if (barChartInst) barChartInst.destroy();
    barChartInst = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Por Macro-área', data }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: v => fmtBR.format(v) } }
        }
      }
    });
  }

  function desenharPieChart(situAgg) {
    const ctx = byId('pieChart');
    if (!ctx) return;

    const labels = Object.keys(situAgg);
    const data   = labels.map(k => situAgg[k]);

    if (pieChartInst) pieChartInst.destroy();
    pieChartInst = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data }] },
      options: {
        responsive: true,
        plugins: { legend: { position: 'right' } },
        cutout: '55%'
      }
    });
  }

  // Eventos --------------------------------
  $btnBuscar?.addEventListener('click', () => buscarMunicipio($municipio?.value));
  $municipio?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') buscarMunicipio($municipio.value);
  });

  // Helpers --------------------------------
  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function uniqueSorted(arr) {
    return [...new Set(arr.filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), 'pt-BR'));
  }

  function escapeHtml(s='') {
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }
})();
