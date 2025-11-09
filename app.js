/* app.js — Carômetro Prefeituras (robusto p/ campos variados)
   - Carrega carometro_normalizado.json
   - Indexa por município
   - Busca e renderiza card, totais, gráficos e tabela
*/

let DATA = [];
let MAP = new Map();       // key normalizada -> array de registros
let DISPLAY = new Map();   // key normalizada -> nome com capitalização original
let barChart, pieChart;

// =============== Utils =================
function normalizeStr(s){
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
}
function slug(s){
  return normalizeStr(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function toBrl(n){
  return (Number(n) || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}
// pega o primeiro campo existente dentre várias opções
const G = (o, keys) => {
  for (const k of keys){
    if (o && Object.prototype.hasOwnProperty.call(o, k)){
      const val = o[k];
      if (val !== undefined && val !== null && val !== "") return val;
    }
  }
  return null;
};
// converte valor "R$ 1.602.333,33" → 1602333.33
function toNum(v){
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const s = String(v)
    .replace(/[^\d.,-]/g, "")       // mantém dígitos, vírgula, ponto e sinal
    .replace(/\.(?=\d{3}\b)/g, "")  // remove pontos de milhar
    .replace(",", ".");             // vírgula -> ponto decimal
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
// tenta extrair um nome legível quando o campo é objeto
function asName(val){
  if (val == null) return "";
  if (typeof val === "string" || typeof val === "number") return String(val);
  if (typeof val === "object"){
    return (
      G(val, ["nome","Nome","name","Name"]) ||
      [G(val,["primeiro_nome","firstName"]), G(val,["sobrenome","lastName"])].filter(Boolean).join(" ") ||
      ""
    );
  }
  return String(val);
}

// soma por múltiplos nomes de campos (primeiro que existir em cada linha)
function sumByKeys(rows, keyOptions){
  return rows.reduce((acc, r) => acc + toNum(G(r, keyOptions)), 0);
}

// ================== Load & Index ==================
async function loadData(){
  const resp = await fetch("carometro_normalizado.json", { cache: "no-store" });
  DATA = await resp.json();

  MAP.clear();
  DISPLAY.clear();

  for (const r of DATA){
    const muni = G(r, ["municipio","Município","Municipio","cidade","Cidade"]) || "";
    const k = normalizeStr(muni);
    if (!k) continue;
    if (!MAP.has(k)) MAP.set(k, []);
    MAP.get(k).push(r);
    if (!DISPLAY.has(k)) DISPLAY.set(k, String(muni));
  }

  // popula o datalist de municípios (auto-complete)
  const dl = document.getElementById("municipios");
  if (dl){
    const opts = [...DISPLAY.values()].sort((a,b)=>a.localeCompare(b,"pt-BR"));
    dl.innerHTML = opts.map(m => `<option value="${m}"></option>`).join("");
  }
}

function attachEvents(){
  const input = document.getElementById("municipio");
  const btn   = document.getElementById("btnBuscar");

  btn?.addEventListener("click", () => {
    const q = (input?.value || "").trim();
    if (!q) return;
    buscarMunicipio(q);
  });

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter"){
      const q = (input?.value || "").trim();
      if (!q) return;
      buscarMunicipio(q);
    }
  });
}

// ================== Busca & Render ==================
function buscarMunicipio(nomeDigitado){
  const key = normalizeStr(nomeDigitado);
  const rows = MAP.get(key);
  if (!rows || rows.length === 0){
    alert("Município não encontrado.");
    return;
  }

  // registro base (metadados do prefeito)
  const r0 = rows[0];

  const municipio  = DISPLAY.get(key) || nomeDigitado;
  const prefeitoV  = G(r0, ["prefeito","Prefeito","nome_prefeito"]);
  const prefeito   = asName(prefeitoV);
  const partido    = G(r0, ["partido","Partido"]) || "";
  const mandato    = G(r0, ["mandato","Mandato"]) || "";
  const vice       = G(r0, ["vice","Vice"]) || "";
  const gabinete   = G(r0, ["gabinete","Gabinete"]) || "";
  const prefeitura = G(r0, ["prefeitura","Prefeitura"]) || "";
  const email      = G(r0, ["email","Email"]) || "";
  const celular    = G(r0, ["celular","Celular","telefone","Telefone"]) || "";

  setText("nomePrefeito", (prefeito ? `${prefeito} — ` : "") + municipio);
  setText("partido",    partido);
  setText("mandato",    mandato);
  setText("vice",       vice);
  setText("gabinete",   gabinete);
  setText("prefeitura", prefeitura);
  setText("email",      email);
  setText("celular",    celular);

  // foto (fallback: sua logo)
  const img = document.getElementById("fotoPrefeito");
  if (img){
    const asset = r0.foto_asset || `prefeitos/${slug(municipio)}.jpg`;
    img.onload  = () => { img.style.display = ""; };
    img.onerror = () => { img.src = "icons/icon-512.png"; img.style.display = ""; };
    img.src     = asset;
    img.style.display = "";
  }

  // ==== TOTAIS (listas amplas de sinônimos) ====
  const DEST_KEYS = [
    "destinado","Destinado",
    "valor_emenda","ValEmenda","Val. Emenda","valorEmenda","Val_Emenda",
    "valor_total","Valor Total","valor","Valor","Total"
  ];
  const EMP_KEYS = [
    "empenhado","Empenhado",
    "valor_empenhado","Valor_empenhado","valorEmpenhado","Valor Empenhado","Empenho","Empenho (R$)","Empenhado (R$)"
  ];
  const PAGO_KEYS = [
    "pago","Pago",
    "valor_pago","Valor_pago","valorPago","Pago (R$)","Valor Pago"
  ];
  const SALDO_KEYS = [
    "saldo","Saldo","a_pagar","A_Pagar","A pagar","Restos a pagar"
  ];

  const tDestinado = sumByKeys(rows, DEST_KEYS);
  const tEmpenhado = sumByKeys(rows, EMP_KEYS);
  const tPago      = sumByKeys(rows, PAGO_KEYS);
  const tSaldoCalc = tDestinado - tPago;
  const tSaldo     = sumByKeys(rows, SALDO_KEYS) || tSaldoCalc;

  setText("tDestinado", toBrl(tDestinado));
  setText("tEmpenhado", toBrl(tEmpenhado));
  setText("tPago",      toBrl(tPago));
  setText("tSaldo",     toBrl(tSaldo));

  // ==== GRÁFICOS ====
  desenharGraficos(rows, PAGO_KEYS);

  // ==== TABELA ====
  preencherTabela(rows, DEST_KEYS, EMP_KEYS, PAGO_KEYS);
}

function setText(id, value){
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}

// ================== Gráficos ==================
function desenharGraficos(rows, PAGO_KEYS){
  // Por Macro-área
  const porArea = {};
  rows.forEach(r => {
    const area = (G(r, ["macro_area","Macro_area","macroArea","Macro-Área","Macro área","Área"]) || "Outras").toString();
    porArea[area] = (porArea[area] || 0) + toNum(G(r, PAGO_KEYS));
  });
  const areaLabels = Object.keys(porArea);
  const areaValues = areaLabels.map(k => porArea[k]);

  // Por Situação
  const porSit = {};
  rows.forEach(r => {
    const s = (G(r, ["situacao","Situação","Situacao","status","Status"]) || "Sem info").toString();
    porSit[s] = (porSit[s] || 0) + toNum(G(r, PAGO_KEYS));
  });
  const sitLabels = Object.keys(porSit);
  const sitValues = sitLabels.map(k => porSit[k]);

  const barCtx = document.getElementById("barChart");
  if (barCtx){
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: "bar",
      data: { labels: areaLabels, datasets: [{ label: "Pago (R$)", data: areaValues }]},
      options: {
        responsive: true,
        plugins: { legend: { display: false }},
        scales: { y: { ticks: { callback: v => toBrl(v) } } }
      }
    });
  }

  const pieCtx = document.getElementById("pieChart");
  if (pieCtx){
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: "pie",
      data: { labels: sitLabels, datasets: [{ data: sitValues }]},
      options: { responsive: true }
    });
  }
}

// ================== Tabela ==================
function preencherTabela(rows, DEST_KEYS, EMP_KEYS, PAGO_KEYS){
  const tb = document.getElementById("tbody");
  if (!tb) return;
  tb.innerHTML = "";

  rows.forEach(r => {
    const ano   = G(r, ["ano","Ano"]) || "";
    const tipo  = G(r, ["tipo","Tipo"]) || "";
    const area  = G(r, ["macro_area","Macro_area","macroArea","Macro-Área","Macro área","Área"]) || "";
    const ben   = G(r, ["beneficiario","Beneficiário","beneficiário","Beneficiario","destinatario","Destinatário"]) || "";
    const obj   = G(r, ["objeto","Objeto","descricao","Descrição"]) || "";
    const sit   = G(r, ["situacao","Situação","Situacao","status","Status"]) || "";

    const vEm   = toNum(G(r, DEST_KEYS));
    const vEmp  = toNum(G(r, EMP_KEYS));
    const vPag  = toNum(G(r, PAGO_KEYS));

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ano}</td>
      <td>${tipo}</td>
      <td>${area}</td>
      <td>${ben}</td>
      <td>${obj}</td>
      <td>${sit}</td>
      <td>${toBrl(vEm)}</td>
      <td>${toBrl(vEmp)}</td>
      <td>${toBrl(vPag)}</td>
    `;
    tb.appendChild(tr);
  });
}

// ================ Init =================
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  attachEvents();
});
