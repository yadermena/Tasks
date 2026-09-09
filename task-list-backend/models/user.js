const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['admin', 'editor', 'viewer'],
    default: 'viewer'
  },
  password: {
    type: String,
    required: false, // Only required for admins, handled in app logic
  },
  salt: {
    type: String,
  },
  canDelete: {
    type: Boolean,
    default: false
  },
  canEditProfile: {
    type: Boolean,
    default: false
  },
  canEditTask: {
    type: Boolean,
    default: false
  },
  canSetExecuting: {
    type: Boolean,
    default: false
  },
  canSetCompleted: {
    type: Boolean,
    default: false
  },
  canRestoreTask: {
    type: Boolean,
    default: false
  },
  companies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Empresa'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});


const User = mongoose.model('User', userSchema);

module.exports = User;