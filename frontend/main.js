const input = document.querySelector("input");
const addBtn = document.querySelector(".btn-add");
const ul = document.querySelector("ul");
const empty = document.querySelector(".empty");
const searchBtn = document.querySelector(".btn-search");

document.addEventListener("DOMContentLoaded", getTasks);

// ==========================================
// EVENTOS PRINCIPALES
// ==========================================

// 1. Agregar tarea
addBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  const text = input.value.trim();

  if (text !== "") {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: text }),
      });

      const newTask = await response.json();

      addTaskToDOM(newTask);
      input.value = "";
      empty.style.display = "none";
    } catch (error) {
      console.error("Error al crear la tarea:", error);
    }
  }
});

// 2. Buscar al hacer clic en el botón "Buscar"
searchBtn.addEventListener("click", () => {
  const query = input.value.trim().toLowerCase();
  filterTasks(query);
});

// 3. Filtrar dinámicamente mientras escribe
input.addEventListener("input", () => {
  const query = input.value.trim().toLowerCase();
  filterTasks(query);
});

// ==========================================
// FUNCIONES DE INTERFAZ (DOM)
// ==========================================

function addTaskToDOM(task) {
  const li = document.createElement("li");
  const p = document.createElement("p");
  p.textContent = task.name;

  // Crear botones de estado
  const btnGreen = document.createElement("button");
  btnGreen.textContent = "Completada";
  btnGreen.className = "btn-green";
  btnGreen.style.backgroundColor = 'lightgray';

  const btnYellow = document.createElement("button");
  btnYellow.textContent = "Ejecutando";
  btnYellow.className = "btn-yellow";
  btnYellow.style.backgroundColor = 'lightgray';

  const btnRed = document.createElement("button");
  btnRed.textContent = "Acumulada";
  btnRed.className = "btn-red";
  btnRed.style.backgroundColor = 'lightgray';

  // Botón Anular
  const btnAnulado = document.createElement("button");
  btnAnulado.textContent = "Anular";
  btnAnulado.className = "btn-anulado";
  btnAnulado.style.backgroundColor = 'lightgray';

  const allButtons = [btnGreen, btnYellow, btnRed, btnAnulado];

  // Asignar colores iniciales según el estado en MongoDB
  if (task.status === 'completada') {
    btnGreen.style.backgroundColor = 'green';
  } else if (task.status === 'ejecutando') {
    btnYellow.style.backgroundColor = 'yellow';
  } else if (task.status === 'acumulada') {
    btnRed.style.backgroundColor = 'red';
  } else if (task.status === 'anulado') {
    btnAnulado.style.backgroundColor = 'gray';
  }

  // Eventos de botones
  btnGreen.addEventListener("click", async () => {
    await updateTaskStatus(task._id, 'completada', true);
    resetAndHighlight(allButtons, btnGreen, 'green');
  });

  btnYellow.addEventListener("click", async () => {
    await updateTaskStatus(task._id, 'ejecutando');
    resetAndHighlight(allButtons, btnYellow, 'yellow');
  });

  btnRed.addEventListener("click", async () => {
    await updateTaskStatus(task._id, 'acumulada');
    resetAndHighlight(allButtons, btnRed, 'red');
  });

  // Evento para el botón Anular (borrado lógico)
  btnAnulado.addEventListener("click", async () => {
    await updateTaskStatus(task._id, 'anulado', false, true);

    // Eliminar el elemento visual de la pantalla
    li.remove();

    const items = document.querySelectorAll("li");
    if (items.length === 0) {
      empty.style.display = "block";
      empty.querySelector("p").textContent = "No tienes tareas pendientes.";
    }
  });

  // Ensamblar elementos dentro del <li>
  li.appendChild(p);
  li.appendChild(btnGreen);
  li.appendChild(btnYellow);
  li.appendChild(btnRed);
  li.appendChild(btnAnulado);

  ul.appendChild(li);
}

// Función auxiliar para pintar solo el botón activo
function resetAndHighlight(buttonsList, activeButton, activeColor) {
  buttonsList.forEach(btn => {
    btn.style.backgroundColor = 'lightgray';
  });
  activeButton.style.backgroundColor = activeColor;
}

// Función para filtrar tareas en pantalla
function filterTasks(query) {
  const items = ul.querySelectorAll("li");
  let hasVisibleTasks = false;

  items.forEach((item) => {
    const taskName = item.querySelector("p").textContent.toLowerCase();

    if (taskName.includes(query)) {
      item.style.display = "flex";
      hasVisibleTasks = true;
    } else {
      item.style.display = "none";
    }
  });

  if (!hasVisibleTasks && items.length > 0) {
    empty.style.display = "block";
    empty.querySelector("p").textContent = "No se encontraron tareas que coincidan.";
  } else if (items.length > 0) {
    empty.style.display = "none";
    empty.querySelector("p").textContent = "No tienes tareas pendientes.";
  }
}

// ==========================================
// PETICIONES API (BACKEND)
// ==========================================

async function updateTaskStatus(id, status, completed = false, isDeleted = false) {
  try {
    const response = await fetch(`http://127.0.0.1:5000/api/tasks/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, completed, isDeleted })
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const updatedTask = await response.json();
    console.log('Tarea actualizada en BD:', updatedTask);
  } catch (error) {
    console.error('Hubo un problema al actualizar la tarea:', error);
  }
}

async function getTasks() {
  try {
    const response = await fetch('http://127.0.0.1:5000/api/tasks');
    const tasks = await response.json();

    if (tasks.length > 0) {
      ul.innerHTML = ""; // Limpiar lista
      tasks.forEach((task) => addTaskToDOM(task));
      empty.style.display = "none";
    } else {
      empty.style.display = "block";
    }
  } catch (error) {
    console.error("Error al cargar tareas:", error);
  }
}