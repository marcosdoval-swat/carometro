// app.js — Carômetro Prefeituras (substituir tudo)
let DATA = [];
let INDEX = new Map();
let barChart, pieChart;

const $ = (id) => document.getElementById(id);

// ============================
// Utilitários
// ============================
function normalizeText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function slug(s) {
  return normalizeText(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function brl(n) {
  if (!isFinite(n)) n = 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function num(x) {
  if (typeof x === "number") return x;
  if (x == null) return 0;
  const s = String(x).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  const v = parseFloat(s);
  return isNaN(v) ? 0 : v;
}

function setText(id, v) {
  const el = $(id);
  if (el) el.textContent = v || "";
}

// ============================
// Carregar dados e indexar
// ============================
async function loadData() {
  const resp = await fetch("carometro_normalizado.json");
  DATA = await resp.json(); // espera array

  INDEX.clear();
  for (const r of DATA) {
    const key = normalizeText(r.municipio || r.Municipio || "");
    if (!key) continue;
    if (!INDEX.has(key)) INDEX.set(key, []);
    INDEX.get(key).push(r);
  }

  // Preenche o datalist com nomes "bonitos"
  const dl = $("municipios");
  if (dl) {
    dl.innerHTML = [...INDEX.keys()]
      .map((k) => {
        const rec = INDEX.get(k)[0];
        const display = rec.municipio || rec.Municipio || k;
        return `<option value="${display}"></option>`;
      })
      .join("");
  }
}

// ============================
// Busca e renderização
// ============================
function buscarMunicipio() {
  const input = $("municipio");
  const q = (input?.value || "").trim();
  if (!q) return;

  const key = normalizeText(q);
  const list = INDEX.get(key) || [];

  // Sem dados para esse município
  if (list.length === 0) {
    renderEmpty(q);
    return;
  }

  // 1) Meta (prefeito e campos básicos)
  const meta = list.find((r) => r.prefeito || r.Prefeito) || list[0];
  const municipio = meta.municipio || meta.Municipio || q;
  const nomePrefeito = meta.prefeito || meta.Prefeito || "";

  const img = $("fotoPrefeito");
  if (img) {
    const asset = meta.foto_asset || `prefeitos/${slug(municipio)}.jpg`;
    img.onload = () => (img.style.display = "");
    img.onerror = () => {
      img.src = "icons/icon-512.png";
      img.style.display = "";
    };
    img.src = asset;
  }

  const h2 = $("nomePrefeito");
  if (h2) h2.textContent = `${nomePrefeito} — ${municipio}`;

  setText("partido", meta.partido || meta.Partido || "");
  setText("mandato", meta.mandato || meta.Mandato || "");
  setText("vice", meta.vice || meta.Vice || "");
  setText("gabinete", meta.gabinete || meta.Gabinete || "");
  setText("prefeitura", meta.prefeitura || meta.Prefeitura || "");
  setText("email", meta.email || meta.Email || "");
  setText("celular", meta.celular || meta.Celular || "");

  // 2) Totais
  let destinado = 0,
    empenhado = 0,
    pago = 0;

  for (const r of list) {
    destinado += num(
      r.valor_emenda ?? r.destinado ?? r.ValorEmenda ?? r.Valor ?? 0
    );
    empenhado += num(r.empenhado ?? r.Empenhado ?? 0);
    pago += num(r.pago ?? r.Pago ?? 0);
  }
  const saldo = Math.max(0, empenhado - pago);

  setText("tDestinado", brl(destinado));
  setText("tEmpenhado", brl(empenhado));
  setText("tPago", brl(pago));
  setText("tSaldo", brl(saldo));

  // 3) Tabela
  const tbody = $("tbody");
  if (tbody) {
    tbody.innerHTML = list
      .map((r) => {
        const ano = r.ano ?? r.Ano ?? "";
        const tipo = r.tipo ?? r.Tipo ?? "";
        const area = r.area ?? r.Area ?? "";
        const benef = r.beneficiario ?? r.Beneficiario ?? "";
        const objeto = r.objeto ?? r.Objeto ?? "";
        const sit = r.situacao ?? r.Situacao ?? "";
        const val = brl(
          num(r.valor_emenda ?? r.destinado ?? r.ValorEmenda ?? r.Valor ?? 0)
        );
        const emp = brl(num(r.empenhado ?? r.Empenhado ?? 0));
        const pg = brl(num(r.pago ?? r.Pago ?? 0));
        return `<tr>
          <td>${ano}</td><td>${tipo}</td><td>${area}</td>
          <td>${benef}</td><td>${objeto}</td><td>${sit}</td>
          <td>${val}</td><td>${emp}</td><td>${pg}</td>
        </tr>`;
      })
      .join("");
  }

  // 4) Filtros
  buildFilters(list);

  // 5) Gráficos
  drawCharts(list);
}

function renderEmpty(q) {
  const h2 = $("nomePrefeito");
  if (h2) h2.textContent = `Sem dados para: ${q}`;
  setText("partido", "");
  setText("mandato", "");
  setText("vice", "");
  setText("gabinete", "");
  setText("prefeitura", "");
  setText("email", "");
  setText("celular", "");
  setText("tDestinado", brl(0));
  setText("tEmpenhado", brl(0));
  setText("tPago", brl(0));
  setText("tSaldo", brl(0));
  const tbody = $("tbody");
  if (tbody) tbody.innerHTML = "";
  drawCharts([]);
}

function buildFilters(list) {
  const anos = new Set();
  const tipos = new Set();
  const sits = new Set();
  for (const r of list) {
    if (r.ano ?? r.Ano) anos.add(r.ano || r.Ano);
    if (r.tipo ?? r.Tipo) tipos.add(r.tipo || r.Tipo);
    if (r.situacao ?? r.Situacao) sits.add(r.situacao || r.Situacao);
  }
  const fAno = $("fAno");
  const fTipo = $("fTipo");
  const fSit = $("fSit");
  if (fAno)
    fAno.innerHTML =
      `<option value="">Ano (todos)</option>` +
      [...anos].sort().map((a) => `<option>${a}</option>`).join("");
  if (fTipo)
    fTipo.innerHTML =
      `<option value="">Tipo (todos)</option>` +
      [...tipos].sort().map((a) => `<option>${a}</option>`).join("");
  if (fSit)
    fSit.innerHTML =
      `<option value="">Situação (todas)</option>` +
      [...sits].sort().map((a) => `<option>${a}</option>`).join("");
}

function groupSum(list, keySel) {
  const map = new Map();
  for (const r of list) {
    const key = keySel(r);
    const v = num(
      r.valor_emenda ?? r.destinado ?? r.ValorEmenda ?? r.Valor ?? 0
    );
    map.set(key, (map.get(key) || 0) + v);
  }
  const labels = [...map.keys()];
  const values = labels.map((k) => map.get(k));
  return { labels, values };
}

function drawCharts(list) {
  const bc = $("barChart");
  const pc = $("pieChart");

  if (barChart) barChart.destroy();
  if (pieChart) pieChart.destroy();

  if (!list || list.length === 0) {
    if (bc) bc.getContext("2d").clearRect(0, 0, bc.width, bc.height);
    if (pc) pc.getContext("2d").clearRect(0, 0, pc.width, pc.height);
    return;
  }

  const byArea = groupSum(list, (r) => r.area || r.Area || "—");
  const bySit = groupSum(list, (r) => r.situacao || r.Situacao || "—");

  if (bc) {
    barChart = new Chart(bc, {
      type: "bar",
      data: {
        labels: byArea.labels,
        datasets: [{ label: "Destinado", data: byArea.values }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: {
              callback: (v) => brl(v),
            },
          },
        },
      },
    });
  }

  if (pc) {
    pieChart = new Chart(pc, {
      type: "doughnut",
      data: {
        labels: bySit.labels,
        datasets: [{ data: bySit.values }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    });
  }
}

// ============================
// Inicialização
// ============================
document.addEventListener("DOMContentLoaded", () => {
  loadData().then(() => {
    $("btnBuscar")?.addEventListener("click", buscarMunicipio);
    $("municipio")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") buscarMunicipio();
    });
  });
});
