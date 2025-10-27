const input = document.querySelector("input");
const addBtn = document.querySelector(".btn-add");
const ul = document.querySelector("ul");
const empty = document.querySelector(".empty");

document.addEventListener("DOMContentLoaded", getTasks);

addBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  const text = input.value;

  if (text !== "") {
    const response = await fetch('http://localhost:5000/api/tasks', {
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
  }
});

function addTaskToDOM(task) {
  const li = document.createElement("li");
  const p = document.createElement("p");
  p.textContent = task.name;

  // Crear botones de semáforo
  const btnGreen = document.createElement("button");
  btnGreen.textContent = "Completada";
  btnGreen.className = "btn-green";
  btnGreen.style.backgroundColor = 'lightgray';  // Color inicial
  
  const btnYellow = document.createElement("button");
  btnYellow.textContent = "Ejecutando";
  btnYellow.className = "btn-yellow";
  btnYellow.style.backgroundColor = 'lightgray';  // Color inicial
  
  const btnRed = document.createElement("button");
  btnRed.textContent = "Acumulada";
  btnRed.className = "btn-red";
  btnRed.style.backgroundColor = 'lightgray';  // Color inicial

  // Asignar colores según estado actual al cargar la tarea
  if (task.status === 'completada') {
    btnGreen.style.backgroundColor = 'green';
  } else if (task.status === 'ejecutando') {
    btnYellow.style.backgroundColor = 'yellow';
  } else if (task.status === 'acumulada') {
    btnRed.style.backgroundColor = 'red';
  }

  // Eventos para actualizar el estado y cambiar apariencia de botones
  btnGreen.addEventListener("click", async () => {
    await updateTaskStatus(task._id, 'completada', true);
    setButtonStatus(btnGreen, btnYellow, btnRed, 'green', 'lightgray', 'lightgray');
  });

  btnYellow.addEventListener("click", async () => {
    await updateTaskStatus(task._id, 'ejecutando');
    setButtonStatus(btnYellow, btnGreen, btnRed, 'yellow', 'lightgray', 'lightgray');
  });

  btnRed.addEventListener("click", async () => {
    await updateTaskStatus(task._id, 'acumulada');
    setButtonStatus(btnRed, btnGreen, btnYellow, 'red', 'lightgray', 'lightgray');
  });

  // Agregar botones al li
  li.appendChild(p);
  li.appendChild(btnGreen);
  li.appendChild(btnYellow);
  li.appendChild(btnRed);
  li.appendChild(addDeleteBtn(task._id));

  ul.appendChild(li);
}


function setButtonStatus(activeBtn, btn1, btn2, activeColor, color1, color2) {
  // Cambiar color del botón activo
  activeBtn.style.backgroundColor = activeColor;

  // Cambiar color de los otros botones
  btn1.style.backgroundColor = color1;
  btn2.style.backgroundColor = color2;
}

function addDeleteBtn(id) {
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "X";
  deleteBtn.className = "btn-delete";

  deleteBtn.addEventListener("click", async (e) => {
    const item = e.target.parentElement;
    await fetch(`http://localhost:5000/api/tasks/${id}`, { method: 'DELETE' });
    ul.removeChild(item);

    const items = document.querySelectorAll("li");
    if (items.length === 0) {
      empty.style.display = "block";
    }
  });

  return deleteBtn;
}

async function updateTaskStatus(id, status, completed = false) {
  try {
    const response = await fetch(`http://localhost:5000/api/tasks/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, completed })
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const updatedTask = await response.json();
    console.log(`Estado de la tarea actualizado a: ${updatedTask.status}`);
  } catch (error) {
    console.error('Hubo un problema al actualizar el estado:', error);
  }
}


// Cargar tareas existentes
async function getTasks() {
  const response = await fetch('http://localhost:5000/api/tasks');
  const tasks = await response.json();

  if (tasks.length > 0) {
    tasks.forEach((task) => addTaskToDOM(task));
    empty.style.display = "none";
  }
}
