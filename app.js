// URL de la API publicada en Render
const API_BASE_URL = "https://mascotas-api-4exj.onrender.com/api/v1/mascotas";

// Especies que se pueden elegir con un clic. "Otra" permite escribir cualquier especie.
const SPECIES = [
  { name: "Perro", emoji: "🐶", color: "#fde3d3" },
  { name: "Gato", emoji: "🐱", color: "#e6e1fb" },
  { name: "Conejo", emoji: "🐰", color: "#fbe1ec" },
  { name: "Ave", emoji: "🐦", color: "#dff0fb" },
  { name: "Hámster", emoji: "🐹", color: "#fbefd6" },
  { name: "Otra", emoji: "🐾", color: "#e3f1e6" },
];

// ---------- Estado de la aplicación ----------
const state = {
  mascotas: [],
  search: "",
  sort: "recientes",
  vacFilter: "todas", // todas | si | no
  speciesFilter: null, // null = todas las especies
  deletingId: null,
};

// ---------- Referencias al DOM ----------
const $ = (id) => document.getElementById(id);

const grid = $("pet-grid");
const loadingEl = $("loading");
const loadingText = $("loading-text");
const emptyEl = $("empty");
const chipsEl = $("species-chips");

const formModal = $("form-modal");
const form = $("pet-form");
const formTitle = $("form-title");
const submitBtn = $("submit-btn");
const idInput = $("pet-id");
const nombreInput = $("nombre");
const razaInput = $("raza");
const edadInput = $("edad");
const vacunadaInput = $("vacunada");
const especieOtraInput = $("especie-otra");
const speciesPicker = $("species-picker");

const confirmModal = $("confirm-modal");
let selectedSpecies = "Perro";

// ---------- Utilidades ----------
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function normalize(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function speciesInfo(especie) {
  const found = SPECIES.find((s) => normalize(s.name) === normalize(especie));
  return found || SPECIES[SPECIES.length - 1];
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.textContent = message;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ---------- Comunicación con la API ----------
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch (_) {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const api = {
  list: () => apiRequest(API_BASE_URL),
  create: (data) => apiRequest(API_BASE_URL, { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`${API_BASE_URL}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => apiRequest(`${API_BASE_URL}/${id}`, { method: "DELETE" }),
};

// ---------- Carga inicial ----------
async function loadPets() {
  loadingEl.hidden = false;
  emptyEl.hidden = true;
  loadingText.textContent = "Cargando mascotas...";

  // En el plan gratis de Render la API se "duerme"; avisamos si tarda.
  const slowTimer = setTimeout(() => {
    loadingText.textContent = "Despertando el servidor de Render… puede tardar hasta un minuto ☕";
  }, 4000);

  try {
    state.mascotas = (await api.list()) || [];
    render();
  } catch (error) {
    grid.innerHTML = "";
    showEmpty("😿", "No se pudo conectar con la API", error.message);
  } finally {
    clearTimeout(slowTimer);
    loadingEl.hidden = true;
  }
}

// ---------- Renderizado ----------
function getVisiblePets() {
  const term = normalize(state.search);

  let list = state.mascotas.filter((m) => {
    const matchesText = !term || normalize(m.nombre).includes(term) || normalize(m.raza).includes(term);
    const matchesVac =
      state.vacFilter === "todas" ||
      (state.vacFilter === "si" && m.vacunada) ||
      (state.vacFilter === "no" && !m.vacunada);
    const matchesSpecies = !state.speciesFilter || normalize(m.especie) === normalize(state.speciesFilter);
    return matchesText && matchesVac && matchesSpecies;
  });

  const sorters = {
    recientes: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es"),
    "edad-asc": (a, b) => a.edad - b.edad,
    "edad-desc": (a, b) => b.edad - a.edad,
  };
  return [...list].sort(sorters[state.sort]);
}

function render() {
  renderStats();
  renderChips();

  const visible = getVisiblePets();
  grid.innerHTML = "";
  visible.forEach((m) => grid.appendChild(createCard(m)));

  if (state.mascotas.length === 0) {
    showEmpty("🐶", "Aún no hay mascotas", "Registra la primera con el botón “Nueva mascota”.");
  } else if (visible.length === 0) {
    showEmpty("🔎", "Sin resultados", "Ninguna mascota coincide con la búsqueda o los filtros.");
  } else {
    emptyEl.hidden = true;
  }
}

function showEmpty(icon, title, text) {
  emptyEl.querySelector(".empty__icon").textContent = icon;
  $("empty-title").textContent = title;
  $("empty-text").textContent = text;
  emptyEl.hidden = false;
}

function renderStats() {
  const list = state.mascotas;
  const total = list.length;
  const vacunadas = list.filter((m) => m.vacunada).length;
  const promedio = total ? list.reduce((sum, m) => sum + m.edad, 0) / total : 0;

  const conteo = {};
  list.forEach((m) => (conteo[m.especie] = (conteo[m.especie] || 0) + 1));
  const top = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];

  $("stat-total").textContent = total;
  $("stat-vacunadas").textContent = total ? `${Math.round((vacunadas / total) * 100)}%` : "0%";
  $("stat-edad").textContent = total ? `${promedio.toFixed(1)} años` : "—";
  $("stat-especie").textContent = top ? `${speciesInfo(top[0]).emoji} ${top[0]}` : "—";
}

function renderChips() {
  const conteo = {};
  state.mascotas.forEach((m) => (conteo[m.especie] = (conteo[m.especie] || 0) + 1));

  // Si la especie filtrada ya no existe (se borró), quitamos el filtro
  if (state.speciesFilter && !conteo[state.speciesFilter]) state.speciesFilter = null;

  const chips = [`<button type="button" class="chip ${!state.speciesFilter ? "is-active" : ""}" data-species="">
      Todas <span>${state.mascotas.length}</span></button>`];

  Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .forEach(([especie, n]) => {
      const active = state.speciesFilter === especie ? "is-active" : "";
      chips.push(`<button type="button" class="chip ${active}" data-species="${escapeHtml(especie)}">
        ${speciesInfo(especie).emoji} ${escapeHtml(especie)} <span>${n}</span></button>`);
    });

  chipsEl.innerHTML = state.mascotas.length ? chips.join("") : "";
}

function createCard(m) {
  const info = speciesInfo(m.especie);
  const anios = m.edad === 1 ? "año" : "años";
  const etapa = m.edad < 1 ? "Cachorro" : m.edad <= 7 ? "Adulto" : "Senior";

  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = m._id;
  card.innerHTML = `
    <div class="card__top">
      <div class="avatar" style="background:${info.color}">${info.emoji}</div>
      <div>
        <h3 class="card__name">${escapeHtml(m.nombre)}</h3>
        <p class="card__sub">${escapeHtml(m.especie)} · ${escapeHtml(m.raza)}</p>
      </div>
    </div>
    <div class="card__tags">
      <span class="tag">🎂 ${m.edad} ${anios}</span>
      <span class="tag">${etapa}</span>
      ${m.vacunada
        ? '<span class="tag tag--ok">✔ Vacunada</span>'
        : '<span class="tag tag--warn">⚠ Vacunas pendientes</span>'}
    </div>
    <div class="card__foot">
      <span class="card__date">Registrada el ${formatDate(m.createdAt)}</span>
      <div class="card__actions">
        <button type="button" class="icon-btn icon-btn--vac ${m.vacunada ? "is-on" : ""}" data-action="toggle"
          title="${m.vacunada ? "Marcar como pendiente" : "Marcar como vacunada"}">💉</button>
        <button type="button" class="icon-btn" data-action="edit" title="Editar">✏️</button>
        <button type="button" class="icon-btn icon-btn--danger" data-action="delete" title="Eliminar">🗑️</button>
      </div>
    </div>`;
  return card;
}

// ---------- Selector de especie del formulario ----------
function renderSpeciesPicker() {
  speciesPicker.innerHTML = SPECIES.map(
    (s) => `<button type="button" class="species-opt ${s.name === selectedSpecies ? "is-active" : ""}"
      data-name="${s.name}">${s.emoji} ${s.name}</button>`
  ).join("");
  especieOtraInput.hidden = selectedSpecies !== "Otra";
}

speciesPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".species-opt");
  if (!btn) return;
  selectedSpecies = btn.dataset.name;
  renderSpeciesPicker();
  if (selectedSpecies === "Otra") especieOtraInput.focus();
});

// ---------- Modal de formulario (crear / editar) ----------
function openForm(mascota = null) {
  form.reset();
  clearErrors();

  if (mascota) {
    formTitle.textContent = `Editar a ${mascota.nombre}`;
    submitBtn.textContent = "Guardar cambios";
    idInput.value = mascota._id;
    nombreInput.value = mascota.nombre;
    razaInput.value = mascota.raza;
    edadInput.value = mascota.edad;
    vacunadaInput.checked = mascota.vacunada;

    const known = SPECIES.find((s) => s.name !== "Otra" && normalize(s.name) === normalize(mascota.especie));
    selectedSpecies = known ? known.name : "Otra";
    especieOtraInput.value = known ? "" : mascota.especie;
  } else {
    formTitle.textContent = "Nueva mascota";
    submitBtn.textContent = "Guardar mascota";
    idInput.value = "";
    edadInput.value = 0;
    selectedSpecies = "Perro";
  }

  renderSpeciesPicker();
  formModal.hidden = false;
  nombreInput.focus();
}

function closeModals() {
  formModal.hidden = true;
  confirmModal.hidden = true;
  state.deletingId = null;
}

document.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModals));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModals();
});
$("open-form-btn").addEventListener("click", () => openForm());

// Botones + y − de la edad
document.querySelectorAll(".stepper__btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    const next = (parseInt(edadInput.value, 10) || 0) + Number(btn.dataset.step);
    edadInput.value = Math.min(40, Math.max(0, next));
  })
);

// ---------- Validación ----------
function setError(field, message) {
  const small = form.querySelector(`.field__error[data-for="${field}"]`);
  small.textContent = message;
  small.closest(".field").classList.add("has-error");
}

function clearErrors() {
  form.querySelectorAll(".field__error").forEach((el) => (el.textContent = ""));
  form.querySelectorAll(".has-error").forEach((el) => el.classList.remove("has-error"));
}

function readForm() {
  clearErrors();
  const data = {
    nombre: nombreInput.value.trim(),
    especie: selectedSpecies === "Otra" ? especieOtraInput.value.trim() : selectedSpecies,
    raza: razaInput.value.trim(),
    edad: Number(edadInput.value),
    vacunada: vacunadaInput.checked,
  };

  let ok = true;
  if (data.nombre.length < 2) { setError("nombre", "Escribe un nombre de al menos 2 letras."); ok = false; }
  if (!data.especie) { setError("especie", "Escribe cuál es la especie."); ok = false; }
  if (!data.raza) { setError("raza", "La raza es obligatoria (puedes poner “Criolla”)."); ok = false; }
  if (!Number.isInteger(data.edad) || data.edad < 0 || data.edad > 40) {
    setError("edad", "La edad debe ser un número entero entre 0 y 40.");
    ok = false;
  }

  // Evitar nombres repetidos de la misma especie
  const repetida = state.mascotas.find(
    (m) => m._id !== idInput.value &&
      normalize(m.nombre) === normalize(data.nombre) &&
      normalize(m.especie) === normalize(data.especie)
  );
  if (ok && repetida) { setError("nombre", `Ya existe un(a) ${data.especie.toLowerCase()} llamado(a) ${repetida.nombre}.`); ok = false; }

  return ok ? data : null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = readForm();
  if (!data) return;

  const id = idInput.value;
  submitBtn.disabled = true;
  submitBtn.textContent = "Guardando...";

  try {
    if (id) {
      const updated = await api.update(id, data);
      state.mascotas = state.mascotas.map((m) => (m._id === id ? updated : m));
      toast(`${data.nombre} se actualizó ✏️`, "ok");
    } else {
      const created = await api.create(data);
      state.mascotas.unshift(created);
      toast(`${data.nombre} quedó registrada 🎉`, "ok");
    }
    closeModals();
    render();
  } catch (error) {
    toast(`No se pudo guardar: ${error.message}`, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = id ? "Guardar cambios" : "Guardar mascota";
  }
});

// ---------- Acciones de cada tarjeta ----------
grid.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.closest(".card").dataset.id;
  const mascota = state.mascotas.find((m) => m._id === id);
  if (!mascota) return;

  if (btn.dataset.action === "edit") openForm(mascota);

  if (btn.dataset.action === "delete") {
    state.deletingId = id;
    $("confirm-name").textContent = mascota.nombre;
    confirmModal.hidden = false;
  }

  if (btn.dataset.action === "toggle") {
    btn.disabled = true;
    try {
      const updated = await api.update(id, { vacunada: !mascota.vacunada });
      state.mascotas = state.mascotas.map((m) => (m._id === id ? updated : m));
      toast(updated.vacunada ? `${mascota.nombre} ya está vacunada 💉` : `${mascota.nombre} quedó con vacunas pendientes`, "ok");
      render();
    } catch (error) {
      toast(`No se pudo actualizar: ${error.message}`, "error");
      btn.disabled = false;
    }
  }
});

$("confirm-delete-btn").addEventListener("click", async () => {
  const id = state.deletingId;
  if (!id) return;
  const mascota = state.mascotas.find((m) => m._id === id);
  const btn = $("confirm-delete-btn");
  btn.disabled = true;

  try {
    await api.remove(id);
    state.mascotas = state.mascotas.filter((m) => m._id !== id);
    toast(`${mascota ? mascota.nombre : "La mascota"} fue eliminada`, "ok");
    closeModals();
    render();
  } catch (error) {
    toast(`No se pudo eliminar: ${error.message}`, "error");
  } finally {
    btn.disabled = false;
  }
});

// ---------- Búsqueda y filtros ----------
$("search-input").addEventListener("input", (e) => {
  state.search = e.target.value;
  render();
});

$("sort-select").addEventListener("change", (e) => {
  state.sort = e.target.value;
  render();
});

document.querySelectorAll(".segmented__btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".segmented__btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.vacFilter = btn.dataset.vac;
    render();
  })
);

chipsEl.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  state.speciesFilter = chip.dataset.species || null;
  render();
});

loadPets();
