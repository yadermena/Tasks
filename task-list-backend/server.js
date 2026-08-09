require('dotenv').config();

const Task = require('./models/task');
const User = require('./models/user');
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
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    if (!userId) {
      return res.status(401).json({ message: 'No se proporcionó el ID de usuario' });
    }

    // Si el rol es admin, no filtramos por usuario para obtener todas las tareas.
    const baseFilter = userRole === 'admin' ? {} : { userId: userId };
    const deletedFilter = req.query.includeDeleted === 'true' ? {} : { isDeleted: { $ne: true } };
    const tasks = await Task.find({ ...baseFilter, ...deletedFilter })
      .populate('userId', 'name') // Añadimos el nombre del usuario a cada tarea
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error al obtener las tareas:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al obtener las tareas', ...errorMessage });
  }
});

// 2. Crear nueva tarea
app.post('/api/tasks', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ message: 'No se proporcionó el ID de usuario' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre de la tarea es obligatorio' });
    }

    const task = new Task({ name: name.trim(), userId: userId });
    const savedTask = await task.save();
    const populatedTask = await Task.findById(savedTask._id).populate('userId', 'name');
    res.status(201).json(populatedTask);
  } catch (error) {
    console.error('Error al crear la tarea:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al crear la tarea', ...errorMessage });
  }
});

// 3. Actualizar estado o realizar eliminación lógica (eliminado)
app.put('/api/tasks/:id/status', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'];
    const { status } = req.body;
    if (!['completada', 'ejecutando', 'acumulada'].includes(status)) {
      return res.status(400).json({ message: 'Estado no válido' });
    }

    const isCompleted = status === 'completada';

    const updateData = {
      status: status,
      completed: isCompleted,
      completedAt: isCompleted ? new Date() : null,
    };

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'name');

    if (!updatedTask) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Error al actualizar la tarea:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al actualizar la tarea', ...errorMessage });
  }
});

// 4. Eliminar lógicamente una tarea completada
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'];
    const userCanDelete = req.headers['x-user-can-delete'] === 'true';
    const existingTask = await Task.findById(req.params.id);
    if (!existingTask) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }

    if (existingTask.isDeleted) {
      return res.status(403).json({ message: 'La tarea ya fue eliminada' });
    }

    // Admin can delete any task. Users with canDelete can delete any of their tasks. Others can only delete completed tasks.
    if (userRole !== 'admin' && !userCanDelete && existingTask.completed !== true) {
      return res.status(403).json({ message: 'Solo se puede eliminar una tarea completada o tener el permiso para eliminar' });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true, runValidators: true }
    ).populate('userId', 'name');

    res.json(updatedTask);
  } catch (error) {
    console.error('Error al eliminar la tarea:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al eliminar la tarea', ...errorMessage });
  }
});

// 4.5. Restaurar una tarea eliminada (solo admin)
app.post('/api/tasks/:id/restore', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'];
    if (userRole !== 'admin') {
      return res.status(403).json({ message: 'Acción no permitida. Solo los administradores pueden restaurar tareas.' });
    }

    // Validar que el ID sea un ObjectId válido de Mongoose
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'ID de tarea inválido.' });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      {
        isDeleted: false,
        status: 'ejecutando',
        completed: false,
        completedAt: null
      },
      { new: true, runValidators: true }
    ).populate('userId', 'name');

    if (!updatedTask) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Error al restaurar la tarea:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al restaurar la tarea', ...errorMessage });
  }
});

// 5. Obtener usuarios
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Error al obtener los usuarios:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al obtener los usuarios', ...errorMessage });
  }
});

// 6. Crear usuario
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre es obligatorio' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'El correo es obligatorio' });
    }

    const user = new User({
      name: name.trim(),
      email: email.trim(),
      role: role || 'viewer'
    });

    const createdUser = await user.save();
    res.status(201).json(createdUser);
  } catch (error) {
    console.error('Error al crear el usuario:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al crear el usuario', ...errorMessage });
  }
});

// 7. Actualizar usuario
app.put('/api/users/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Error al actualizar el usuario:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al actualizar el usuario', ...errorMessage });
  }
});

// 8. Eliminar usuario
app.delete('/api/users/:id', async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar el usuario:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al eliminar el usuario', ...errorMessage });
  }
});

// 9. Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});