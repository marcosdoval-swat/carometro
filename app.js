// app.js — Carômetro Prefeituras (versão robusta de parsing)
let DATA = [];              // linhas do JSON (array)
let MAP  = new Map();       // municipioNormalizado -> {rows:[], meta:{}}
let barChart, pieChart;

// ===================== Utils =====================
const STOP = new Set(['de','da','do','das','dos','e','-']);

function normalizeText(s){
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // tira acentos
    .toLowerCase()
    .replace(/[^\w\s-]/g,' ')     // troca pontuação por espaço
    .replace(/\s+/g,' ')          // espaços múltiplos
    .trim();
}
function slugMunicipio(s){
  // remove palavras “stop” iniciais e finais e hífens supérfluos
  const parts = normalizeText(s).split(' ').filter(x => x && !STOP.has(x));
  return parts.join(' ');
}
function initialsFromName(name){
  const w = normalizeText(name).split(' ').filter(x=>x && !STOP.has(x));
  return (w[0] ? w[0][0] : 'P').toUpperCase() + (w[1] ? w[1][0].toUpperCase() : 'F');
}
function currency(v){
  if (v == null || isNaN(v)) v = 0;
  return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function toNumberFlexible(v){
  // aceita "1.234.567,89", "1234567.89", número, ou string com "R$"
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v !== 'string') return 0;
  const clean = v.replace(/[^\d,.-]/g,'').replace(/\.(?=\d{3}\b)/g,''); // remove milhar
  // troca última vírgula por ponto
  const lastComma = clean.lastIndexOf(',');
  const fixed = lastComma >= 0 ? clean.slice(0,lastComma).replace(/,/g,'') + '.' + clean.slice(lastComma+1) : clean;
  const n = parseFloat(fixed);
  return isFinite(n) ? n : 0;
}
function pick(obj, keys){
  for (const k of keys){
    if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  }
  return null;
}

// ===================== Placeholder offline =====================
function placeholderWithInitials(name){
  const c = document.createElement('canvas');
  c.width = c.height = 280;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#167766';
  ctx.fillRect(0,0,280,280);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 120px -apple-system, system-ui, Arial';
  ctx.fillText(initialsFromName(name), 140, 150);
  return c.toDataURL('image/jpeg', 0.9);
}

// ===================== Carregamento do JSON =====================
async function loadData(){
  try{
    const resp = await fetch('carometro_normalizado.json', {cache:'no-cache'});
    DATA = await resp.json();
  }catch(e){
    console.error('Falha ao carregar JSON:', e);
    DATA = [];
  }

  // constrói MAP por município normalizado
  MAP.clear();
  for (const row of DATA){
    const muni = pick(row, ['municipio','Município','MUNICIPIO','cidade','Cidade','Municipio','Município/ES']) || '';
    const key  = slugMunicipio(muni);
    if (!key) continue;
    if (!MAP.has(key)) MAP.set(key, {rows:[], meta:{}});
    MAP.get(key).rows.push(row);
  }

  // prepara datalist
  const dl = document.getElementById('municipios');
  if (dl){
    dl.innerHTML = '';
    const seen = new Set();
    for (const row of DATA){
      const nome = pick(row, ['municipio','Município','MUNICIPIO','cidade','Cidade','Municipio','Município/ES']);
      if (!nome) continue;
      const key = normalizeText(nome);
      if (seen.has(key)) continue;
      seen.add(key);
      const opt = document.createElement('option');
      opt.value = nome;
      dl.appendChild(opt);
    }
  }
}

// ===================== Preencher tela =====================
function fillHeaderAndContacts(meta, rows){
  // tenta extrair nome do prefeito, partido etc. de diferentes formatos
  // nome do prefeito:
  let nomePref = pick(meta, ['prefeito','Prefeito','NOME','Nome']);
  if (nomePref && typeof nomePref === 'object'){
    nomePref = pick(nomePref, ['nome','Nome','nome_completo','completo']);
  }
  if (!nomePref){
    // procura na primeira linha algo como row.prefeito.nome
    const r0 = rows && rows[0] || {};
    const cand = pick(r0, ['prefeito','Prefeito']);
    nomePref = (typeof cand === 'object') ? pick(cand, ['nome','Nome','nome_completo']) : cand;
  }

  const municipio = pick(meta, ['municipio','Município','Municipio','cidade','Cidade','Município/ES']) ||
                    pick(rows?.[0], ['municipio','Município','Municipio','cidade','Cidade','Município/ES']) || '';

  // contatos/labels
  const partido   = pick(meta, ['partido','Partido','sigla_partido','SIGLA_PARTIDO']) ||
                    pick(rows?.[0], ['partido','Partido','sigla_partido','SIGLA_PARTIDO']) || '';
  const mandato   = pick(meta, ['mandato','Mandato','periodo','Período']) ||
                    pick(rows?.[0], ['mandato','Mandato','periodo','Período']) || '';
  const vice      = pick(meta, ['vice','Vice','vice_prefeito','Vice-Prefeito','Vice Prefeito']) ||
                    pick(rows?.[0], ['vice','Vice','vice_prefeito','Vice-Prefeito','Vice Prefeito']) || '';
  const gabinete  = pick(meta, ['gabinete','Gabinete']) ||
                    pick(rows?.[0], ['gabinete','Gabinete']) || '';
  const prefeitura= pick(meta, ['prefeitura','Prefeitura']) ||
                    pick(rows?.[0], ['prefeitura','Prefeitura']) || '';
  const email     = pick(meta, ['email','Email','e-mail','E-mail']) ||
                    pick(rows?.[0], ['email','Email','e-mail','E-mail']) || '';
  const celular   = pick(meta, ['celular','Celular','telefone','Telefone']) ||
                    pick(rows?.[0], ['celular','Celular','telefone','Telefone']) || '';

  // DOM
  const nomeEl = document.getElementById('nomePrefeito');
  if (nomeEl) nomeEl.textContent = `${nomePref || ''} — ${municipio || ''}`;

  const partidoEl = document.getElementById('partido');
  const mandatoEl = document.getElementById('mandato');
  const viceEl    = document.getElementById('vice');
  const gabEl     = document.getElementById('gabinete');
  const prefEl    = document.getElementById('prefeitura');
  const emailEl   = document.getElementById('email');
  const celEl     = document.getElementById('celular');

  if (partidoEl) partidoEl.textContent = partido || '';
  if (mandatoEl) mandatoEl.textContent = mandato || '';
  if (viceEl)    viceEl.textContent    = vice || '';
  if (gabEl)     gabEl.textContent     = gabinete || '';
  if (prefEl)    prefEl.textContent    = prefeitura || '';
  if (emailEl)   emailEl.textContent   = email || '';
  if (celEl)     celEl.textContent     = celular || '';
}

function choosePhotoAsset(muniKey, municipioVisivel, meta){
  // se existir meta.foto_asset, usa; senão tenta "prefeitos/{slug}.jpg"
  if (meta && typeof meta.foto_asset === 'string') return meta.foto_asset;

  // monta slug de arquivo: ex.: "vila-velha.jpg"
  const fileSlug = municipioVisivel
    ? normalizeText(municipioVisivel).replace(/\s+/g,'-')
    : muniKey.replace(/\s+/g,'-');

  return `prefeitos/${fileSlug}.jpg`;
}

function aggregateValues(rows){
  // soma procurando por nomes de chave comuns
  let destinado = 0, empenhado = 0, pago = 0;

  for (const r of rows){
    for (const [k, v] of Object.entries(r)){
      const key = normalizeText(k);
      const n   = toNumberFlexible(v);
      if (!n) continue;

      if (/(destinad|emenda|valor[\s_]*total|valor$)/.test(key)){
        destinado += n;
      }else if (/(empenh)/.test(key)){
        empenhado += n;
      }else if (/(pago|liquidado)/.test(key)){
        pago += n;
      }
    }
  }
  const saldo = Math.max(0, destinado - pago);
  return { destinado, empenhado, pago, saldo };
}

function fillTotals({destinado, empenhado, pago, saldo}){
  const tD = document.getElementById('tDestinado');
  const tE = document.getElementById('tEmpenhado');
  const tP = document.getElementById('tPago');
  const tS = document.getElementById('tSaldo');
  if (tD) tD.textContent = currency(destinado);
  if (tE) tE.textContent = currency(empenhado);
  if (tP) tP.textContent = currency(pago);
  if (tS) tS.textContent = currency(saldo);
}

function buildTable(rows){
  const tb = document.getElementById('tbody');
  if (!tb) return;
  tb.innerHTML = '';

  // cria algumas linhas (limit 100 para não pesar)
  const LIM = Math.min(100, rows.length);
  for (let i=0;i<LIM;i++){
    const r = rows[i] || {};
    const ano   = pick(r,['ano','Ano','exercicio','Exercício','Exercicio']) || '';
    const tipo  = pick(r,['tipo','Tipo','modalidade','Modalidade']) || '';
    const area  = pick(r,['area','Área','Area']) || '';
    const benef = pick(r,['beneficiario','Beneficiário','Beneficiario','entidade','Entidade']) || '';
    const obj   = pick(r,['objeto','Objeto','descricao','Descrição']) || '';
    const sit   = pick(r,['situacao','Situação','status','Status']) || '';
    // números
    const vEmenda   = toNumberFlexible(pick(r,[
      'valor_emenda','valorEmenda','Valor Emenda','valor','Valor','destinado','Destinado'
    ]));
    const vEmp      = toNumberFlexible(pick(r,[
      'empenhado','Empenhado','valor_empenhado','valorEmpenhado'
    ]));
    const vPago     = toNumberFlexible(pick(r,[
      'pago','Pago','valor_pago','valorPago','liquidado','Liquidado'
    ]));

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ano}</td>
      <td>${tipo}</td>
      <td>${area}</td>
      <td>${benef}</td>
      <td>${obj}</td>
      <td>${sit}</td>
      <td>${currency(vEmenda)}</td>
      <td>${currency(vEmp)}</td>
      <td>${currency(vPago)}</td>
    `;
    tb.appendChild(tr);
  }
}

function drawCharts(rows){
  // agrega por área e por situação
  const byArea = new Map();
  const bySit  = new Map();

  for (const r of rows){
    const area = normalizeText(pick(r,['area','Área','Area'])) || 'outras';
    const sit  = normalizeText(pick(r,['situacao','Situação','status','Status'])) || 'sem-info';
    const val  = toNumberFlexible(
      pick(r,['valor_emenda','valor','destinado','Valor Emenda','Destinado'])
    );

    byArea.set(area, (byArea.get(area) || 0) + val);
    bySit.set(sit,   (bySit.get(sit)   || 0) + val);
  }

  // Bar
  const bctx = document.getElementById('barChart');
  const pctx = document.getElementById('pieChart');
  if (!bctx || !pctx) return;

  const barLabels = Array.from(byArea.keys()).map(s => s.toUpperCase());
  const barData   = Array.from(byArea.values());

  if (barChart) barChart.destroy();
  barChart = new Chart(bctx, {
    type:'bar',
    data:{ labels: barLabels, datasets:[{ label:'R$ por Macro-área', data: barData }] },
    options:{ responsive:true, plugins:{legend:{display:false}} }
  });

  // Pie
  const pieLabels = Array.from(bySit.keys()).map(s => s.toUpperCase());
  const pieData   = Array.from(bySit.values());

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pctx, {
    type:'pie',
    data:{ labels: pieLabels, datasets:[{ data: pieData }] },
    options:{ responsive:true }
  });
}

// ===================== Busca principal =====================
async function buscarMunicipio(){
  const input = document.getElementById('municipio');
  const municipio = (input?.value || '').trim();
  if (!municipio) return;

  const key = slugMunicipio(municipio);
  const pack = MAP.get(key);

  const results = document.getElementById('results');
  if (results) results.hidden = false; // garante visível

  // Foto do prefeito
  const img = document.getElementById('fotoPrefeito');
  if (img){
    const asset = choosePhotoAsset(key, municipio, pack?.meta || {});
    img.style.display = '';
    img.onerror = () => {
      img.src = 'icons/icon-512.png'; // sua arte azul como fallback
      img.style.display = '';
      img.style.objectFit = 'contain';
    };
    img.src = asset;
  }

  if (!pack){
    // não encontrou: zera e sai
    fillHeaderAndContacts({ municipio }, []);
    fillTotals({destinado:0, empenhado:0, pago:0, saldo:0});
    buildTable([]);
    drawCharts([]);
    return;
  }

  // header/contatos
  fillHeaderAndContacts({ municipio, ...(pack.meta||{}) }, pack.rows);

  // totais
  const totals = aggregateValues(pack.rows);
  fillTotals(totals);

  // tabela
  buildTable(pack.rows);

  // gráficos
  drawCharts(pack.rows);

  // rola para os resultados
  setTimeout(()=>document.getElementById('card')?.scrollIntoView({behavior:'smooth'}), 60);
}

// ===================== Boot =====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();

  // eventos do campo/botão
  const btn = document.getElementById('btnBuscar');
  const input = document.getElementById('municipio');

  btn?.addEventListener('click', buscarMunicipio);
  input?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') buscarMunicipio(); });

  // se já houver valor (ex.: veio por histórico), busca
  if ((input?.value || '').trim()) buscarMunicipio();

  // registra o service worker se existir
  if ('serviceWorker' in navigator){
    try{ navigator.serviceWorker.register('service-worker.js'); }catch(e){}
  }
});
