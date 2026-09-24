const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: { type: String, required: true, trim: true },
  status: { 
    type: String, 
    enum: ['completada', 'ejecutando', 'acumulada'], 
    default: 'ejecutando' 
  },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  timerMinutes: { type: Number, min: 1, default: null },
  timerEndsAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false } // <-- Necesario para el borrado lógico
}, { 
  timestamps: true,
  versionKey: false 
});

module.exports = mongoose.model('Task', taskSchema);