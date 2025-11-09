/* app.js — Carômetro Prefeituras
   - Carrega carometro_normalizado.json
   - Monta índice por município
   - Busca e renderiza card, totais, gráficos e tabela
   - Mantém fallback de foto para icons/icon-512.png
*/

let DATA = [];
let MAP = new Map();
let barChart, pieChart;

// ===== Helpers =====
const G = (o, keys) => {
  for (const k of keys) if (o?.[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return null;
};

function normalizeStr(s){
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

function slug(str){
  return normalizeStr(str).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g,'');
}

function num(v){
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  // remove moeda, pontos e usa vírgula como decimal
  const s = String(v).replace(/[^\d,-]/g,'').replace(/\.(?=\d{3})/g,'').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function brl(v){ return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }

// ===== Carrega dados e indexa =====
async function loadData(){
  const resp = await fetch('carometro_normalizado.json', { cache: 'no-store' });
  DATA = await resp.json();

  MAP.clear();
  for (const r of DATA){
    const muni = G(r, ['municipio','Município','Municipio','cidade','Cidade']) || '';
    const key  = normalizeStr(muni);
    if (!key) continue;
    if (!MAP.has(key)) MAP.set(key, []);
    MAP.get(key).push(r);
  }
}

function attachEvents(){
  const input = document.getElementById('municipio');
  const btn   = document.getElementById('btnBuscar');

  // O ui.js já revela a área de resultados e aciona o clique.
  // Aqui garantimos que a busca ocorra quando clicarem no botão.
  btn?.addEventListener('click', () => {
    const termo = (input?.value || '').trim();
    if (!termo) return;
    buscarMunicipio(termo);
  });

  // ENTER no campo também dispara (defesa extra, caso ui.js não esteja carregado)
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter'){
      const termo = (input?.value || '').trim();
      if (!termo) return;
      buscarMunicipio(termo);
    }
  });
}

// ===== Renderização =====
function buscarMunicipio(nomeDigitado){
  const key = normalizeStr(nomeDigitado);
  const arr = MAP.get(key);
  if (!arr || arr.length === 0){
    alert('Município não encontrado.');
    return;
  }

  // Escolhe um registro "base" (normalmente todos compartilham os metadados do prefeito)
  const m = arr[0];

  const municipio  = G(m, ['municipio','Município','Municipio']) || nomeDigitado;
  const prefeito   = G(m, ['prefeito','Prefeito','nome_prefeito']) || '';
  const partido    = G(m, ['partido','Partido']) || '';
  const mandato    = G(m, ['mandato','Mandato']) || '';
  const vice       = G(m, ['vice','Vice']) || '';
  const gabinete   = G(m, ['gabinete','Gabinete']) || '';
  const prefeitura = G(m, ['prefeitura','Prefeitura']) || '';
  const email      = G(m, ['email','Email']) || '';
  const celular    = G(m, ['celular','Celular','telefone','Telefone']) || '';

  // Preenche card à direita
  setText('nomePrefeito',          (prefeito ? `${prefeito} — ` : '') + municipio);
  setText('partido',               partido);
  setText('mandato',               mandato);
  setText('vice',                  vice);
  setText('gabinete',              gabinete);
  setText('prefeitura',            prefeitura);
  setText('email',                 email);
  setText('celular',               celular);

  // Foto do prefeito
  const img = document.getElementById('fotoPrefeito');
  if (img){
    const asset = m.foto_asset || `prefeitos/${slug(municipio)}.jpg`;
    img.style.display = '';
    img.onload  = () => { img.style.display = ''; };
    img.onerror = () => {
      img.src = 'icons/icon-512.png'; // sua logo
      img.style.display = '';
    };
    img.src = asset;
  }

  // TOTAIS
  const tDestinado = soma(arr, ['destinado','Destinado']);
  const tEmpenhado = soma(arr, ['empenhado','Empenhado']);
  const tPago      = soma(arr, ['pago','Pago']);
  // saldo: preferir o campo, senão calcular
  const tSaldoCalc = tDestinado - tPago;
  const tSaldo     = soma(arr, ['saldo','Saldo']) || tSaldoCalc;

  setText('tDestinado', brl(tDestinado));
  setText('tEmpenhado', brl(tEmpenhado));
  setText('tPago',      brl(tPago));
  setText('tSaldo',     brl(tSaldo));

  // GRÁFICOS
  desenharGraficos(arr);

  // TABELA
  preencherTabela(arr);
}

function soma(arr, keys){
  return arr.reduce((s, r) => s + num(G(r, keys)), 0);
}

function setText(id, value){
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '';
}

// ===== Gráficos (Chart.js 4) =====
function desenharGraficos(arr){
  const porArea = {};
  arr.forEach(r => {
    const area = (G(r, ['macro_area','Macro_area','macroArea','Macro-Área','Área']) || 'Outras').toString();
    porArea[area] = (porArea[area] || 0) + num(G(r, ['pago','Pago']));
  });

  const areaLabels = Object.keys(porArea);
  const areaValues = areaLabels.map(k => porArea[k]);

  const porSit = {};
  arr.forEach(r => {
    const s = (G(r, ['situacao','Situação','Situacao']) || 'Sem info').toString();
    porSit[s] = (porSit[s] || 0) + num(G(r, ['pago','Pago']));
  });

  const sitLabels = Object.keys(porSit);
  const sitValues = sitLabels.map(k => porSit[k]);

  // Bar
  const barCtx = document.getElementById('barChart');
  if (barCtx){
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: areaLabels,
        datasets: [{ label: 'Pago (R$)', data: areaValues }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: {
              callback: v => brl(Number(v) || 0)
            }
          }
        }
      }
    });
  }

  // Pie
  const pieCtx = document.getElementById('pieChart');
  if (pieCtx){
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: sitLabels,
        datasets: [{ data: sitValues }]
      },
      options: { responsive: true }
    });
  }
}

// ===== Tabela =====
function preencherTabela(arr){
  const tb = document.getElementById('tbody');
  if (!tb) return;
  tb.innerHTML = '';

  arr.forEach(r => {
    const tr = document.createElement('tr');

    const ano   = G(r, ['ano','Ano']) || '';
    const tipo  = G(r, ['tipo','Tipo']) || '';
    const area  = G(r, ['macro_area','Macro_area','macroArea','Macro-Área','Área']) || '';
    const ben   = G(r, ['beneficiario','Beneficiário','beneficiário','Beneficiario']) || '';
    const obj   = G(r, ['objeto','Objeto']) || '';
    const sit   = G(r, ['situacao','Situação','Situacao']) || '';
    const vlEm  = num(G(r, ['valor_emenda','ValEmenda','Val. Emenda','valorEmenda','Val_Emenda']));
    const empen = num(G(r, ['empenhado','Empenhado']));
    const pago  = num(G(r, ['pago','Pago']));

    tr.innerHTML = `
      <td>${ano}</td>
      <td>${tipo}</td>
      <td>${area}</td>
      <td>${ben}</td>
      <td>${obj}</td>
      <td>${sit}</td>
      <td>${brl(vlEm)}</td>
      <td>${brl(empen)}</td>
      <td>${brl(pago)}</td>
    `;
    tb.appendChild(tr);
  });
}

// ===== Inicialização =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  attachEvents();
});
