
// app.js — Carômetro (PWA)

let DATA = [];
let MAP = new Map();
let barChart, pieChart;

/* ===========================================================
   Placeholder OFFLINE com as iniciais do município (canvas)
   =========================================================== */
function initialsFromName(name){
  const stop = new Set(['de','da','do','dos','das']);
  return (name || '')
    .split(/\s+/)
    .filter(w => w && !stop.has(w.toLowerCase()))
    .slice(0,3)
    .map(w => w[0].toUpperCase())
    .join('') || 'PF';
}
function placeholderWithInitials(name){
  const c = document.createElement('canvas');
  c.width = c.height = 280;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#167766';              // fundo
  ctx.fillRect(0,0,280,280);
  ctx.fillStyle = '#fff';                 // texto
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 120px -apple-system, system-ui, Arial';
  ctx.fillText(initialsFromName(name), 140, 150);
  return c.toDataURL('image/jpeg', 0.9);
}

/* =========================
   Utilitários
   ========================= */
async function loadData(){
  const resp = await fetch('carometro_normalizado.json');
  DATA = await resp.json();
  MAP = new Map();
  DATA.forEach(m => MAP.set((m.municipio || '').toLowerCase(), m));
  const dl = document.getElementById('municipios');
  if (dl) dl.innerHTML = DATA.map(m => `<option value="${m.municipio}">`).join('');
}
function currency(v){
  if (v == null) return 'R$ 0';
  try { return Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  catch { return 'R$ ' + String(v); }
}
function slug(s){
  return (s || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu,'')
    .replace(/[^a-z0-9]+/gi,'-').replace(/(^-|-$)/g,'')
    .toLowerCase();
}

/* =========================
   Preenche card do prefeito
   ========================= */
function fillCard(m){
  const p = m.prefeito || {};
  const c = p.contatos || {};

  const nomeEl = document.getElementById('nomePrefeito');
  if (nomeEl) nomeEl.textContent = `${p.nome || 'Prefeito'} — ${m.municipio}`;

  const partido = document.getElementById('partido');
  const mandato = document.getElementById('mandato');
  const vice    = document.getElementById('vice');
  const gabinete= document.getElementById('gabinete');
  const prefeitura = document.getElementById('prefeitura');
  const email   = document.getElementById('email');
  const celular = document.getElementById('celular');

  if (partido)   partido.textContent   = p.partido || '';
  if (mandato)   mandato.textContent   = p.mandato || '';
  if (vice)      vice.textContent      = p.vice || '';
  if (gabinete)  gabinete.textContent  = c.gabinete || '';
  if (prefeitura)prefeitura.textContent= c.prefeitura || '';
  if (email)     email.textContent     = c.email_prefeitura || c.email_pessoal || '';
  if (celular)   celular.textContent   = c.celular || '';

  // Foto do prefeito (ou placeholder com iniciais)
  const img = document.getElementById('fotoPrefeito');
  if (img){
    const asset = m.foto_asset || `prefeitos/${slug(m.municipio)}.jpg`;
    img.src = asset;
    img.onerror = () => { img.src = placeholderWithInitials(m.municipio); };
  }
}

/* =========================
   Filtros e tabela
   ========================= */
function uniqueSorted(a){ return [...new Set(a.filter(Boolean))].sort(); }

function buildFilters(m){
  const fAno  = document.getElementById('fAno');
  const fTipo = document.getElementById('fTipo');
  const fSit  = document.getElementById('fSit');
  if (!fAno || !fTipo || !fSit) return;

  const anos = uniqueSorted(m.repasses.map(r => r.ano));
  const tipos= uniqueSorted(m.repasses.map(r => r.tipo));
  const sits = uniqueSorted(m.repasses.map(r => r.situacao));

  fAno.innerHTML  = '<option value="">Ano (todos)</option>' + anos.map(a => `<option>${a}</option>`).join('');
  fTipo.innerHTML = '<option value="">Tipo (todos)</option>' + tipos.map(t => `<option>${t}</option>`).join('');
  fSit.innerHTML  = '<option value="">Situação (todas)</option>' + sits.map(s => `<option>${s}</option>`).join('');
}

function applyFilters(m){
  const fAno  = document.getElementById('fAno');
  const fTipo = document.getElementById('fTipo');
  const fSit  = document.getElementById('fSit');
  const ano = fAno?.value || '';
  const tipo= fTipo?.value || '';
  const sit = fSit?.value || '';
  return (m.repasses || []).filter(r =>
    (!ano  || String(r.ano) === String(ano)) &&
    (!tipo || r.tipo === tipo) &&
    (!sit  || r.situacao === sit)
  );
}

function fillTotals(m){
  const t = m.totais || {};
  const d = document.getElementById('tDestinado');
  const e = document.getElementById('tEmpenhado');
  const p = document.getElementById('tPago');
  const s = document.getElementById('tSaldo');
  if (d) d.textContent = currency(t.destinado || 0);
  if (e) e.textContent = currency(t.empenhado || 0);
  if (p) p.textContent = currency(t.pago || 0);
  if (s) s.textContent = currency(t.saldo || 0);
}

/* =========================
   Gráficos (Chart.js)
   ========================= */
function drawCharts(m, rows){
  const barEl = document.getElementById('barChart');
  const pieEl = document.getElementById('pieChart');
  if (!barEl || !pieEl) return;

  const groups = {'Saúde':0,'Segurança':0,'Educação':0,'Outras':0};
  rows.forEach(r => {
    const base = r.valor_pago ?? r.valor_empenhado ?? 0;
    const key = r.macro_area || 'Outras';
    groups[key] = (groups[key] || 0) + Number(base || 0);
  });

  const labelsBar = Object.keys(groups);
  const dataBar   = labelsBar.map(k => groups[k] || 0);

  if (barChart) barChart.destroy();
  barChart = new Chart(barEl.getContext('2d'), {
    type: 'bar',
    data: { labels: labelsBar, datasets: [{ label: 'Total (R$)', data: dataBar }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  const sitGroups = {};
  rows.forEach(r => { sitGroups[r.situacao || '—'] = (sitGroups[r.situacao || '—'] || 0) + Number(r.valor_pago ?? r.valor_empenhado ?? 0); });
  const labelsPie = Object.keys(sitGroups);
  const dataPie   = labelsPie.map(k => sitGroups[k] || 0);

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pieEl.getContext('2d'), {
    type: 'pie',
    data: { labels: labelsPie, datasets: [{ data: dataPie }] },
    options: { responsive: true }
  });
}

/* =========================
   Tabela
   ========================= */
function fillTable(rows){
  const tbody = document.getElementById('tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.ano ?? ''}</td>
      <td>${r.tipo ?? ''}</td>
      <td>${r.area ?? ''}</td>
      <td>${r.beneficiario ?? ''}</td>
      <td>${r.objeto ?? ''}</td>
      <td>${r.situacao ?? ''}</td>
      <td>${currency(r.valor_emenda || 0)}</td>
      <td>${currency(r.valor_empenhado || 0)}</td>
      <td>${currency(r.valor_pago || 0)}</td>
    </tr>
  `).join('');
}

/* =========================
   Renderização principal
   ========================= */
function renderMunicipio(name){
  const m = MAP.get((name || '').toLowerCase());
  if (!m){ alert('Município não encontrado.'); return; }
  fillCard(m);
  fillTotals(m);
  buildFilters(m);
  const rows = applyFilters(m);
  drawCharts(m, rows);
  fillTable(rows);
}

/* =========================
   Eventos e inicialização
   ========================= */
window.addEventListener('load', async () => {
  await loadData();

  const btnBuscar = document.getElementById('btnBuscar');
  const inp = document.getElementById('municipio');
  const fAno  = document.getElementById('fAno');
  const fTipo = document.getElementById('fTipo');
  const fSit  = document.getElementById('fSit');
  const btnPDF= document.getElementById('btnPDF');

  if (btnBuscar) btnBuscar.addEventListener('click', () => renderMunicipio(inp?.value));
  if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') renderMunicipio(inp.value); });
  [fAno, fTipo, fSit].forEach(el => el && el.addEventListener('change', () => {
    const m = MAP.get((inp?.value || '').toLowerCase());
    if (m){ const rows = applyFilters(m); drawCharts(m, rows); fillTable(rows); }
  }));
  if (btnPDF) btnPDF.addEventListener('click', () => window.print());

  // PWA install
  let deferredPrompt;
  const btnInstall = document.getElementById('btnInstall');
  window.addEventListener('beforeinstallprompt',(e)=>{
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstall) {
      btnInstall.hidden = false;
      btnInstall.onclick = async () => {
        btnInstall.hidden = true;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      };
    }
  });

  // Service Worker
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
});
