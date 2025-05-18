/**
 * Archivo central para cargar todos los modelos y establecer sus relaciones
 */

const Documento = require('./Documento');
const Matrizador = require('./Matrizador');
const EventoDocumento = require('./EventoDocumento');

// Relaciones entre modelos

// Relación Matrizador - Documento (Un matrizador puede tener muchos documentos)
Matrizador.hasMany(Documento, { 
  foreignKey: 'idMatrizador',
  as: 'documentos'
});
Documento.belongsTo(Matrizador, {
  foreignKey: 'idMatrizador',
  as: 'matrizador'
});

// Relación Documento - EventoDocumento (Un documento puede tener muchos eventos)
Documento.hasMany(EventoDocumento, { 
  foreignKey: 'idDocumento',
  as: 'eventos'
});
EventoDocumento.belongsTo(Documento, {
  foreignKey: 'idDocumento',
  as: 'documento'
});

module.exports = {
  Documento,
  Matrizador,
  EventoDocumento
}; 