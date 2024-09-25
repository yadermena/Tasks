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

  li.appendChild(p);
  li.appendChild(addDeleteBtn(task._id));
  ul.appendChild(li);
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

// Cargar tareas existentes
async function getTasks() {
  const response = await fetch('http://localhost:5000/api/tasks');
  const tasks = await response.json();

  if (tasks.length > 0) {
    tasks.forEach((task) => addTaskToDOM(task));
    empty.style.display = "none";
  }
}
