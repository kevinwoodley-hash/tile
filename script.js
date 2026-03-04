// TileIQ • UI shell wiring (tabs + sealant deduction list demo)
// You can merge these functions into your existing script.js logic safely.

const $ = (id) => document.getElementById(id);

function fmt(n, dp=1){
  const x = Number(n);
  if (!isFinite(x)) return "—";
  return x.toFixed(dp);
}

function addDeduction(data = { label: "", metres: 0 }) {
  const list = $("deductions-list");
  const row = document.createElement("div");
  row.className = "deduction-row";
  row.innerHTML = `
    <input type="text" class="deduct-label" placeholder="Description" value="${escapeHtml(data.label)}">
    <input type="number" class="deduct-metres" step="0.1" min="0" value="${Number(data.metres||0)}">
    <button type="button" class="btn-remove" title="Remove">×</button>
  `;
  row.querySelector(".btn-remove").addEventListener("click", () => row.remove());
  list.appendChild(row);
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function getDeductionsTotal(){
  const rows = document.querySelectorAll(".deduction-row");
  let total = 0;
  rows.forEach(r => {
    const m = parseFloat(r.querySelector(".deduct-metres").value) || 0;
    total += m;
  });
  return total;
}

// Demo sealant calc using your rules:
// metres = (floor perimeter optional) + bath + (corners * height) - deductions
function calcSealant(){
  const L = parseFloat($("rm-l").value) || 0;
  const W = parseFloat($("rm-w").value) || 0;
  const H = parseFloat($("rm-h").value) || 0;
  const corners = parseInt($("rm-corners").value || "0", 10) || 0;
  const bath = parseFloat($("rm-bath").value) || 0;
  const includeFloor = $("rm-floorperim").checked;
  const coverage = parseFloat($("set-coverage")?.value) || 6;

  const floor = includeFloor ? (2 * (L + W)) : 0;
  const cornerExtra = corners * H;
  const deductions = getDeductionsTotal();

  let metres = floor + bath + cornerExtra - deductions;
  if (metres < 0) metres = 0;

  const tubes = Math.ceil(metres / Math.max(coverage, 0.1));

  $("sealant-m").textContent = fmt(metres, 1);
  $("sealant-tubes").textContent = String(tubes);

  // Summary chips
  $("sum-sealant").textContent = String(tubes);
  return { metres, tubes };
}

// Tab navigation
function setView(view){
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("is-active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("is-active", v.id === `view-${view}`));

  const title = {
    rooms: ["Rooms", "Add room dimensions, sealant rules, and deductions."],
    materials: ["Materials", "Review calculated quantities (rounded correctly)."],
    labour: ["Labour", "Set labour options and extras."],
    quote: ["Quote", "Preview and export the final quote."],
    settings: ["Settings", "Coverage and pricing defaults."]
  }[view] || ["TileIQ", ""];
  $("view-title").textContent = title[0];
  $("view-subtitle").textContent = title[1];
}

function bind(){
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  $("btn-add-deduction").addEventListener("click", () => addDeduction());
  $("btn-calc").addEventListener("click", calcSealant);

  // Recalc on key inputs (nice feel)
  ["rm-l","rm-w","rm-h","rm-corners","rm-bath","rm-floorperim","set-coverage"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", calcSealant);
    el.addEventListener("change", calcSealant);
  });

  // Start with two common deductions examples
  addDeduction({label:"Door gap", metres:0.8});
  addDeduction({label:"No bead behind vanity", metres:0.4});

  // Basic summaries (placeholders until you wire to your real totals)
  $("sum-rooms").textContent = "1";
  $("sum-adh").textContent = "—";
  $("sum-grout").textContent = "—";

  calcSealant();
}

document.addEventListener("DOMContentLoaded", bind);
