const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Iniciar la aplicación Express
const app = express();

// Middleware para manejar JSON y CORS
app.use(cors());
app.use(express.json());

// Conectar a MongoDB (usa tu cadena de conexión de MongoDB local o Atlas)
mongoose.connect('mongodb://localhost:27017/taskdb', 
  {}).then(() => {
  console.log('Conectado a MongoDB');
}).catch((error) => {
  console.error('Error al conectar a MongoDB:', error);
});

// Definir el esquema y modelo de Tarea
// Definir el esquema y modelo de Tarea
const taskSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  status: { // Nuevo campo para el estado de la tarea
    type: String,
    enum: ['completada', 'ejecutando', 'acumulada', 'false'], // Estados posibles
    default: 'false'
  },
  date: {
    type: Date,
    default: Date.now
  }
});


const Task = mongoose.model('Task', taskSchema);


// Rutas API

// Obtener todas las tareas
app.get('/api/tasks', async (req, res) => {
  const tasks = await Task.find();
  res.json(tasks);
});

// Agregar una nueva tarea
app.post('/api/tasks', async (req, res) => {
  const newTask = new Task({
    name: req.body.name
  });
  await newTask.save();
  res.json(newTask);
});

// Actualizar el estado de una tarea
app.put('/api/tasks/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, completed } = req.body; // Recibe el nuevo estado y si está completada

  const updatedTask = await Task.findByIdAndUpdate(id, { status, completed }, { new: true });
  res.json(updatedTask);
});


// Eliminar una tarea
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  await Task.findByIdAndDelete(id);
  res.json({ message: 'Tarea eliminada' });
});

// Actualizar el estado de una tarea
async function updateTaskStatus(id, status) {
  try {
    const response = await fetch(`http://localhost:5000/api/tasks/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status })
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


// Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
