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
app.get('/api/tasks', async (req, res) => {
  try {
    const filter = req.query.includeDeleted === 'true' ? {} : { isDeleted: { $ne: true } };
    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener las tareas', error: error.message });
  }
});

// 2. Crear nueva tarea
app.post('/api/tasks', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre de la tarea es obligatorio' });
    }

    const task = new Task({ name: name.trim() });
    const createdTask = await task.save();
    res.status(201).json(createdTask);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la tarea', error: error.message });
  }
});

// 3. Actualizar estado o realizar eliminación lógica (eliminado)
app.put('/api/tasks/:id/status', async (req, res) => {
  try {
    const existingTask = await Task.findById(req.params.id);
    if (!existingTask) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }

    if (existingTask.completed === false && existingTask.status !== 'ejecutando') {
      return res.status(403).json({ message: 'No se puede cambiar el estado cuando completed es false' });
    }

    const { status, completed, isDeleted } = req.body;

    if (isDeleted === true) {
      if (existingTask.isDeleted) {
        return res.status(403).json({ message: 'La tarea ya fue eliminada' });
      }
      if (existingTask.completed !== true) {
        return res.status(403).json({ message: 'Solo se puede eliminar una tarea completada' });
      }

      const updateData = {
        status: 'completada',
        completed: true,
        completedAt: existingTask.completedAt || new Date(),
        isDeleted: true
      };

      const updatedTask = await Task.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedTask) {
        return res.status(404).json({ message: 'Tarea no encontrada' });
      }

      return res.json(updatedTask);
    }

    if (existingTask.status === 'ejecutando' && status === 'acumulada') {
      return res.status(403).json({ message: 'No se puede cambiar una tarea ejecutando a acumulada' });
    }

    if (existingTask.status === 'completada' && status === 'acumulada') {
      return res.status(403).json({ message: 'No se puede cambiar una tarea completada a acumulada' });
    }

    let updateStatus = status || existingTask.status;
    const isCompleted = updateStatus === 'completada' || (completed && updateStatus !== 'anular');

    const updateData = {
      status: updateStatus,
      completed: isCompleted,
      completedAt: isCompleted ? new Date() : null
    };

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

// 4. Eliminar lógicamente una tarea completada
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const existingTask = await Task.findById(req.params.id);
    if (!existingTask) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }

    if (existingTask.isDeleted) {
      return res.status(403).json({ message: 'La tarea ya fue eliminada' });
    }

    if (existingTask.completed !== true) {
      return res.status(403).json({ message: 'Solo se puede eliminar una tarea completada' });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      {
        status: 'completada',
        completed: true,
        completedAt: existingTask.completedAt || new Date(),
        isDeleted: true
      },
      { new: true, runValidators: true }
    );

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar la tarea', error: error.message });
  }
});

// 5. Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});