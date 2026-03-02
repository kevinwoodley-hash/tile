/* ================================================================
   TileIQ Pro – script.js  (clean rewrite)
   Flow: Dashboard → New Job (customer details) → Job View (rooms)
         → Room Editor (floor / wall / both) → Quote
   ================================================================ */

/* ─── STATE ─────────────────────────────────────────────────── */
let jobs     = JSON.parse(localStorage.getItem("tileiq-jobs"))     || [];
let settings = JSON.parse(localStorage.getItem("tileiq-settings")) || {
    tilePrice:     25.00,
    groutPrice:    4.50,
    adhesivePrice: 22,
    siliconePrice: 6.50,
    markup:        20,
    labourMarkup:  false,
    labourM2:      32,
    labourM2Wall:  35,
    labourM2Floor: 28,
    dayRate:       200,
    applyVat:      true,
    // prep costs £/m²
    cementBoard:   18,
    membrane:       8,
    level2:         5,
    level3:         7,
    level4:         9,
    tanking:        15,
    companyName:   "",
    companyPhone:  "",
    companyEmail:  "",
    terms: "Payment due within 14 days of invoice. All works guaranteed for 12 months against defects in workmanship."
};

let currentJobId    = null;   // id of job currently open
let currentRoomIdx  = null;   // null = new room, number = editing existing
let currentSurfType   = "room";  // "room" | "floor" | "wall"
let currentLabourType = "m2";    // "m2" | "day"

/* ─── HELPERS ────────────────────────────────────────────────── */
function show(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
    window.scrollTo(0, 0);
}

function getJob()  { return jobs.find(j => j.id === currentJobId); }
function saveAll() { localStorage.setItem("tileiq-jobs", JSON.stringify(jobs)); }
function esc(s)    { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function uid()     { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function statusBadge(s) {
    const map = { enquiry:"badge-enquiry", quoted:"badge-quoted", accepted:"badge-accepted", complete:"badge-complete" };
    const labels = { enquiry:"Enquiry", quoted:"Quoted", accepted:"Accepted", complete:"Complete" };
    return `<span class="status-badge ${map[s]||''}">${labels[s]||s}</span>`;
}

/* ─── BOOT ───────────────────────────────────────────────────── */
setTimeout(() => { show("screen-dashboard"); renderDashboard(); updatePrepPriceBadges(); }, 800);

/* Fill in the £/m² cost hints on all prep option labels */
function updatePrepPriceBadges() {
    const S = settings;
    document.querySelectorAll(".pc-cb").forEach(el   => el.textContent = S.cementBoard);
    document.querySelectorAll(".pc-mem").forEach(el  => el.textContent = S.membrane);
    document.querySelectorAll(".pc-tank-r, .pc-tank-w").forEach(el => el.textContent = S.tanking);
    updateLevelBadge("rm-r-leveldepth", ".pc-lev-r");
    updateLevelBadge("rm-f-leveldepth", ".pc-lev-f");
}

function updateLevelBadge(selectId, cls) {
    const el = document.getElementById(selectId);
    const depth = el ? el.value : "2";
    const cost  = depth === "2" ? settings.level2 : depth === "3" ? settings.level3 : settings.level4;
    document.querySelectorAll(cls).forEach(el => el.textContent = cost);
}

function rmToggleLevelR() {
    const checked = document.getElementById("rm-r-levelling").checked;
    document.getElementById("rm-r-level-depth").classList.toggle("hidden", !checked);
    rmCalc();
}
function rmToggleLevelF() {
    const checked = document.getElementById("rm-f-levelling").checked;
    document.getElementById("rm-f-level-depth").classList.toggle("hidden", !checked);
    rmCalc();
}

/* ================================================================
   DASHBOARD
================================================================ */
function goDashboard() { show("screen-dashboard"); renderDashboard(); }

function renderDashboard() {
    const list  = document.getElementById("jobs-list");
    const empty = document.getElementById("jobs-empty");
    document.getElementById("job-count").textContent = jobs.length;

    if (!jobs.length) { list.innerHTML = ""; empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");

    list.innerHTML = jobs.map(j => {
        const total = (j.rooms || []).reduce((a, r) => a + parseFloat(r.total || 0), 0);
        const count = (j.rooms || []).length;
        return `
        <div class="job-card" onclick="goJob('${j.id}')">
            <div class="job-card-header">
                <div>
                    <div class="job-card-name">${esc(j.customerName)}</div>
                    <div class="job-card-sub">${esc(j.description || j.address || "")}</div>
                </div>
                ${statusBadge(j.status)}
            </div>
            <div class="job-card-footer">
                <span>${count} room${count !== 1 ? "s" : ""}</span>
                <span class="job-card-total">£${total.toFixed(2)}</span>
            </div>
        </div>`;
    }).join("");
}

/* ================================================================
   NEW JOB
================================================================ */
function goNewJob() {
    ["nj-name","nj-phone","nj-email","nj-address","nj-city","nj-postcode","nj-desc"]
        .forEach(id => document.getElementById(id).value = "");
    document.getElementById("nj-status").value = "enquiry";
    document.getElementById("nj-supply").value = "contractor";
    show("screen-new-job");
    setTimeout(() => document.getElementById("nj-name").focus(), 100);
}

function createJob() {
    const name = document.getElementById("nj-name").value.trim();
    if (!name) { alert("Please enter the customer name."); return; }

    const job = {
        id:           uid(),
        customerName: name,
        phone:        document.getElementById("nj-phone").value.trim(),
        email:        document.getElementById("nj-email").value.trim(),
        address:      document.getElementById("nj-address").value.trim(),
        city:         document.getElementById("nj-city").value.trim(),
        postcode:     document.getElementById("nj-postcode").value.trim(),
        description:  document.getElementById("nj-desc").value.trim(),
        status:       document.getElementById("nj-status").value,
        tileSupply:   document.getElementById("nj-supply").value,
        rooms:        [],
        createdAt:    new Date().toISOString()
    };

    jobs.push(job);
    saveAll();
    currentJobId = job.id;
    renderJobView();
    show("screen-job");
}

/* ================================================================
   JOB VIEW
================================================================ */
function goJob(id) {
    if (id) currentJobId = id;
    renderJobView();
    show("screen-job");
}

function renderJobView() {
    const job = getJob();
    if (!job) { goDashboard(); return; }

    document.getElementById("job-header-title").textContent = job.customerName;

    // Customer bar
    const parts = [job.address, job.city, job.postcode].filter(Boolean).join(", ");
    document.getElementById("job-customer-bar").innerHTML = `
        <div class="cbar-name">${esc(job.customerName)} ${statusBadge(job.status)}</div>
        ${parts ? `<div class="cbar-address">${esc(parts)}</div>` : ""}
        ${job.phone ? `<span class="cbar-contact">📞 ${esc(job.phone)}</span>` : ""}
        ${job.email ? `<span class="cbar-contact">✉ ${esc(job.email)}</span>` : ""}
        ${job.tileSupply === "customer" ? `<span class="cbar-badge">👤 Customer tiles</span>` : ""}
    `;

    // Rooms
    const roomsEl  = document.getElementById("job-rooms-list");
    const emptyEl  = document.getElementById("job-rooms-empty");
    const totalEl  = document.getElementById("job-running-total");
    const rooms    = job.rooms || [];

    if (!rooms.length) {
        roomsEl.innerHTML = "";
        emptyEl.style.display = "";
        totalEl.classList.add("hidden");
        return;
    }

    emptyEl.style.display = "none";

    roomsEl.innerHTML = rooms.map((r, i) => {
        const surfaces = r.surfaces || [];

        // Recalc so materialSell/labour/prepCost are always fresh
        const rCt = r.tileSupply === "customer";
        const rArea = surfaces.reduce((a, s) => a + (s.area || 0), 0);
        let rLabOpts = null;
        if (r.labourType === "day") rLabOpts = { type:"day", days: r.days||1, dayRate: r.dayRate||settings.dayRate||200, totalArea:rArea };
        surfaces.forEach(s => calcSurface(s, rCt, rLabOpts));

        const wallM2  = surfaces.filter(s => s.type === "wall").reduce((a, s) => a + (s.area || 0), 0);
        const floorM2 = surfaces.filter(s => s.type === "floor").reduce((a, s) => a + (s.area || 0), 0);
        const areaParts = [];
        if (wallM2  > 0) areaParts.push(`🧱 ${wallM2.toFixed(2)} m²`);
        if (floorM2 > 0) areaParts.push(`⬜ ${floorM2.toFixed(2)} m²`);
        const areaStr = areaParts.join(" · ") || `${(r.area||0).toFixed(2)} m²`;

        const surfLines = surfaces.map(s => {
            const icon = s.type === "floor" ? "⬜" : "🧱";
            const dim  = s.type === "floor"
                ? `${s.length}×${s.width}m`
                : `${s.width}×${s.height}m`;
            return `<span class="surf-chip">${icon} ${esc(s.label)} ${dim} · £${s.total}</span>`;
        }).join("");

        const mats       = surfaces.reduce((a, s) => a + (s.materialSell  || 0), 0);
        const lab        = surfaces.reduce((a, s) => a + (s.labour        || 0), 0);
        const prep       = surfaces.reduce((a, s) => a + (s.prepCost      || 0), 0);
        const ufh        = surfaces.reduce((a, s) => a + (s.ufhCost       || 0), 0);
        const adhBags    = surfaces.reduce((a, s) => a + (s.adhBags       || 0), 0);
        const groutBags  = surfaces.reduce((a, s) => a + (s.groutBags     || 0), 0);
        const groutKg    = surfaces.reduce((a, s) => a + (s.groutKg       || 0), 0);
        const cbBoards   = surfaces.reduce((a, s) => a + (s.cementBoards  || 0), 0);
        const levelBags  = surfaces.reduce((a, s) => a + (s.levelBags     || 0), 0);

        const matSchedule = [
            adhBags  > 0 ? `Adhesive: ${adhBags} × 20kg`                                            : "",
            groutBags> 0 ? `Grout: ${groutBags} × 2.5kg (${parseFloat(groutKg.toFixed(1))}kg)`      : "",
            cbBoards > 0 ? `Cement Board: ${cbBoards} board${cbBoards !== 1 ? "s" : ""}`            : "",
            levelBags> 0 ? `Levelling: ${levelBags} × 20kg`                                         : "",
        ].filter(Boolean).join("  ·  ");

        return `
        <div class="room-card">
            <div class="room-card-header">
                <div>
                    <div class="room-card-name">${esc(r.name)}</div>
                    <div class="room-card-meta">${areaStr}</div>
                </div>
                <div class="room-card-total">£${r.total}</div>
            </div>
            <div class="room-cost-breakdown">
                <span class="rcb-item"><span class="rcb-label">Materials</span><span class="rcb-value">£${mats.toFixed(2)}</span></span>
                <span class="rcb-sep">|</span>
                <span class="rcb-item"><span class="rcb-label">Labour</span><span class="rcb-value">£${lab.toFixed(2)}</span></span>
                ${prep > 0 ? `<span class="rcb-sep">|</span><span class="rcb-item"><span class="rcb-label">Prep</span><span class="rcb-value">£${prep.toFixed(2)}</span></span>` : ""}
                ${ufh  > 0 ? `<span class="rcb-sep">|</span><span class="rcb-item"><span class="rcb-label">UFH</span><span class="rcb-value">£${ufh.toFixed(2)}</span></span>` : ""}
            </div>
            ${matSchedule ? `<div class="room-mat-schedule">${matSchedule}</div>` : ""}
            ${surfLines ? `<div class="surf-chips">${surfLines}</div>` : ""}
            <div class="room-card-actions">
                <button onclick="goEditRoom(${i})" class="btn-secondary btn-sm">✏ Edit</button>
                <button onclick="deleteRoom(${i})" class="btn-secondary btn-sm">🗑 Delete</button>
            </div>
        </div>`;
    }).join("");

    const grandTotal = rooms.reduce((a, r) => a + parseFloat(r.total || 0), 0);
    totalEl.classList.remove("hidden");
    totalEl.innerHTML = `<span>Job Total</span><strong>£${grandTotal.toFixed(2)}</strong>`;
}

function deleteRoom(idx) {
    if (!confirm("Delete this room?")) return;
    getJob().rooms.splice(idx, 1);
    saveAll();
    renderJobView();
}

function deleteJob() {
    const job = getJob();
    if (!confirm(`Delete job for ${job.customerName}? This cannot be undone.`)) return;
    jobs = jobs.filter(j => j.id !== currentJobId);
    currentJobId = null;
    saveAll();
    goDashboard();
}

/* ================================================================
   EDIT JOB
================================================================ */
function goEditJob() {
    const j = getJob();
    document.getElementById("ej-name").value    = j.customerName || "";
    document.getElementById("ej-phone").value   = j.phone        || "";
    document.getElementById("ej-email").value   = j.email        || "";
    document.getElementById("ej-address").value = j.address      || "";
    document.getElementById("ej-city").value    = j.city         || "";
    document.getElementById("ej-postcode").value= j.postcode     || "";
    document.getElementById("ej-desc").value    = j.description  || "";
    document.getElementById("ej-status").value  = j.status       || "enquiry";
    document.getElementById("ej-supply").value  = j.tileSupply   || "contractor";
    show("screen-edit-job");
}

function saveEditJob() {
    const name = document.getElementById("ej-name").value.trim();
    if (!name) { alert("Customer name is required."); return; }
    const j = getJob();
    j.customerName = name;
    j.phone        = document.getElementById("ej-phone").value.trim();
    j.email        = document.getElementById("ej-email").value.trim();
    j.address      = document.getElementById("ej-address").value.trim();
    j.city         = document.getElementById("ej-city").value.trim();
    j.postcode     = document.getElementById("ej-postcode").value.trim();
    j.description  = document.getElementById("ej-desc").value.trim();
    j.status       = document.getElementById("ej-status").value;
    j.tileSupply   = document.getElementById("ej-supply").value;
    saveAll();
    goJob();
}

/* ================================================================
   ROOM EDITOR
================================================================ */
function setLabourType(type) {
    currentLabourType = type;
    document.getElementById("ltbtn-m2").classList.toggle("ltbtn-active",  type === "m2");
    document.getElementById("ltbtn-day").classList.toggle("ltbtn-active", type === "day");
    document.getElementById("labour-day-opts").classList.toggle("hidden", type !== "day");
    rmCalc();
}

function goAddRoom() {
    currentRoomIdx    = null;
    currentSurfType   = "room";
    currentLabourType = "m2";
    document.getElementById("room-screen-title").textContent = "Add Room";
    document.getElementById("rm-name").value = "";
    document.getElementById("rm-customer-tiles").checked = false;
    document.getElementById("rm-dayrate").value = settings.dayRate || 200;
    document.getElementById("rm-days").value = "";
    clearRoomInputs();
    setLabourType("m2");
    rmSelectType("room");
    show("screen-room");
    setTimeout(() => document.getElementById("rm-name").focus(), 100);
}

function goEditRoom(idx) {
    const room = getJob().rooms[idx];
    currentRoomIdx    = idx;
    currentSurfType   = room.savedType || "room";
    currentLabourType = room.labourType || "m2";

    document.getElementById("room-screen-title").textContent = "Edit Room";
    document.getElementById("rm-name").value = room.name;
    document.getElementById("rm-customer-tiles").checked = room.tileSupply === "customer";
    document.getElementById("rm-dayrate").value = room.dayRate || settings.dayRate || 200;
    document.getElementById("rm-days").value    = room.days || "";

    clearRoomInputs();
    setLabourType(currentLabourType);
    rmSelectType(currentSurfType);
    restoreRoomInputs(room);
    // Restore saved deductions
    wallDeducts  = (room.wallDeducts  || []).slice();
    floorDeducts = (room.floorDeducts || []).slice();
    renderDeducts();
    rmCalc();
    show("screen-room");
}

/* Show the right measurement form, highlight the right button */
function rmSelectType(type) {
    currentSurfType = type;
    ["room","floor","wall"].forEach(t => {
        document.getElementById("rm-form-" + t).classList.toggle("hidden", t !== type);
        document.getElementById("stype-btn-" + t).classList.toggle("stype-active", t === type);
    });
    rmCalc();
}

function rmToggleFloor() {
    const show = document.getElementById("rm-r-inclfloor").checked;
    document.getElementById("rm-r-floor-opts").style.display = show ? "" : "none";
    rmCalc();
}

/* Wipe all measurement fields */
function clearRoomInputs() {
    clearDeducts();
    const ids = [
        "rm-r-length","rm-r-width","rm-r-height","rm-r-deduct",
        "rm-f-length","rm-f-width",
        "rm-w-width","rm-w-height"
    ];
    ids.forEach(id => document.getElementById(id).value = "");
    document.getElementById("rm-r-inclfloor").checked = true;
    document.getElementById("rm-r-ufh").checked       = false;
    document.getElementById("rm-f-ufh").checked       = false;
    document.getElementById("rm-r-floor-opts").style.display = "";
    // reset prep checkboxes
    ["rm-r-cementboard","rm-r-membrane","rm-r-levelling","rm-r-tanking",
     "rm-f-cementboard","rm-f-membrane","rm-f-levelling",
     "rm-w-tanking"].forEach(id => {
        const el = document.getElementById(id); if (el) el.checked = false;
    });
    document.getElementById("rm-r-level-depth").classList.add("hidden");
    document.getElementById("rm-f-level-depth").classList.add("hidden");
    // reset tile defaults
    document.getElementById("rm-r-wtilew").value = 300;
    document.getElementById("rm-r-wtileh").value = 600;
    document.getElementById("rm-r-wtilethick").value = 8;
    document.getElementById("rm-r-wgrout").value = 2;
    document.getElementById("rm-r-ftilew").value = 600;
    document.getElementById("rm-r-ftileh").value = 600;
    document.getElementById("rm-r-fgrout").value = 2;
    document.getElementById("rm-r-deduct").value = 0;
    document.getElementById("rm-f-tilew").value  = 600;
    document.getElementById("rm-f-tileh").value  = 600;
    document.getElementById("rm-f-tilethick").value = 10;
    document.getElementById("rm-f-grout").value  = 2;
    document.getElementById("rm-w-tilew").value  = 300;
    document.getElementById("rm-w-tilethick").value = 8;
    document.getElementById("rm-w-tileh").value  = 600;
    document.getElementById("rm-w-grout").value  = 2;
}

/* Restore fields when editing an existing room */
function restoreRoomInputs(room) {
    const surfaces = room.surfaces || [];
    const walls    = surfaces.filter(s => s.type === "wall");
    const floors   = surfaces.filter(s => s.type === "floor");
    const set   = (id, v) => { if (v !== undefined && v !== null) document.getElementById(id).value = v; };
    const setCb = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

    if (currentSurfType === "room") {
        if (walls.length >= 4) {
            set("rm-r-length", walls[0].width);
            set("rm-r-width",  walls[2].width);
            set("rm-r-height", walls[0].height);
            set("rm-r-wtilew", walls[0].tileW);
            set("rm-r-wtileh", walls[0].tileH);
            set("rm-r-wtilethick", walls[0].tileThick || 8);
            set("rm-r-wgrout", walls[0].grout);
            setCb("rm-r-tanking", walls[0].tanking);
        }
        if (floors.length) {
            setCb("rm-r-inclfloor", true);
            set("rm-r-ftilew", floors[0].tileW);
            set("rm-r-ftileh", floors[0].tileH);
            set("rm-r-ftilethick", floors[0].tileThick || 10);
            set("rm-r-fgrout", floors[0].grout);
            setCb("rm-r-ufh", floors[0].ufh);
            setCb("rm-r-cementboard", floors[0].cementBoard);
            setCb("rm-r-membrane",    floors[0].membrane);
            setCb("rm-r-levelling",   floors[0].levelling);
            if (floors[0].levelling) {
                set("rm-r-leveldepth", floors[0].levelDepth || 2);
                document.getElementById("rm-r-level-depth").classList.remove("hidden");
            }
            document.getElementById("rm-r-floor-opts").style.display = "";
        } else {
            setCb("rm-r-inclfloor", false);
            document.getElementById("rm-r-floor-opts").style.display = "none";
        }
    } else if (currentSurfType === "floor" && floors.length) {
        set("rm-f-length", floors[0].length);
        set("rm-f-width",  floors[0].width);
        set("rm-f-tilew",  floors[0].tileW);
        set("rm-f-tileh",  floors[0].tileH);
        set("rm-f-tilethick", floors[0].tileThick || 10);
        set("rm-f-grout",  floors[0].grout);
        setCb("rm-f-ufh",         floors[0].ufh);
        setCb("rm-f-cementboard", floors[0].cementBoard);
        setCb("rm-f-membrane",    floors[0].membrane);
        setCb("rm-f-levelling",   floors[0].levelling);
        if (floors[0].levelling) {
            set("rm-f-leveldepth", floors[0].levelDepth || 2);
            document.getElementById("rm-f-level-depth").classList.remove("hidden");
        }
    } else if (currentSurfType === "wall" && walls.length) {
        set("rm-w-width",  walls[0].width);
        set("rm-w-height", walls[0].height);
        set("rm-w-tilew",  walls[0].tileW);
        set("rm-w-tileh",  walls[0].tileH);
        set("rm-w-tilethick", walls[0].tileThick || 8);
        set("rm-w-grout",  walls[0].grout);
        setCb("rm-w-tanking", walls[0].tanking);
    }
}

/* ─── BUILD SURFACES from current form fields ─── */
function buildSurfaces() {
    const g  = id => { const el = document.getElementById(id); return el ? parseFloat(el.value) : NaN; };
    const cb = id => document.getElementById(id)?.checked || false;
    const sv = id => document.getElementById(id)?.value   || "2";

    if (currentSurfType === "room") {
        const L = g("rm-r-length"), W = g("rm-r-width"), H = g("rm-r-height");
        if (!L || !W || !H || L <= 0 || W <= 0 || H <= 0) return null;

        const deduct      = parseFloat(document.getElementById("rm-r-deduct")?.value) || 0;
        const floorDeduct = parseFloat(document.getElementById("rm-r-fdeduct")?.value) || 0;
        const wallTileW     = g("rm-r-wtilew")     || 300;
        const wallTileH     = g("rm-r-wtileh")     || 600;
        const wallTileThick = g("rm-r-wtilethick") || 8;
        const wallGrout     = g("rm-r-wgrout")     || 2;
        const totalWallArea = 2 * (L + W) * H;
        const tanking = cb("rm-r-tanking");

        const surfaces = [
            { label:"Wall A (front)", width:L, height:H },
            { label:"Wall B (back)",  width:L, height:H },
            { label:"Wall C (left)",  width:W, height:H },
            { label:"Wall D (right)", width:W, height:H },
        ].map(w => ({
            type:"wall", label:w.label, width:w.width, height:w.height,
            tileW:wallTileW, tileH:wallTileH, tileThick:wallTileThick, grout:wallGrout,
            tanking,
            area: Math.max(0, w.width * w.height - deduct * (w.width * w.height / totalWallArea))
        }));

        if (cb("rm-r-inclfloor")) {
            surfaces.push({
                type:"floor", label:"Floor", length:L, width:W,
                tileW:   g("rm-r-ftilew") || 600,
                tileH:   g("rm-r-ftileh") || 600,
                tileThick: g("rm-r-ftilethick") || 10,
                grout:   g("rm-r-fgrout") || 2,
                ufh:     cb("rm-r-ufh"),
                cementBoard: cb("rm-r-cementboard"),
                membrane:    cb("rm-r-membrane"),
                levelling:   cb("rm-r-levelling"),
                levelDepth:  parseInt(sv("rm-r-leveldepth")) || 2,
                area: Math.max(0, L * W - floorDeduct)
            });
        }
        return surfaces;
    }

    if (currentSurfType === "floor") {
        const L = g("rm-f-length"), W = g("rm-f-width");
        if (!L || !W || L <= 0 || W <= 0) return null;
        const fDed = parseFloat(document.getElementById("rm-f-deduct")?.value) || 0;
        return [{ type:"floor", label:"Floor", length:L, width:W,
            tileW:   g("rm-f-tilew") || 600,
            tileH:   g("rm-f-tileh") || 600,
            tileThick: g("rm-f-tilethick") || 10,
            grout:   g("rm-f-grout") || 2,
            ufh:     cb("rm-f-ufh"),
            cementBoard: cb("rm-f-cementboard"),
            membrane:    cb("rm-f-membrane"),
            levelling:   cb("rm-f-levelling"),
            levelDepth:  parseInt(sv("rm-f-leveldepth")) || 2,
            area: Math.max(0, L * W - fDed)
        }];
    }

    if (currentSurfType === "wall") {
        const W = g("rm-w-width"), H = g("rm-w-height");
        if (!W || !H || W <= 0 || H <= 0) return null;
        const wDed = parseFloat(document.getElementById("rm-w-deduct")?.value) || 0;
        return [{ type:"wall", label:"Wall",
            width:W, height:H,
            tileW:   g("rm-w-tilew") || 300,
            tileH:   g("rm-w-tileh") || 600,
            tileThick: g("rm-w-tilethick") || 8,
            grout:   g("rm-w-grout") || 2,
            tanking: cb("rm-w-tanking"),
            area:    Math.max(0, W * H - wDed)
        }];
    }

    return null;
}

/* ─── COST CALCULATION for a single surface ─── */
function calcSurface(s, customerTiles, labourOpts) {
    const S = settings;

    // Ensure area is always a number (guards against string values from localStorage)
    s.area = parseFloat(s.area) || 0;

    const tileArea = (s.tileW / 1000) * (s.tileH / 1000);

    // Waste factor: walls 12%, floors 10%
    const wasteFactor = s.type === "wall" ? 1.12 : 1.10;
    s.tiles = Math.ceil((s.area / tileArea) * wasteFactor);

    // Adhesive: based on tile size category (from BAL/Weber data sheets)
    const maxDim = Math.max(s.tileW, s.tileH);
    let adhKgM2;
    // Midpoint of published usage ranges (Topps Tiles / BAL)
    // Large format gets +17.5% for mandatory back buttering
    if      (maxDim < 100)  { adhKgM2 = 3.0; s.adhNotch = "4mm";    s.adhCat = "Mosaic / Small (<100mm)";        s.backButter = false; }
    else if (maxDim <= 300) { adhKgM2 = 4.0; s.adhNotch = "6mm";    s.adhCat = "Standard Wall (up to 300mm)";    s.backButter = false; }
    else if (maxDim <= 600) { adhKgM2 = 5.75; s.adhNotch = "10mm";  s.adhCat = "Standard Floor (300–600mm)";     s.backButter = false; }
    else                    { adhKgM2 = 7.0 * 1.175; s.adhNotch = "12mm+"; s.adhCat = "Large Format (>600mm) inc. back-butter"; s.backButter = true; }
    s.adhKgM2 = adhKgM2;
    s.adhBags = Math.ceil((s.area * adhKgM2) / 20);

    // Grout formula:
    // A = tileW + tileH
    // B = jointWidth × tileThickness
    // C = A × B × 1.2
    // D = tileW × tileH
    // Rate (kg/m²) = C / D
    // Total = Rate × area
    const groutMm   = s.grout     || 2;
    const tileThick = s.tileThick || (s.type === "floor" ? 10 : 8);
    const A         = s.tileW + s.tileH;
    const B         = groutMm * tileThick;
    const C         = A * B * 1.2;
    const D         = s.tileW * s.tileH;
    const groutKgM2 = C / D;
    s.groutKg   = Math.ceil(groutKgM2 * s.area * 10) / 10;
    // Grout sold in 2.5kg bags
    s.groutBags = Math.ceil(s.groutKg / 2.5);

    const tileCost = customerTiles ? 0 : s.area * S.tilePrice;
    // Price grout by bag quantity
    const groutCost = s.groutBags * 2.5 * S.groutPrice;
    const matRaw   = tileCost + groutCost + s.adhBags * S.adhesivePrice;
    const mult     = 1 + S.markup / 100;
    s.materialSell = matRaw * mult;

    // Labour: separate wall/floor rates
    const labourRate = s.type === "wall"
        ? (S.labourM2Wall || S.labourM2 || 35)
        : (S.labourM2Floor || S.labourM2 || 28);

    if (labourOpts && labourOpts.type === "day") {
        const totalArea  = labourOpts.totalArea || 1;
        const proportion = totalArea > 0 ? s.area / totalArea : 0;
        const labRaw     = labourOpts.days * labourOpts.dayRate * proportion;
        s.labour = S.labourMarkup ? labRaw * mult : labRaw;
    } else {
        const labRaw = s.area * labourRate;
        s.labour = S.labourMarkup ? labRaw * mult : labRaw;
    }

    s.ufhCost = (s.ufh && s.type === "floor") ? s.area * 52 + 180 : 0;

    // Prep costs — all rates are £/m², multiplied by surface area
    s.prepCost = 0;
    s.prepLines = [];
    if (s.type === "floor") {
        if (s.cementBoard) {
            const rate   = parseFloat(S.cementBoard) || 18;
            const boards = Math.ceil(s.area / 0.96);  // 0.96m² per board
            const c      = s.area * rate;
            s.cementBoards = boards;
            s.prepCost += c; s.prepLines.push(`Cement Board: ${boards} board${boards !== 1 ? "s" : ""} (${s.area.toFixed(2)}m² ÷ 0.96m²/board) = £${c.toFixed(2)}`);
        }
        if (s.membrane) {
            const rate = parseFloat(S.membrane) || 8;
            const c    = s.area * rate;
            s.prepCost += c; s.prepLines.push(`Anti-Crack Membrane: ${s.area.toFixed(2)}m² × £${rate}/m² = £${c.toFixed(2)}`);
        }
        if (s.levelling) {
            const depth  = s.levelDepth || 2;
            const rate   = depth === 3 ? (parseFloat(S.level3) || 7)
                         : depth === 4 ? (parseFloat(S.level4) || 9)
                         :               (parseFloat(S.level2) || 5);
            const bags   = Math.ceil(s.area / (20 / (depth * 1.5)));  // ~1.5kg covers 1m² at 1mm depth
            const c      = s.area * rate;
            s.levelBags  = bags;
            s.prepCost += c; s.prepLines.push(`Levelling Compound ${depth}mm: ${bags} bag${bags !== 1 ? "s" : ""} × 20kg = £${c.toFixed(2)}`);
        }
    }
    if (s.type === "wall" && s.tanking) {
        const rate = parseFloat(S.tanking) || 15;
        const c    = s.area * rate;
        s.prepCost += c; s.prepLines.push(`Tanking: ${s.area.toFixed(2)}m² × £${rate}/m² = £${c.toFixed(2)}`);
    }

    s.total = (s.materialSell + s.labour + s.ufhCost + s.prepCost).toFixed(2);
}

/* ─── DEDUCTION PRESETS ─── */
// Each deduction: { label, w, h, m2 }
let wallDeducts  = [];
let floorDeducts = [];

function addDeduct(w, h, label, mode) {
    if (mode === "manual" || mode === "floor-manual") {
        const wStr = prompt("Width (m):", "");
        const hStr = prompt("Height (m):", "");
        if (!wStr || !hStr) return;
        w = parseFloat(wStr) || 0;
        h = parseFloat(hStr) || 0;
        const custom = prompt("Label:", label.replace("-manual","") || "Opening");
        label = custom || label;
    }
    const m2 = parseFloat((w * h).toFixed(3));
    if (m2 <= 0) return;

    const isFloor = mode === "floor" || mode === "floor-manual";
    if (isFloor) {
        floorDeducts.push({ label, w, h, m2 });
    } else {
        wallDeducts.push({ label, w, h, m2 });
    }
    renderDeducts();
    rmCalc();
}

function removeDeduct(idx, isFloor) {
    if (isFloor) floorDeducts.splice(idx, 1);
    else         wallDeducts.splice(idx, 1);
    renderDeducts();
    rmCalc();
}

function renderDeducts() {
    const wallTag = (d, i) => `
        <div class="deduct-tag">
            <span>${d.label} (${d.w}×${d.h}m = ${d.m2}m²)</span>
            <button onclick="removeDeduct(${i}, false)" class="deduct-remove">×</button>
        </div>`;
    const floorTag = (d, i) => `
        <div class="deduct-tag">
            <span>${d.label} (${d.w}×${d.h}m = ${d.m2}m²)</span>
            <button onclick="removeDeduct(${i}, true)" class="deduct-remove">×</button>
        </div>`;

    const wallHtml  = wallDeducts.map(wallTag).join("");
    const floorHtml = floorDeducts.map(floorTag).join("");

    // Update all containers that show wall deductions
    ["deduct-items", "deduct-wall-items-w"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = wallHtml;
    });
    // Update all containers that show floor deductions
    ["deduct-floor-items", "deduct-floor-items-f"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = floorHtml;
    });

    // Sync hidden inputs for all modes
    const wallTotal  = wallDeducts.reduce((a, d) => a + d.m2, 0);
    const floorTotal = floorDeducts.reduce((a, d) => a + d.m2, 0);
    ["rm-r-deduct", "rm-w-deduct"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = wallTotal;
    });
    ["rm-r-fdeduct", "rm-f-deduct"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = floorTotal;
    });
}

function clearDeducts() {
    wallDeducts  = [];
    floorDeducts = [];
    renderDeducts();
}

/* ─── LIVE CALCULATION ─── */
function rmCalc() {
    updatePrepPriceBadges();
    const surfaces = buildSurfaces();
    const ct = document.getElementById("rm-customer-tiles")?.checked || false;

    if (!surfaces) {
        document.getElementById("rm-total").textContent = "0.00";
        document.getElementById("rm-breakdown").innerHTML = "";
        return;
    }

    const totalArea = surfaces.reduce((a, s) => a + s.area, 0);
    let labourOpts = null;
    if (currentLabourType === "day") {
        const days    = parseFloat(document.getElementById("rm-days").value) || 0;
        const dayRate = parseFloat(document.getElementById("rm-dayrate").value) || settings.dayRate || 200;
        labourOpts = { type:"day", days, dayRate, totalArea };
    }

    surfaces.forEach(s => calcSurface(s, ct, labourOpts));

    const total = surfaces.reduce((a, s) => a + parseFloat(s.total), 0);
    const mats  = surfaces.reduce((a, s) => a + (s.materialSell || 0), 0);
    const lab   = surfaces.reduce((a, s) => a + (s.labour || 0), 0);
    const ufh   = surfaces.reduce((a, s) => a + (s.ufhCost || 0), 0);
    const prep  = surfaces.reduce((a, s) => a + (s.prepCost || 0), 0);

    document.getElementById("rm-total").textContent = total.toFixed(2);

    const wallM2  = surfaces.filter(s => s.type === "wall").reduce((a, s) => a + (s.area || 0), 0);
    const floorM2 = surfaces.filter(s => s.type === "floor").reduce((a, s) => a + (s.area || 0), 0);
    const areaParts = [];
    if (wallM2  > 0) areaParts.push(`🧱 ${wallM2.toFixed(2)} m²`);
    if (floorM2 > 0) areaParts.push(`⬜ ${floorM2.toFixed(2)} m²`);
    const areaEl = document.getElementById("rm-area");
    if (areaEl) areaEl.textContent = areaParts.join("  ");
    // Aggregate bag/board quantities across all surfaces
    const totalAdhBags    = surfaces.reduce((a, s) => a + (s.adhBags     || 0), 0);
    const totalGroutBags  = surfaces.reduce((a, s) => a + (s.groutBags   || 0), 0);
    const totalGroutKg    = surfaces.reduce((a, s) => a + (s.groutKg     || 0), 0);
    const totalCBBoards   = surfaces.reduce((a, s) => a + (s.cementBoards|| 0), 0);
    const totalLevelBags  = surfaces.reduce((a, s) => a + (s.levelBags   || 0), 0);

    const parts = [];
    if (mats > 0) parts.push(`Materials £${mats.toFixed(2)}`);
    if (lab  > 0) {
        const labLabel = currentLabourType === "day"
            ? `Labour £${lab.toFixed(2)} (${document.getElementById("rm-days").value||0} days)`
            : `Labour £${lab.toFixed(2)}`;
        parts.push(labLabel);
    }
    if (ufh  > 0) parts.push(`UFH £${ufh.toFixed(2)}`);
    if (totalAdhBags   > 0) parts.push(`Adhesive: ${totalAdhBags} × 20kg bag${totalAdhBags !== 1 ? "s" : ""}`);
    if (totalGroutBags > 0) parts.push(`Grout: ${totalGroutBags} × 2.5kg bag${totalGroutBags !== 1 ? "s" : ""} (${totalGroutKg}kg)`);
    if (totalCBBoards  > 0) parts.push(`Cement Board: ${totalCBBoards} board${totalCBBoards !== 1 ? "s" : ""}`);
    if (totalLevelBags > 0) parts.push(`Levelling: ${totalLevelBags} × 20kg bag${totalLevelBags !== 1 ? "s" : ""}`);
    if (prep > 0 && totalCBBoards === 0 && totalLevelBags === 0) parts.push(`Prep £${prep.toFixed(2)}`);
    document.getElementById("rm-breakdown").innerHTML =
        parts.map(p => `<span class="breakdown-item">${p}</span>`).join(" · ");
}

/* ─── SAVE ROOM ─── */
function saveRoom() {
    const name = document.getElementById("rm-name").value.trim();
    if (!name) { alert("Please enter a room name."); return; }

    const surfaces = buildSurfaces();
    if (!surfaces) { alert("Please fill in the measurements."); return; }

    const ct       = document.getElementById("rm-customer-tiles").checked;
    const totalArea = surfaces.reduce((a, s) => a + s.area, 0);

    let labourOpts = null;
    let days = 0, dayRate = settings.dayRate || 200;
    if (currentLabourType === "day") {
        days    = parseFloat(document.getElementById("rm-days").value) || 0;
        dayRate = parseFloat(document.getElementById("rm-dayrate").value) || settings.dayRate || 200;
        labourOpts = { type:"day", days, dayRate, totalArea };
    }

    surfaces.forEach(s => calcSurface(s, ct, labourOpts));

    const area       = parseFloat(totalArea.toFixed(2));
    const total      = surfaces.reduce((a, s) => a + parseFloat(s.total), 0);
    const floorCount = surfaces.filter(s => s.type === "floor").length;
    const wallCount  = surfaces.filter(s => s.type === "wall").length;
    const type = floorCount && wallCount ? "floor + walls" : wallCount ? "wall" : "floor";

    const room = {
        name,
        wallDeducts: wallDeducts.slice(),
        floorDeducts: floorDeducts.slice(),
        savedType:   currentSurfType,
        labourType:  currentLabourType,
        days:        currentLabourType === "day" ? days : undefined,
        dayRate:     currentLabourType === "day" ? dayRate : undefined,
        type,
        tileSupply:  ct ? "customer" : "contractor",
        surfaces,
        area,
        total:       total.toFixed(2),
        ufh:         surfaces.some(s => s.ufh),
        tiles:       surfaces.reduce((a, s) => a + (s.tiles || 0), 0),
        adhBags:     surfaces.reduce((a, s) => a + (s.adhBags || 0), 0),
        groutKg:     parseFloat(surfaces.reduce((a, s) => a + (s.groutKg || 0), 0).toFixed(1))
    };

    const j = getJob();
    if (currentRoomIdx === null) { j.rooms.push(room); }
    else                         { j.rooms[currentRoomIdx] = room; }

    saveAll();
    renderJobView();
    goJob();
}

/* ================================================================
   SETTINGS
================================================================ */
function goSettings() {
    const s = settings;
    document.getElementById("set-tile-price").value     = s.tilePrice;
    document.getElementById("set-grout-price").value    = s.groutPrice;
    document.getElementById("set-adhesive-price").value = s.adhesivePrice;
    document.getElementById("set-silicone-price").value = s.siliconePrice || 6.50;
    document.getElementById("set-markup").value         = s.markup;
    document.getElementById("set-labour-markup").value  = s.labourMarkup ? "true" : "false";
    document.getElementById("set-labour-m2").value      = s.labourM2;
    document.getElementById("set-day-rate").value       = s.dayRate;
    document.getElementById("set-cementboard").value    = s.cementBoard  || 18;
    document.getElementById("set-membrane").value       = s.membrane     || 8;
    document.getElementById("set-level2").value         = s.level2       || 5;
    document.getElementById("set-level3").value         = s.level3       || 7;
    document.getElementById("set-level4").value         = s.level4       || 9;
    document.getElementById("set-tanking").value        = s.tanking      || 15;
    document.getElementById("set-vat").value            = s.applyVat !== false ? "true" : "false";
    document.getElementById("set-company-name").value   = s.companyName  || "";
    document.getElementById("set-company-phone").value  = s.companyPhone || "";
    document.getElementById("set-company-email").value  = s.companyEmail || "";
    document.getElementById("set-terms").value          = s.terms || "";
    show("screen-settings");
}

function saveSettings() {
    settings = {
        tilePrice:     parseFloat(document.getElementById("set-tile-price").value)     || 25.00,
        groutPrice:    parseFloat(document.getElementById("set-grout-price").value)    || 4.50,
        adhesivePrice: parseFloat(document.getElementById("set-adhesive-price").value) || 22,
        siliconePrice: parseFloat(document.getElementById("set-silicone-price").value) || 6.50,
        markup:        parseFloat(document.getElementById("set-markup").value)         || 20,
        labourMarkup:  document.getElementById("set-labour-markup").value === "true",
        labourM2:      parseFloat(document.getElementById("set-labour-m2").value)      || 32,
        dayRate:       parseFloat(document.getElementById("set-day-rate").value)       || 200,
        cementBoard:   parseFloat(document.getElementById("set-cementboard").value)    || 18,
        membrane:      parseFloat(document.getElementById("set-membrane").value)       || 8,
        level2:        parseFloat(document.getElementById("set-level2").value)         || 5,
        level3:        parseFloat(document.getElementById("set-level3").value)         || 7,
        level4:        parseFloat(document.getElementById("set-level4").value)         || 9,
        tanking:       parseFloat(document.getElementById("set-tanking").value)        || 15,
        applyVat:      document.getElementById("set-vat").value === "true",
        companyName:   document.getElementById("set-company-name").value.trim(),
        companyPhone:  document.getElementById("set-company-phone").value.trim(),
        companyEmail:  document.getElementById("set-company-email").value.trim(),
        terms:         document.getElementById("set-terms").value.trim()
    };
    localStorage.setItem("tileiq-settings", JSON.stringify(settings));
    goDashboard();
}

/* ================================================================
   QUOTE PREVIEW
================================================================ */
function goQuote() {
    const j = getJob();
    if (!j.rooms || !j.rooms.length) {
        alert("Add at least one room before generating a quote.");
        return;
    }
    document.getElementById("q-vat").value    = settings.applyVat !== false ? "true" : "false";
    document.getElementById("q-expiry").value = 30;
    document.getElementById("ai-box").innerHTML = "";
    renderQuote();
    show("screen-quote");
}

/* ─── MATERIALS BREAKDOWN ─── */
function goMaterials() {
    renderMaterials();
    show("screen-materials");
}

function renderMaterials() {
    const j = getJob();
    const rooms = j.rooms || [];
    if (!rooms.length) {
        document.getElementById("materials-output").innerHTML = '<p style="color:#888;text-align:center;padding:24px;">No rooms added yet.</p>';
        return;
    }

    // Recalculate all surfaces fresh
    let grandTiles = 0, grandAdhBags = 0, grandAdhKg = 0;
    let grandGroutBags = 0, grandGroutKg = 0;
    let grandCBBoards = 0, grandLevelBags = 0;
    let hasUFH = false;

    const roomBlocks = rooms.map(room => {
        const surfaces = room.surfaces || [];
        if (!surfaces.length) return "";

        const ct        = room.tileSupply === "customer";
        const totalArea = surfaces.reduce((a, s) => a + (s.area || 0), 0);
        let labourOpts  = null;
        if (room.labourType === "day") {
            labourOpts = { type:"day", days: room.days||1, dayRate: room.dayRate||settings.dayRate||200, totalArea };
        }
        surfaces.forEach(s => calcSurface(s, ct, labourOpts));

        const wallM2  = surfaces.filter(s => s.type==="wall").reduce((a,s)=>a+(s.area||0),0);
        const floorM2 = surfaces.filter(s => s.type==="floor").reduce((a,s)=>a+(s.area||0),0);

        const rows = surfaces.map(s => {
            const icon      = s.type === "floor" ? "⬜" : "🧱";
            const tileDesc  = `${s.tileW}×${s.tileH}mm`;
            const adhKg     = (s.adhBags * 20).toFixed(0);
            grandTiles     += s.tiles     || 0;
            grandAdhBags   += s.adhBags   || 0;
            grandAdhKg     += s.adhBags * 20;
            grandGroutBags += s.groutBags || 0;
            grandGroutKg   += s.groutKg   || 0;
            if (s.cementBoards) grandCBBoards  += s.cementBoards;
            if (s.levelBags)    grandLevelBags += s.levelBags;
            if (s.ufh)          hasUFH = true;

            const prepItems = [];
            if (s.cementBoards) prepItems.push(`${s.cementBoards} cement board${s.cementBoards!==1?"s":""}`);
            if (s.levelBags)    prepItems.push(`${s.levelBags} × 20kg levelling bag${s.levelBags!==1?"s":""}`);
            if (s.tanking)      prepItems.push("tanking applied");

            return `
            <tr class="mat-surf-row">
                <td>${icon} ${esc(s.label)}</td>
                <td style="text-align:right">${s.area.toFixed(2)} m²</td>
                <td style="text-align:right">${s.tiles}<br><span class="mat-sub">${tileDesc}</span></td>
                <td style="text-align:right">${s.adhBags} bag${s.adhBags!==1?"s":""}<br><span class="mat-sub">${adhKg}kg · ${s.adhCat.split(" ")[0]+' '+s.adhCat.split(" ")[1]||""}</span></td>
                <td style="text-align:right">${s.groutBags} bag${s.groutBags!==1?"s":""}<br><span class="mat-sub">${s.groutKg}kg total</span></td>
                ${prepItems.length ? `<td style="text-align:right;font-size:11px;color:#666;">${prepItems.join("<br>")}</td>` : "<td></td>"}
            </tr>`;
        }).join("");

        const areaSummary = [
            wallM2  > 0 ? `🧱 ${wallM2.toFixed(2)} m²` : "",
            floorM2 > 0 ? `⬜ ${floorM2.toFixed(2)} m²` : "",
        ].filter(Boolean).join("  ·  ");

        return `
        <div class="mat-room-block">
            <div class="mat-room-title">${esc(room.name)} <span class="mat-room-area">${areaSummary}</span></div>
            <table class="mat-table">
                <thead>
                    <tr>
                        <th>Surface</th>
                        <th style="text-align:right">Area</th>
                        <th style="text-align:right">Tiles</th>
                        <th style="text-align:right">Adhesive<br><span style="font-weight:400;font-size:10px">20kg bags</span></th>
                        <th style="text-align:right">Grout<br><span style="font-weight:400;font-size:10px">2.5kg bags</span></th>
                        <th style="text-align:right">Prep</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }).join("");

    // Grand totals
    const totalsHtml = `
    <div class="mat-totals-card">
        <div class="mat-totals-title">Job Totals</div>
        <div class="mat-totals-grid">
            <div class="mat-total-item"><span class="mat-total-label">Tiles</span><span class="mat-total-value">${grandTiles}</span></div>
            <div class="mat-total-item"><span class="mat-total-label">Adhesive</span><span class="mat-total-value">${grandAdhBags} × 20kg<br><span style="font-size:11px;font-weight:400;">${grandAdhKg.toFixed(0)}kg total</span></span></div>
            <div class="mat-total-item"><span class="mat-total-label">Grout</span><span class="mat-total-value">${grandGroutBags} × 2.5kg<br><span style="font-size:11px;font-weight:400;">${parseFloat(grandGroutKg.toFixed(1))}kg total</span></span></div>
            ${grandCBBoards  > 0 ? `<div class="mat-total-item"><span class="mat-total-label">Cement Board</span><span class="mat-total-value">${grandCBBoards} board${grandCBBoards!==1?"s":""}</span></div>` : ""}
            ${grandLevelBags > 0 ? `<div class="mat-total-item"><span class="mat-total-label">Levelling</span><span class="mat-total-value">${grandLevelBags} × 20kg bag${grandLevelBags!==1?"s":""}</span></div>` : ""}
        </div>
    </div>`;

    document.getElementById("materials-output").innerHTML = totalsHtml + roomBlocks;
}

function renderQuote() {
    const j      = getJob();
    const applyVat = document.getElementById("q-vat").value === "true";
    const expDays  = parseInt(document.getElementById("q-expiry").value) || 30;
    const today    = new Date();
    const expiry   = new Date(today); expiry.setDate(expiry.getDate() + expDays);
    const fmt      = d => d.toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });

    const co    = settings.companyName  || "Your Tiling Company";
    const phone = settings.companyPhone || "";
    const email = settings.companyEmail || "";
    const quoteRef = "Q" + Date.now().toString().slice(-6);

    const addr = [j.address, j.city, j.postcode].filter(Boolean).join(", ");

    let totalMats = 0, totalLabour = 0, totalPrep = 0;
    let totalAdhBags = 0, totalGroutBags = 0, totalGroutKg = 0, totalCBBoards = 0, totalLevelBags = 0;

    (j.rooms || []).forEach(room => {
        const surfaces = room.surfaces || [];
        if (!surfaces.length) return;
        const ct       = room.tileSupply === "customer";
        const totalArea = surfaces.reduce((a, s) => a + (s.area || 0), 0);
        let labourOpts = null;
        if (room.labourType === "day") {
            labourOpts = { type:"day", days: room.days || 1, dayRate: room.dayRate || settings.dayRate || 200, totalArea };
        }
        surfaces.forEach(s => calcSurface(s, ct, labourOpts));
        totalMats      += surfaces.reduce((a, s) => a + (s.materialSell  || 0), 0);
        totalLabour    += surfaces.reduce((a, s) => a + (s.labour || 0) + (s.ufhCost || 0), 0);
        totalPrep      += surfaces.reduce((a, s) => a + (s.prepCost      || 0), 0);
        totalAdhBags   += surfaces.reduce((a, s) => a + (s.adhBags       || 0), 0);
        totalGroutBags += surfaces.reduce((a, s) => a + (s.groutBags     || 0), 0);
        totalGroutKg   += surfaces.reduce((a, s) => a + (s.groutKg       || 0), 0);
        totalCBBoards  += surfaces.reduce((a, s) => a + (s.cementBoards  || 0), 0);
        totalLevelBags += surfaces.reduce((a, s) => a + (s.levelBags     || 0), 0);
    });

    const subtotal = totalMats + totalLabour + totalPrep;
    const vatAmt   = applyVat ? subtotal * 0.2 : 0;
    const grand    = subtotal + vatAmt;

    document.getElementById("quote-output").innerHTML = `
    <div class="quote-doc">
        <div class="quote-header">
            <div class="quote-company">
                <div class="quote-company-name">${esc(co)}</div>
                ${phone ? `<div>${esc(phone)}</div>` : ""}
                ${email ? `<div>${esc(email)}</div>` : ""}
            </div>
            <div class="quote-meta">
                <div class="quote-ref">${quoteRef}</div>
                <div>Issued: ${fmt(today)}</div>
                <div>Expires: ${fmt(expiry)}</div>
            </div>
        </div>

        <div class="quote-customer">
            <strong>${esc(j.customerName)}</strong>
            ${addr ? `<br>${esc(addr)}` : ""}
            ${j.email ? `<br>${esc(j.email)}` : ""}
        </div>

        <table class="quote-table">
            <tbody>
                <tr><td>Materials</td><td style="text-align:right">£${totalMats.toFixed(2)}</td></tr>
                <tr><td>Labour</td><td style="text-align:right">£${totalLabour.toFixed(2)}</td></tr>
                ${totalPrep > 0 ? `<tr><td>Preparation</td><td style="text-align:right">£${totalPrep.toFixed(2)}</td></tr>` : ""}
            </tbody>
        </table>
        <div class="quote-mat-schedule">
            <div class="qms-title">Materials Schedule</div>
            ${totalAdhBags   > 0 ? `<div class="qms-row"><span>Tile Adhesive</span><span>${totalAdhBags} × 20kg bag${totalAdhBags !== 1 ? "s" : ""}</span></div>` : ""}
            ${totalGroutBags > 0 ? `<div class="qms-row"><span>Grout</span><span>${totalGroutBags} × 2.5kg bag${totalGroutBags !== 1 ? "s" : ""} (${parseFloat(totalGroutKg.toFixed(1))}kg total)</span></div>` : ""}
            ${totalCBBoards  > 0 ? `<div class="qms-row"><span>Cement Board</span><span>${totalCBBoards} board${totalCBBoards !== 1 ? "s" : ""} (0.96m² each)</span></div>` : ""}
            ${totalLevelBags > 0 ? `<div class="qms-row"><span>Levelling Compound</span><span>${totalLevelBags} × 20kg bag${totalLevelBags !== 1 ? "s" : ""}</span></div>` : ""}
        </div>

        <div class="quote-totals">
            <div class="quote-total-row"><span>Subtotal</span><span>£${subtotal.toFixed(2)}</span></div>
            ${applyVat ? `<div class="quote-total-row"><span>VAT (20%)</span><span>£${vatAmt.toFixed(2)}</span></div>` : ""}
            <div class="quote-total-row quote-grand"><span>Total</span><span>£${grand.toFixed(2)}</span></div>
        </div>

        ${settings.terms ? `<div class="quote-terms">${esc(settings.terms)}</div>` : ""}
    </div>`;
}

/* ─── AI Description ─── */
async function generateAI() {
    const j     = getJob();
    const style = document.getElementById("ai-style").value;
    const box   = document.getElementById("ai-box");
    const rooms = (j.rooms || []).map(r =>
        `${r.name}: ${r.type}, ${r.area} m², £${r.total}`
    ).join("; ");

    box.innerHTML = `<div class="ai-loading">✨ Generating…</div>`;
    try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 200,
                messages: [{
                    role: "user",
                    content: `Write a single short paragraph (60-90 words) describing the scope of work for a tiling job quote. Style: ${style}. Customer: ${j.customerName}. Rooms: ${rooms}. Use UK English, third person, professional tone.`
                }]
            })
        });
        const data = await res.json();
        const text = data.content?.[0]?.text || "Could not generate description.";
        box.innerHTML = `<div class="ai-result">${esc(text)}</div>`;
    } catch(e) {
        box.innerHTML = `<div class="ai-result">Error generating description. Please try again.</div>`;
    }
}

/* ─── CSV Export ─── */
function exportCSV() {
    const j = getJob();
    const rows = [["Quote ID","Customer","Room","Surface","Type","Area (m²)","Total (ex VAT)"]];
    const qid  = "Q" + Date.now().toString().slice(-6);
    (j.rooms || []).forEach(room => {
        (room.surfaces || []).forEach(s => {
            rows.push([qid, j.customerName, room.name, s.label, s.type, s.area.toFixed(2), s.total]);
        });
    });
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${j.customerName.replace(/\s+/g,"-")}-quote.csv`;
    a.click(); URL.revokeObjectURL(url);
}

/* ─── FreeAgent Export ─── */
function exportFreeAgent() {
    const j = getJob();
    const applyVat = document.getElementById("q-vat").value === "true";
    const subtotal = (j.rooms || []).reduce((a, r) => a + parseFloat(r.total || 0), 0);
    const payload  = {
        contact:   j.customerName,
        reference: "Q" + Date.now().toString().slice(-6),
        dated_on:  new Date().toISOString().split("T")[0],
        items: (j.rooms || []).flatMap(room =>
            (room.surfaces || []).map(s => ({
                description: `${room.name} – ${s.label}`,
                quantity: s.area,
                price: parseFloat(s.total),
                vat_rate: applyVat ? 20 : 0
            }))
        )
    };
    console.log("FreeAgent payload:", JSON.stringify(payload, null, 2));
    alert("FreeAgent payload logged to console. Connect your FreeAgent API key in Settings to enable live sync.");
}

/* ─── PDF ─── */
function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const j = getJob();
    const applyVat = document.getElementById("q-vat").value === "true";
    const doc = new jsPDF({ unit:"mm", format:"a4" });

    const amber = [230, 175, 46];
    const dark  = [30, 35, 40];
    const mid   = [90, 95, 100];
    const W     = 210;

    // Header band
    doc.setFillColor(...dark);
    doc.rect(0, 0, W, 28, "F");
    doc.setFont("helvetica","bold");
    doc.setFontSize(16);
    doc.setTextColor(...amber);
    doc.text(settings.companyName || "Your Tiling Company", 14, 12);
    doc.setFontSize(9);
    doc.setTextColor(200,200,200);
    if (settings.companyPhone) doc.text(settings.companyPhone, 14, 19);
    if (settings.companyEmail) doc.text(settings.companyEmail, 14, 24);

    const quoteRef = "Q" + Date.now().toString().slice(-6);
    doc.setTextColor(...amber);
    doc.setFontSize(11);
    doc.text(quoteRef, W - 14, 12, { align:"right" });
    doc.setFontSize(8); doc.setTextColor(200,200,200);
    const today  = new Date();
    const expiry = new Date(); expiry.setDate(today.getDate() + parseInt(document.getElementById("q-expiry").value || 30));
    const fmt    = d => d.toLocaleDateString("en-GB");
    doc.text(`Issued: ${fmt(today)}`, W - 14, 19, { align:"right" });
    doc.text(`Expires: ${fmt(expiry)}`, W - 14, 24, { align:"right" });

    // Customer block
    let y = 38;
    doc.setTextColor(...dark);
    doc.setFont("helvetica","bold");
    doc.setFontSize(10);
    doc.text(j.customerName, 14, y);
    doc.setFont("helvetica","normal");
    doc.setFontSize(9);
    doc.setTextColor(...mid);
    const addr = [j.address, j.city, j.postcode].filter(Boolean).join(", ");
    if (addr) { y += 5; doc.text(addr, 14, y); }
    if (j.email) { y += 5; doc.text(j.email, 14, y); }

    // Table
    y += 10;
    doc.setFillColor(...amber);
    doc.rect(14, y, W - 28, 7, "F");
    doc.setTextColor(...dark);
    doc.setFont("helvetica","bold");
    doc.setFontSize(9);
    doc.text("Description", 17, y + 5);
    doc.text("Area", 145, y + 5);
    doc.text("Total", W - 14, y + 5, { align:"right" });
    y += 9;

    let subtotal = 0;
    doc.setFont("helvetica","normal");
    (j.rooms || []).forEach(room => {
        doc.setTextColor(...dark);
        doc.setFont("helvetica","bold");
        doc.setFontSize(8);
        doc.text(room.name, 17, y);
        y += 5;
        (room.surfaces || []).forEach(s => {
            doc.setFont("helvetica","normal");
            doc.setTextColor(...mid);
            doc.text(`  ${s.label}`, 17, y);
            doc.text(`${s.area.toFixed(2)} m²`, 145, y);
            const cost = parseFloat(s.total || 0);
            subtotal += cost;
            doc.text(`£${cost.toFixed(2)}`, W - 14, y, { align:"right" });
            y += 5;
        });
        y += 2;
    });

    // Totals
    y += 2;
    doc.setDrawColor(...amber);
    doc.setLineWidth(0.5);
    doc.line(14, y, W - 14, y);
    y += 6;
    doc.setTextColor(...dark);
    doc.setFont("helvetica","normal");
    doc.setFontSize(9);
    doc.text("Subtotal", W - 55, y);
    doc.text(`£${subtotal.toFixed(2)}`, W - 14, y, { align:"right" });
    if (applyVat) {
        y += 5;
        doc.text("VAT (20%)", W - 55, y);
        doc.text(`£${(subtotal * 0.2).toFixed(2)}`, W - 14, y, { align:"right" });
    }
    y += 6;
    doc.setFont("helvetica","bold");
    doc.setFontSize(10);
    doc.setTextColor(...amber);
    const grand = applyVat ? subtotal * 1.2 : subtotal;
    doc.text("TOTAL", W - 55, y);
    doc.text(`£${grand.toFixed(2)}`, W - 14, y, { align:"right" });

    if (settings.terms) {
        y += 12;
        doc.setTextColor(...mid);
        doc.setFont("helvetica","normal");
        doc.setFontSize(7);
        doc.text(settings.terms, 14, y, { maxWidth: W - 28 });
    }

    doc.save(`${j.customerName.replace(/\s+/g,"-")}-quote.pdf`);
}
