require('dotenv').config();

const Task = require('./models/task');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ydrmena27:yader1989@cluster0.neh7d.mongodb.net/taskdb?appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('¡Conectado a MongoDB con éxito!');
  })
  .catch((error) => {
    console.error('Error al conectar a MongoDB:', error);
  });

// --- RUTAS DE LA API ---

// 1. Obtener solo tareas activas (que no hayan sido anuladas/eliminadas)
// En server.js
app.get('/api/tasks', async (req, res) => {
  try {
    // $ne: true trae las tareas que son false O las que no tienen el campo aún
    const tasks = await Task.find({ isDeleted: { $ne: true } }); 
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener las tareas', error: error.message });
  }
});

// 2. Crear una nueva tarea
app.post('/api/tasks', async (req, res) => {
  try {
    const newTask = new Task({
      name: req.body.name
    });
    await newTask.save();
    res.json(newTask);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la tarea', error: error.message });
  }
});

// 3. Actualizar el estado o realizar eliminación lógica (Anulado)
app.put('/api/tasks/:id/status', async (req, res) => {
  try {
    const { status, completed, isDeleted } = req.body;

    const isCompleted = status === 'completada' || (completed && status !== 'anular');

    const updateData = {
      status,
      completed: isCompleted,
      completedAt: isCompleted ? new Date() : null
    };

    // Si desde el frontend se envía isDeleted: true (botón Anulado)
    if (typeof isDeleted !== 'undefined') {
      updateData.isDeleted = isDeleted;
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar la tarea', error: error.message });
  }
});

// 4. Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});