// URL de la API publicada en Render
const API_BASE_URL = "https://mascotas-api-4exj.onrender.com/api/v1/mascotas";

const petForm = document.getElementById("pet-form");
const nombreInput = document.getElementById("nombre-input");
const especieInput = document.getElementById("especie-input");
const razaInput = document.getElementById("raza-input");
const edadInput = document.getElementById("edad-input");
const vacunadaInput = document.getElementById("vacunada-input");

const pendingList = document.getElementById("pending-list");
const doneList = document.getElementById("done-list");
const countPending = document.getElementById("count-pending");
const countDone = document.getElementById("count-done");
const emptyMessage = document.getElementById("empty-message");
const statusEl = document.getElementById("status");

const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editIdInput = document.getElementById("edit-id");
const editNombreInput = document.getElementById("edit-nombre");
const editEspecieInput = document.getElementById("edit-especie");
const editRazaInput = document.getElementById("edit-raza");
const editEdadInput = document.getElementById("edit-edad");

// Guardamos las mascotas cargadas para poder llenar el modal de edición
let mascotas = [];

function showStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = `status status--${type}`;
  statusEl.hidden = false;
}

function hideStatus() {
  statusEl.hidden = true;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
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

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function createPetElement(mascota) {
  const li = document.createElement("li");
  li.className = `task-item${mascota.vacunada ? " task-item--done" : ""}`;
  li.dataset.id = mascota._id;

  const anios = mascota.edad === 1 ? "año" : "años";

  li.innerHTML = `
    <input type="checkbox" class="task-item__checkbox" title="Vacunada" ${mascota.vacunada ? "checked" : ""} />
    <div class="task-item__body">
      <div class="task-item__title">${escapeHtml(mascota.nombre)}</div>
      <div class="task-item__meta">
        ${escapeHtml(mascota.especie)} · ${escapeHtml(mascota.raza)} · ${mascota.edad} ${anios}
      </div>
    </div>
    <div class="task-item__actions">
      <button type="button" class="icon-btn" data-action="edit" title="Editar">✎</button>
      <button type="button" class="icon-btn icon-btn--danger" data-action="delete" title="Eliminar">✕</button>
    </div>
  `;

  return li;
}

function renderPets(lista) {
  pendingList.innerHTML = "";
  doneList.innerHTML = "";

  const sinVacunar = lista.filter((m) => !m.vacunada);
  const vacunadas = lista.filter((m) => m.vacunada);

  sinVacunar.forEach((m) => pendingList.appendChild(createPetElement(m)));
  vacunadas.forEach((m) => doneList.appendChild(createPetElement(m)));

  countPending.textContent = sinVacunar.length;
  countDone.textContent = vacunadas.length;

  emptyMessage.hidden = lista.length !== 0;
}

// GET: trae todas las mascotas
async function loadPets() {
  try {
    hideStatus();
    mascotas = (await apiRequest(API_BASE_URL)) || [];
    renderPets(mascotas);
  } catch (error) {
    showStatus(`No se pudieron cargar las mascotas: ${error.message}`, "error");
  }
}

// POST: crea una mascota
async function createPet(data) {
  await apiRequest(API_BASE_URL, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// PUT: actualiza una mascota
async function updatePet(id, changes) {
  await apiRequest(`${API_BASE_URL}/${id}`, {
    method: "PUT",
    body: JSON.stringify(changes),
  });
}

// DELETE: elimina una mascota
async function deletePet(id) {
  await apiRequest(`${API_BASE_URL}/${id}`, { method: "DELETE" });
}

petForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = {
    nombre: nombreInput.value.trim(),
    especie: especieInput.value.trim(),
    raza: razaInput.value.trim(),
    edad: parseInt(edadInput.value, 10),
    vacunada: vacunadaInput.checked,
  };
  if (!data.nombre || !data.especie || !data.raza || Number.isNaN(data.edad)) return;

  const submitBtn = petForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  try {
    await createPet(data);
    petForm.reset();
    nombreInput.focus();
    await loadPets();
  } catch (error) {
    showStatus(`No se pudo crear la mascota: ${error.message}`, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

async function handleListClick(event) {
  const actionBtn = event.target.closest("[data-action]");
  const checkbox = event.target.closest(".task-item__checkbox");
  const item = event.target.closest(".task-item");
  if (!item) return;
  const id = item.dataset.id;

  // Marcar / desmarcar como vacunada
  if (checkbox) {
    try {
      await updatePet(id, { vacunada: checkbox.checked });
      await loadPets();
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      showStatus(`No se pudo actualizar la mascota: ${error.message}`, "error");
    }
    return;
  }

  if (!actionBtn) return;
  const action = actionBtn.dataset.action;

  if (action === "delete") {
    if (!confirm("¿Eliminar esta mascota?")) return;
    try {
      await deletePet(id);
      await loadPets();
    } catch (error) {
      showStatus(`No se pudo eliminar la mascota: ${error.message}`, "error");
    }
  }

  if (action === "edit") {
    const mascota = mascotas.find((m) => m._id === id);
    if (mascota) openEditModal(mascota);
  }
}

pendingList.addEventListener("click", handleListClick);
doneList.addEventListener("click", handleListClick);

function openEditModal(mascota) {
  editIdInput.value = mascota._id;
  editNombreInput.value = mascota.nombre;
  editEspecieInput.value = mascota.especie;
  editRazaInput.value = mascota.raza;
  editEdadInput.value = mascota.edad;
  editModal.hidden = false;
  editNombreInput.focus();
}

function closeEditModal() {
  editModal.hidden = true;
  editForm.reset();
}

editModal.querySelectorAll("[data-close-modal]").forEach((el) => {
  el.addEventListener("click", closeEditModal);
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = editIdInput.value;
  const changes = {
    nombre: editNombreInput.value.trim(),
    especie: editEspecieInput.value.trim(),
    raza: editRazaInput.value.trim(),
    edad: parseInt(editEdadInput.value, 10),
  };
  if (!changes.nombre || !changes.especie || !changes.raza || Number.isNaN(changes.edad)) return;

  try {
    await updatePet(id, changes);
    closeEditModal();
    await loadPets();
  } catch (error) {
    showStatus(`No se pudo editar la mascota: ${error.message}`, "error");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !editModal.hidden) closeEditModal();
});

loadPets();
