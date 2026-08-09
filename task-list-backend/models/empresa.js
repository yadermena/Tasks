const mongoose = require('mongoose');

const empresaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  rubro: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Empresa = mongoose.model('Empresa', empresaSchema);

module.exports = Empresa;