/**
 * Archivo central para cargar todos los modelos y establecer sus relaciones
 */

const Documento = require('./Documento');
const Matrizador = require('./Matrizador');
const EventoDocumento = require('./EventoDocumento');
const RegistroAuditoria = require('./RegistroAuditoria');
const DocumentoRelacion = require('./DocumentoRelacion');

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

// Relación Documento - RegistroAuditoria
Documento.hasMany(RegistroAuditoria, {
  foreignKey: 'idDocumento',
  as: 'registrosAuditoria'
});
RegistroAuditoria.belongsTo(Documento, {
  foreignKey: 'idDocumento',
  as: 'documento'
});

// Relación Matrizador - RegistroAuditoria
Matrizador.hasMany(RegistroAuditoria, {
  foreignKey: 'idMatrizador',
  as: 'registrosAuditoria'
});
RegistroAuditoria.belongsTo(Matrizador, {
  foreignKey: 'idMatrizador',
  as: 'matrizador'
});

// Relaciones entre documentos
Documento.belongsToMany(Documento, {
  through: DocumentoRelacion,
  foreignKey: 'idDocumentoPrincipal',
  otherKey: 'idDocumentoRelacionado',
  as: 'documentosRelacionados'
});

// Relaciones de Matrizador con DocumentoRelacion (Creador)
Matrizador.hasMany(DocumentoRelacion, {
  foreignKey: 'creadoPor',
  as: 'relacionesCreadas'
});
DocumentoRelacion.belongsTo(Matrizador, {
  foreignKey: 'creadoPor',
  as: 'creador'
});

module.exports = {
  Documento,
  Matrizador,
  EventoDocumento,
  RegistroAuditoria,
  DocumentoRelacion
}; 