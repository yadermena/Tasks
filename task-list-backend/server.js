// OBLIGATORIO: Debe ser la primera línea del archivo
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Iniciar la aplicación Express
const app = express();

// Middleware para manejar JSON y CORS
app.use(cors());
app.use(express.json());

// Conectar a MongoDB usando la variable de entorno o la URI directa fija
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ydrmena27:yader1989@cluster0.neh7d.mongodb.net/taskdb?appName=Cluster0';
mongoose.connect(MONGO_URI)
.then(() => {
  console.log('¡Conectado a MongoDB con éxito!');
}).catch((error) => {
  console.error('Error al conectar a MongoDB:', error);
});

// Definir el esquema y modelo de Tarea
const taskSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  completed: {
    type: Boolean,
    default: false
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

// Eliminar una tarea
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  await Task.findByIdAndDelete(id);
  res.json({ message: 'Tarea eliminada' });
});

// Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening in the port ${PORT}`);
});
