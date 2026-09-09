require('dotenv').config();

const Task = require('./models/task');
const Role = require('./models/role');
const User = require('./models/user');
const Empresa = require('./models/empresa');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ydrmena27:yader1989@cluster0.neh7d.mongodb.net/taskdb?appName=Cluster0';

// Helper functions for password hashing
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('¡Conectado a MongoDB con éxito!');
    seedRoles();
  })
  .catch((error) => {
    console.error('Error al conectar a MongoDB:', error);
  });

async function seedRoles() {
  try {
    const roles = [
      { name: 'admin', permissions: { canDelete: true, canEditProfile: true, canEditTask: true, canSetExecuting: true, canSetCompleted: true, canRestoreTask: true } },
      { name: 'editor', permissions: { canDelete: false, canEditProfile: true, canEditTask: true, canSetExecuting: true, canSetCompleted: false, canRestoreTask: false } },
      { name: 'viewer', permissions: { canDelete: false, canEditProfile: false, canEditTask: false, canSetExecuting: false, canSetCompleted: false, canRestoreTask: false } }
    ];

    for (const roleData of roles) {
      // Crea el rol si no existe, o lo actualiza si los permisos han cambiado en el código.
      await Role.updateOne({ name: roleData.name }, { $set: roleData }, { upsert: true });
    }
    console.log('Roles inicializados/verificados con éxito.');
  } catch (error) {
    console.error('Error al inicializar los roles:', error);
  }
}

// --- RUTAS DE LA API ---

// Vista pública de tareas activas para compartirlas con otros usuarios.
app.get('/api/tasks/public/:userId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: 'ID de usuario inválido' });
    }

    const user = await User.findById(req.params.userId).select('name');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const tasks = await Task.find({
      userId: req.params.userId,
      isDeleted: { $ne: true }
    })
      .populate('userId', 'name')
      .sort({ createdAt: -1 });

    res.json({ userName: user.name, tasks });
  } catch (error) {
    console.error('Error al obtener las tareas públicas:', error);
    res.status(500).json({ message: 'Error al obtener las tareas públicas' });
  }
});

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
    const requestorId = req.headers['x-user-id'];
    const requestorRole = req.headers['x-user-role'];
    if (!requestorId) {
      return res.status(401).json({ message: 'No se proporcionó el ID de usuario' });
    }

    const { name, status, userId: assignedUserId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre de la tarea es obligatorio' });
    }
    if (status && !['completada', 'ejecutando', 'acumulada'].includes(status)) {
      return res.status(400).json({ message: 'Estado no válido' });
    }

    let taskOwnerId = requestorId;
    // Only an admin can create a task for another user.
    if (requestorRole === 'admin' && assignedUserId) {
      taskOwnerId = assignedUserId;
    }

    const taskData = { name: name.trim(), userId: taskOwnerId, status: status || 'ejecutando' };

    const task = new Task(taskData);
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
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    const userCanEdit = req.headers['x-user-can-edit-task'] === 'true';
    const { status } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }

    if (userRole !== 'admin') {
      if (!userCanEdit) {
        return res.status(403).json({ message: 'No tiene permiso para editar el estado de la tarea.' });
      }
    }

    if (task.status === 'completada' && userRole !== 'admin') {
      return res.status(403).json({ message: 'Las tareas completadas no se pueden modificar.' });
    }

    if (userRole !== 'admin' && status === 'ejecutando' && req.headers['x-user-can-set-executing'] !== 'true') {
      return res.status(403).json({ message: 'No tiene permiso para cambiar la tarea a ejecución.' });
    }
    if (userRole !== 'admin' && status === 'completada' && req.headers['x-user-can-set-completed'] !== 'true') {
      return res.status(403).json({ message: 'No tiene permiso para completar la tarea.' });
    }

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

// 3.5. Actualizar tarea (nombre o estado)
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'];
    const userCanEdit = req.headers['x-user-can-edit-task'] === 'true';
    const { name, status, userId: assignedUserId } = req.body;

    // Only admins or users with canEditTask permission can edit tasks
    if (userRole !== 'admin' && !userCanEdit) {
      return res.status(403).json({ message: 'No tiene permiso para editar tareas.' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }

    if (task.status === 'completada' && userRole !== 'admin') {
      return res.status(403).json({ message: 'Las tareas completadas no se pueden editar.' });
    }

    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ message: 'El nombre de la tarea es obligatorio' });
    }
    if (status !== undefined && !['completada', 'ejecutando', 'acumulada'].includes(status)) {
      return res.status(400).json({ message: 'Estado no válido' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (status !== undefined) updateData.status = status;
    if (userRole === 'admin' && assignedUserId) {
      updateData.userId = assignedUserId;
    }

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

    // Only admins or users with the specific permission can delete tasks.
    if (userRole !== 'admin' && !userCanDelete) {
      return res.status(403).json({ message: 'No tiene permiso para eliminar esta tarea.' });
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
    const userCanRestore = req.headers['x-user-can-restore'] === 'true';
    if (userRole !== 'admin' && !userCanRestore) {
      return res.status(403).json({ message: 'No tiene permiso para restaurar tareas.' });
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
    const users = await User.find().populate('companies', 'name').sort({ createdAt: -1 });
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
    const { name, email, role, password, companyIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre es obligatorio' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'El correo es obligatorio' });
    }

    if (!password || !password.trim()) {
      return res.status(400).json({ message: 'La clave es obligatoria' });
    }

    const roleDoc = await Role.findOne({ name: role || 'viewer' });
    if (!roleDoc) {
      return res.status(400).json({ message: `El rol '${role}' no es válido.` });
    }

    const salt = generateSalt();
    const hashedPassword = hashPassword(password, salt);

    const user = new User({
      name: name.trim(),
      email: email.trim(),
      role: role || 'viewer',
      password: hashedPassword,
      salt: salt,
      // Se asegura que no haya IDs de empresa duplicados para el mismo usuario.
      companies: [...new Set(companyIds || [])],
      ...roleDoc.permissions.toObject() // Asigna los permisos por defecto del rol
    });

    const createdUser = await user.save();
    const populatedUser = await User.findById(createdUser._id)
      .populate('companies', 'name')
      .select('-password -salt');

    res.status(201).json(populatedUser);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: `El correo '${req.body.email}' ya existe.` });
    }
    console.error('Error al crear el usuario:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al crear el usuario', ...errorMessage });
  }
});

// 7. Actualizar usuario
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, email, role, password, companyIds, canDelete, canEditProfile, canEditTask, canSetExecuting, canSetCompleted, canRestoreTask } = req.body;
    const updateData = {};

    const userId = req.params.id;
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const requestorId = req.headers['x-user-id'];
    const requestorRole = req.headers['x-user-role'];
    const permissionFields = { canDelete, canEditProfile, canEditTask, canSetExecuting, canSetCompleted, canRestoreTask };
    if (Object.values(permissionFields).some(value => value !== undefined) && requestorRole !== 'admin') {
      return res.status(403).json({ message: 'Solo los administradores pueden administrar permisos.' });
    }
    if (requestorId === req.params.id && currentUser.role !== 'admin' && !currentUser.canEditProfile) {
      return res.status(403).json({ message: 'No tiene permiso para editar su perfil.' });
    }

    // Explicitly build the update object to control which fields can be updated
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.trim();

    // Handle role change and associated permissions
    if (role !== undefined) {
      // If the role is actually changing
      if (currentUser.role !== role) {
        // Validation: Prevent changing an admin's role if it would leave 2 or fewer admins
        if (currentUser.role === 'admin' && role !== 'admin') {
          const adminCount = await User.countDocuments({ role: 'admin' });
          if (adminCount <= 2) { // If there are 2 or fewer admins, prevent demotion
            return res.status(403).json({ message: 'No se puede cambiar el rol de administrador si quedan 2 o menos administradores.' });
          }
        }
        // Fetch permissions for the new role
        const roleDoc = await Role.findOne({ name: role });
        if (!roleDoc) {
          return res.status(400).json({ message: `El rol '${role}' no es válido.` });
        }
        updateData.role = role;
        // Apply default permissions from the new role
        Object.assign(updateData, roleDoc.permissions.toObject());
      } else {
        // Role is not changing, but we still include it in updateData for consistency
        updateData.role = role;
      }
    }

    // Individual permission overrides (if provided, they take precedence over role defaults)
    if (canDelete !== undefined) updateData.canDelete = canDelete;
    if (canEditProfile !== undefined) updateData.canEditProfile = canEditProfile;
    if (canEditTask !== undefined) updateData.canEditTask = canEditTask;
    if (canSetExecuting !== undefined) updateData.canSetExecuting = canSetExecuting;
    if (canSetCompleted !== undefined) updateData.canSetCompleted = canSetCompleted;
    if (canRestoreTask !== undefined) updateData.canRestoreTask = canRestoreTask;

    // If a new password is provided, hash it.
    if (password && password.trim() !== '') {
      updateData.salt = generateSalt();
      updateData.password = hashPassword(password, updateData.salt);
    }
    if (req.body.hasOwnProperty('companyIds')) {
      // Se asegura que no haya IDs de empresa duplicados para el mismo usuario.
      const companyIds = req.body.companyIds || [];
      updateData.companies = [...new Set(companyIds)];
    }

    // Ensure updateData is not empty before attempting to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No se proporcionaron datos para actualizar.' });
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    })
      .populate('companies', 'name')
      .select('-password -salt'); // Do not return password or salt

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(updatedUser);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: `El correo '${req.body.email}' ya existe.` });
    }
    console.error('Error al actualizar el usuario:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al actualizar el usuario', ...errorMessage });
  }
});

// 8. Eliminar usuario
app.delete('/api/users/:id', async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Validation: Prevent deleting an admin if it would leave 3 or fewer admins
    if (userToDelete.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 3) {
        return res.status(403).json({ message: 'No se puede eliminar el administrador. Debe haber más de 3 administradores.' });
      }
    }

    await userToDelete.deleteOne();

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar el usuario:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al eliminar el usuario', ...errorMessage });
  }
});

// --- AUTH ROUTES ---

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email y clave son requeridos' });
    }

    // Find user by email but don't exclude password from this specific query
    const user = await User.findOne({ email }).select('+password +salt');

    if (!user || !user.salt) {
      return res.status(401).json({ message: 'Usuario o clave incorrecta' });
    }

    const hashedPassword = hashPassword(password, user.salt);

    if (user.password !== hashedPassword) {
      return res.status(401).json({ message: 'Usuario o clave incorrecta' });
    }

    // Now that user is authenticated, populate and remove sensitive fields
    await user.populate({ path: 'companies', select: 'name' });
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.salt;
    res.json(userObject);
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Error en el servidor durante el inicio de sesión' });
  }
});

// --- RUTAS DE EMPRESAS ---

// Obtener empresas
app.get('/api/empresas', async (req, res) => {
  try {
    // 1. Fetch all companies and convert to plain objects
    const empresas = await Empresa.find().sort({ createdAt: -1 }).lean();

    // 2. Fetch all users that have at least one company assigned
    const usersWithCompanies = await User.find({ 'companies.0': { $exists: true } })
      .select('name companies')
      .lean();

    // 3. Create a map of companyId -> user.name
    const companyToUserMap = new Map();
    for (const user of usersWithCompanies) {
      for (const companyId of user.companies) {
        companyToUserMap.set(companyId.toString(), user.name);
      }
    }

    // 4. Augment companies with user information
    const augmentedEmpresas = empresas.map(empresa => ({
      ...empresa,
      assignedUser: companyToUserMap.get(empresa._id.toString()) || null,
    }));

    res.json(augmentedEmpresas);
  } catch (error) {
    console.error('Error al obtener las empresas:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al obtener las empresas', ...errorMessage });
  }
});

// Crear empresa
app.post('/api/empresas', async (req, res) => {
  try {
    const { name, rubro } = req.body;
    if (!name || !name.trim() || !rubro || !rubro.trim()) {
      return res.status(400).json({ message: 'Nombre y Rubro son obligatorios' });
    }
    const empresa = new Empresa({ name: name.trim(), rubro: rubro.trim() });
    const createdEmpresa = await empresa.save();

    // Convertir a objeto plano y añadir 'assignedUser' para consistencia con GET /api/empresas
    const empresaObject = createdEmpresa.toObject();
    empresaObject.assignedUser = null;

    res.status(201).json(empresaObject);
  } catch (error) {
    console.error('Error al crear la empresa:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al crear la empresa', ...errorMessage });
  }
});

// Actualizar empresa
app.put('/api/empresas/:id', async (req, res) => {
  try {
    const { name, rubro } = req.body;
    if (!name || !name.trim() || !rubro || !rubro.trim()) {
      return res.status(400).json({ message: 'Nombre y Rubro son obligatorios' });
    }
    const updateData = { name: name.trim(), rubro: rubro.trim() };

    const updatedEmpresa = await Empresa.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedEmpresa) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    // Buscar el usuario asignado para devolver un objeto consistente
    const assignedUser = await User.findOne({ companies: updatedEmpresa._id }).select('name').lean();
    const empresaObject = updatedEmpresa.toObject();
    empresaObject.assignedUser = assignedUser ? assignedUser.name : null;

    res.json(empresaObject);
  } catch (error) {
    console.error('Error al actualizar la empresa:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al actualizar la empresa', ...errorMessage });
  }
});

// Eliminar empresa
app.delete('/api/empresas/:id', async (req, res) => {
  try {
    const deletedEmpresa = await Empresa.findByIdAndDelete(req.params.id);
    if (!deletedEmpresa) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }
    res.json({ message: 'Empresa eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar la empresa:', error);
    const errorMessage = process.env.NODE_ENV === 'production' ? {} : { error: error.message };
    res.status(500).json({ message: 'Error al eliminar la empresa', ...errorMessage });
  }
});

// 9. Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});