const mongoose = require('mongoose');

// Este sub-esquema define los permisos que puede tener un rol.
const permissionSchema = new mongoose.Schema({
  canDelete: { type: Boolean, default: false },
  canEditProfile: { type: Boolean, default: false },
  canEditTask: { type: Boolean, default: false },
  canSetExecuting: { type: Boolean, default: false },
  canSetCompleted: { type: Boolean, default: false },
  canRestoreTask: { type: Boolean, default: false },
  // Aquí se pueden añadir más permisos en el futuro
}, { _id: false });

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    enum: ['admin', 'editor', 'viewer']
  },
  permissions: {
    type: permissionSchema,
    required: true,
    default: () => ({})
  }
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);