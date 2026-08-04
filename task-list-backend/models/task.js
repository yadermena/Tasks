const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  status: { 
    type: String, 
    enum: ['completada', 'ejecutando', 'acumulada'], 
    default: 'ejecutando' 
  },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false } // <-- Necesario para el borrado lógico
}, { 
  timestamps: true,
  versionKey: false 
});

module.exports = mongoose.model('Task', taskSchema);