// CONSTANTES
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

//--Colores para dibujar
const COLORS = [
  "#0d6efd", // azul
  "#198754", // verde
  "#fd7e14", // naranja
  "#dc3545", // rojo
  "#6f42c1", // morado
  "#0dcaf0", // cyan
  "#20c997", // turquesa
];

const pdfCanvas = document.getElementById("pdf-canvas");
const overlayCanvas = document.getElementById("overlay-canvas");
const pdfWrapper = document.getElementById("pdf-wrapper");
const placeholder = document.getElementById("placeholder");
const toastEl = document.getElementById("toast-msg");
const toastBody = document.getElementById("toast-body");
const infoCrear = document.getElementById("info-crear");
const clearBtn = document.getElementById("clear-btn");
const clearAllBtn = document.getElementById("clear-all-btn");
const loadAreasBtn = document.getElementById("load-areas-btn");
const extractBtn = document.getElementById("extract-btn");
const exportBtn = document.getElementById("export-btn");
const formRepeat = document.getElementById("form-repeat");
const extractTbody = document.getElementById("extract-tbody");
const extractLoading = document.getElementById("extract-loading");
const extractTable = document.getElementById("extract-table");
const repeatAreasCheck = document.getElementById("repeat-areas-check");
const navigate = document.getElementById("navigate");
//--devuelve el objeto con el que puedes dibujar dentro de ese canvas
const pdfCtx = pdfCanvas.getContext("2d");
const ovCtx = overlayCanvas.getContext("2d");

// VARIABLES
let pdfDoc = null;
let currentPage = 1;
let scale = 1.5;
let areas = [];
let drawing = false;
let startX,
  startY,
  currentRect = null;

// Funciones
// --Colores de los rectángulos dibujados
function colorFor(index) {
  return COLORS[index % COLORS.length];
}

// --Actualizar toast con información para el usuario
function showToast(msg, type = "success") {
  toastBody.textContent = msg;
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2500 }).show();
}

// --Renderizar pdf
function renderPDF(num) {
  pdfDoc.getPage(num).then((page) => {
    const vp = page.getViewport({ scale });
    pdfCanvas.width = overlayCanvas.width = vp.width;
    pdfCanvas.height = overlayCanvas.height = vp.height;
    page
      .render({ canvasContext: pdfCtx, viewport: vp })
      .promise.then(redrawOverlay);
    document.getElementById("page-info").textContent =
      `${num} / ${pdfDoc.numPages}`;
  });
}

//--Dibujar en el canvas
function drawArea(r) {
  const color = colorFor(areas.indexOf(r));

  ovCtx.strokeStyle = color;
  ovCtx.lineWidth = 2;
  ovCtx.setLineDash([]);
  ovCtx.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);

  ovCtx.fillStyle = color + "28";
  ovCtx.fillRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);

  ovCtx.fillStyle = color;
  ovCtx.font = "bold 11px sans-serif";
  ovCtx.strokeStyle = "#000000";
  ovCtx.lineWidth = 3;
  ovCtx.lineJoin = "round";
  ovCtx.strokeText(r.label, r.x * scale + 4, r.y * scale + 14);
  ovCtx.fillText(r.label, r.x * scale + 4, r.y * scale + 14);
}

//Dibujo temporal
function drawCurrentRect() {
  ovCtx.strokeStyle = "#0d6efd";
  ovCtx.lineWidth = 2;
  ovCtx.setLineDash([5, 3]);
  ovCtx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);

  ovCtx.fillStyle = "#0d6efd18";
  ovCtx.fillRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
}

function redrawOverlay() {
  ovCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  areas.filter((r) => r.page === currentPage).forEach((r) => drawArea(r));

  if (currentRect) drawCurrentRect();
}

function updateSidebar() {
  const list = document.getElementById("areas-list");
  document.getElementById("area-count").textContent = areas.length;

  if (areas.length === 0) {
    clearBtn.classList.add("d-none");
    clearAllBtn.classList.add("d-none");
    extractBtn.classList.add("d-none");
    exportBtn.classList.add("d-none");
    formRepeat.classList.add("d-none");
    list.innerHTML =
      '<p class="text-center text-muted mt-4" style="font-size:12px;">Sin áreas aún</p>';
    return;
  }
  clearBtn.classList.remove("d-none");
  clearAllBtn.classList.remove("d-none");
  extractBtn.classList.remove("d-none");
  exportBtn.classList.remove("d-none");
  formRepeat.classList.remove("d-none");
  list.innerHTML = areas
    .map((r, i) => {
      const color = colorFor(i);
      return `
      <div class="area-card">
        <div class="d-flex align-items-center gap-2">
          <span class="color-dot" style="background:${color};"></span>
          <span class="fw-semibold flex-grow-1" style="font-size:13px;">${r.label}</span>
          <span class="badge bg-light text-secondary border" style="font-size:10px;">pág. ${r.page}</span>
          <button class="btn btn-sm btn-outline-primary btn-toolbar-action"
                  onclick="renameArea(${i})" title="Renombrar">
            <i class="bi bi-pencil" style="font-size:12px;"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger btn-toolbar-action"
                  onclick="deleteArea(${i})" title="Eliminar">
            <i class="bi bi-x-lg" style="font-size:12px;"></i>
          </button>
        </div>
        <div class="coords-box">
          x: <strong>${Math.round(r.x)}</strong> &nbsp;
          y: <strong>${Math.round(r.y)}</strong> &nbsp;
          w: <strong>${Math.round(r.w)}</strong> &nbsp;
          h: <strong>${Math.round(r.h)}</strong>
        </div>
      </div>`;
    })
    .join("");
}

function deleteArea(i) {
  areas.splice(i, 1);
  redrawOverlay();
  updateSidebar();
}

function newNameArea(name = null) {
  let error = "";

  while (true) {
    const defaultValue = name != null ? areas[name].label : "";
    const errorPrefix = error ? `⚠️ ${error}\n\n` : "";

    const newLabel = prompt(
      `${errorPrefix}${name != null ? "Cambiar nombre para el área:" : "Nombre para la nueva área:"}`,
      defaultValue,
    );

    if (newLabel === null) return null;

    const trimmed = newLabel.trim();

    if (trimmed === "") {
      error = "El nombre no puede estar vacío.";
      continue;
    }

    if (isLabelDuplicated(trimmed, name)) {
      error = `Ya existe un área con el nombre "${trimmed}".`;
      continue;
    }

    return trimmed;
  }
}

function renameArea(i) {
  areas[i].label = newNameArea(i);
  redrawOverlay();
  updateSidebar();
}

function isLabelDuplicated(label, excludeIndex) {
  return areas.some((r, i) => r.label === label && i !== excludeIndex);
}

//--Cargar archivo en navegador
function loadPDF(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    pdfjsLib.getDocument({ data: ev.target.result }).promise.then((doc) => {
      pdfDoc = doc;
      currentPage = 1;
      areas = [];
      placeholder.style.display = "none";
      pdfWrapper.style.display = "block";
      navigate.classList.remove("d-none");
      loadAreasBtn.classList.remove("d-none");
      renderPDF(currentPage);
      updateSidebar();
      showToast(`PDF cargado: ${doc.numPages} página(s)`);
    });
  };
  reader.readAsArrayBuffer(file);
}

function askFileName(defaultName, extension) {
  const input = prompt(`Nombre del archivo (sin extensión):`, defaultName);
  if (input === null) return null;
  const name = input.trim() || defaultName;
  return `${name}.${extension}`;
}

function exportJSON() {
  if (areas.length === 0) {
    showToast("No hay áreas para exportar", "warning");
    return;
  }
  const filename = askFileName("areas", "json");
  if (!filename) return;

  const blob = new Blob([JSON.stringify(areas, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${areas.length} area(s) exportadas`);
}

//Extracción de texto
async function extractTextFromArea(area) {
  const page = await pdfDoc.getPage(area.page);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  // PDF.js usa coordenadas con origen en la esquina inferior-izquierda,
  // así que convertimos nuestras coordenadas (origen arriba-izquierda)
  const pageHeight = viewport.height;
  const areaBottom = pageHeight - area.y;
  const areaTop = pageHeight - (area.y + area.h);

  const words = content.items
    .filter((item) => {
      const tx = item.transform[4];
      const ty = item.transform[5];
      return (
        tx >= area.x &&
        tx <= area.x + area.w &&
        ty >= areaTop &&
        ty <= areaBottom
      );
    })
    .map((item) => item.str);

  return words.join(" ").trim();
}

function loadJSONFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        reject("Sin archivo");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          resolve(data);
        } catch {
          reject("JSON inválido");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

async function loadAreasFromJSON() {
  let loaded;
  try {
    loaded = await loadJSONFile();
  } catch (err) {
    showToast(`Error al cargar el JSON: ${err}`, "danger");
    return;
  }

  if (!Array.isArray(loaded) || loaded.length === 0) {
    showToast("El JSON no contiene áreas válidas", "warning");
    return;
  }

  areas = loaded;
  redrawOverlay();
  updateSidebar();
  showToast(`${areas.length} área(s) cargadas`);
}

async function extractAllAreas() {
  if (!pdfDoc) {
    showToast("No hay PDF cargado", "warning");
    return;
  }

  // Mostrar modal y spinner
  extractTbody.innerHTML = "";
  extractTable.classList.add("d-none");
  extractLoading.classList.remove("d-none");
  bootstrap.Modal.getOrCreateInstance(
    document.getElementById("extract-modal"),
  ).show();

  // Si la casilla está marcada, replicar las áreas de la página 1 en todas las páginas
  let areasToExtract = areas;
  if (repeatAreasCheck.checked && pdfDoc.numPages > 1) {
    const page1Areas = areas.filter((a) => a.page === 1);
    areasToExtract = [];
    for (let p = 1; p <= pdfDoc.numPages; p++) {
      page1Areas.forEach((a) => areasToExtract.push({ ...a, page: p }));
    }
  }

  // Extraer texto de cada área secuencialmente
  const results = [];
  for (const area of areasToExtract) {
    const text = await extractTextFromArea(area);
    results.push({ label: area.label, text });
  }
  console.log(results);

  // Agrupar por label
  const grouped = {};

  for (const r of results) {
    const label = r.label;
    const text = (r.text || "").trim();

    if (!grouped[label]) {
      grouped[label] = [];
    }

    grouped[label].push(text);
  }

  // Renderizar tabla
  let tablehtml = `<tr>`;
  // recorrer cada label
  for (const label in grouped) {
    tablehtml += `<td class="fw-semibold text-nowrap" style="font-size:13px;">${label}</td>`;

    // recorrer cada texto dentro de la label
    for (const text of grouped[label]) {
      tablehtml += `<td style="font-size:13px; white-space: pre-wrap;">${text}</td>`;
    }
    tablehtml += `</tr>`;
  }

  extractTbody.innerHTML = tablehtml;

  extractLoading.classList.add("d-none");
  extractTable.classList.remove("d-none");

  // Guardar resultados para exportar CSV
  window._extractResults = results;
}

function exportCSV() {
  const tabla = document.getElementById("extract-table");
  if (!tabla || tabla.rows.length === 0) return;

  // Leer la tabla en una matriz [fila][columna]
  const matriz = [];
  for (let fila of tabla.rows) {
    if (fila != tabla.rows[0]) {
      let cols = fila.querySelectorAll("td");
      let filaData = [];
      cols.forEach((col) => {
        filaData.push(col.innerText.replace(/"/g, '""'));
      });
      matriz.push(filaData);
    }
  }

  // Transponer: matriz[fila][col] → transpuesta[col][fila]
  const numCols = Math.max(...matriz.map((f) => f.length));
  const transpuesta = Array.from({ length: numCols }, (_, col) =>
    matriz.map((fila) => `"${fila[col] ?? ""}"`),
  );

  const csvString = transpuesta.map((fila) => fila.join(";")).join("\n");

  const filename = askFileName("extraccion", "csv");
  if (!filename) return;

  // Descargar archivo
  const blob = new Blob(["\uFEFF" + csvString], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// EVENTOS
// Dibujo sobre el canvas
overlayCanvas.addEventListener("pointerdown", (e) => {
  if (!pdfDoc) return;
  if (e.pointerType === "touch" && !floatingIsActive) return;

  const rect = overlayCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (!drawing) {
    startX = x;
    startY = y;
    drawing = true;
    currentRect = { x, y, w: 0, h: 0 };

    if (e.pointerType === "touch") {
      overlayCanvas.setPointerCapture(e.pointerId);
    }

    return
  }

  if (drawing && e.pointerType === "mouse") {
    let newName = newNameArea();
    if (newName && currentRect && currentRect.w > 5 && currentRect.h > 5) {
      areas.push({
        label: newName, //(`R${areas.length + 1}`),
        page: currentPage,
        x: Math.round(currentRect.x / scale),
        y: Math.round(currentRect.y / scale),
        w: Math.round(currentRect.w / scale),
        h: Math.round(currentRect.h / scale),
      });
      updateSidebar();
    }
    currentRect = null;
    redrawOverlay();
    drawing = false;
  }
});

overlayCanvas.addEventListener("pointermove", (e) => {
  if (!drawing) return;
  const rect = overlayCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  currentRect = {
    x: Math.min(startX, mx),
    y: Math.min(startY, my),
    w: Math.abs(mx - startX),
    h: Math.abs(my - startY),
  };
  redrawOverlay();
});

overlayCanvas.addEventListener("pointerup", (e) => {
  if (e.pointerType !== "touch") return;
  if (!drawing) return;
  overlayCanvas.releasePointerCapture(e.pointerId);
  let newName = newNameArea();
    if (newName && currentRect && currentRect.w > 5 && currentRect.h > 5) {
      areas.push({
        label: newName, //(`R${areas.length + 1}`),
        page: currentPage,
        x: Math.round(currentRect.x / scale),
        y: Math.round(currentRect.y / scale),
        w: Math.round(currentRect.w / scale),
        h: Math.round(currentRect.h / scale),
      });
      updateSidebar();
    }
    currentRect = null;
    redrawOverlay();
    drawing = false;
});

//--Toolbar
document.getElementById("pdf-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) loadPDF(file);
});

document.getElementById("prev-btn").addEventListener("click", () => {
  if (pdfDoc && currentPage > 1) {
    currentPage--;
    renderPDF(currentPage);
  }
});

document.getElementById("next-btn").addEventListener("click", () => {
  if (pdfDoc && currentPage < pdfDoc.numPages) {
    currentPage++;
    renderPDF(currentPage);
  }
});

document.getElementById("zoom-in").addEventListener("click", () => {
  scale = Math.min(scale + 0.25, 3.5);
  document.getElementById("zoom-info").textContent =
    Math.round((scale / 1.5) * 100) + "%";
  if (pdfDoc) renderPDF(currentPage);
});

document.getElementById("zoom-out").addEventListener("click", () => {
  scale = Math.max(scale - 0.25, 0.5);
  document.getElementById("zoom-info").textContent =
    Math.round((scale / 1.5) * 100) + "%";
  if (pdfDoc) renderPDF(currentPage);
});

document.getElementById("clear-btn").addEventListener("click", () => {
  areas = areas.filter((r) => r.page !== currentPage);
  redrawOverlay();
  updateSidebar();
  showToast(`Áreas de la página ${currentPage} eliminadas`, "warning");
});

document.getElementById("clear-all-btn").addEventListener("click", () => {
  if (areas.length === 0) return;
  if (confirm("¿Eliminar todas las áreas?")) {
    areas = [];
    redrawOverlay();
    updateSidebar();
    showToast("Todas las áreas eliminadas", "danger");
  }
});

document
  .getElementById("load-areas-btn")
  .addEventListener("click", loadAreasFromJSON);

//----Exportar datos a json
document.getElementById("export-btn").addEventListener("click", exportJSON);

//----tabla y csv
document.getElementById("extract-btn").addEventListener("click", () => {
  if (areas.length === 0) {
    showToast("No hay áreas definidas", "warning");
    return;
  }
  extractAllAreas();
});

document.getElementById("export-csv-btn").addEventListener("click", exportCSV);

const floatingBtn = document.getElementById("floatingBtn");
const floatingIcon = document.getElementById("floatingIcon");
let floatingIsActive = false;

floatingBtn.addEventListener("click", () => {
  floatingIsActive = !floatingIsActive;

  if (floatingIsActive) {
    floatingBtn.classList.remove("btn-danger");
    floatingBtn.classList.add("btn-primary");
    floatingIcon.classList.remove("bi-pencil");
    floatingIcon.classList.add("bi-pencil-fill");
    overlayCanvas.style.touchAction = "none";
    overlayCanvas.style.pointerEvents = "auto";
  } else {
    floatingBtn.classList.remove("btn-primary");
    floatingBtn.classList.add("btn-danger");
    floatingIcon.classList.remove("bi-pencil-fill");
    floatingIcon.classList.add("bi-pencil");
    overlayCanvas.style.touchAction = "auto";
    overlayCanvas.style.pointerEvents = "none";
  }
});