/**
 * Archivo central para cargar todos los modelos y establecer sus relaciones
 */

const Documento = require('./Documento');
const Matrizador = require('./Matrizador');
const EventoDocumento = require('./EventoDocumento');
const RegistroAuditoria = require('./RegistroAuditoria');
const DocumentoRelacion = require('./DocumentoRelacion');
const CambioMatrizador = require('./CambioMatrizador');
const AutorizacionEntrega = require('./AutorizacionEntrega');
const DocumentosRelacionados = require('./DocumentosRelacionados');

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

// Relaciones de CambioMatrizador
Documento.hasMany(CambioMatrizador, {
  foreignKey: 'documentoId',
  as: 'cambiosMatrizador'
});
CambioMatrizador.belongsTo(Documento, {
  foreignKey: 'documentoId',
  as: 'documento'
});

Matrizador.hasMany(CambioMatrizador, {
  foreignKey: 'matrizadorAnteriorId',
  as: 'cambiosDesde'
});
CambioMatrizador.belongsTo(Matrizador, {
  foreignKey: 'matrizadorAnteriorId',
  as: 'matrizadorAnterior'
});

Matrizador.hasMany(CambioMatrizador, {
  foreignKey: 'matrizadorNuevoId',
  as: 'cambiosHacia'
});
CambioMatrizador.belongsTo(Matrizador, {
  foreignKey: 'matrizadorNuevoId',
  as: 'matrizadorNuevo'
});

Matrizador.hasMany(CambioMatrizador, {
  foreignKey: 'usuarioId',
  as: 'cambiosRealizados'
});
CambioMatrizador.belongsTo(Matrizador, {
  foreignKey: 'usuarioId',
  as: 'usuarioCambio'
});

// Relaciones de AutorizacionEntrega
Documento.hasMany(AutorizacionEntrega, {
  foreignKey: 'documentoId',
  as: 'autorizacionesEntrega'
});
AutorizacionEntrega.belongsTo(Documento, {
  foreignKey: 'documentoId',
  as: 'documento'
});

Matrizador.hasMany(AutorizacionEntrega, {
  foreignKey: 'usuarioId',
  as: 'entregasRealizadas'
});
AutorizacionEntrega.belongsTo(Matrizador, {
  foreignKey: 'usuarioId',
  as: 'usuario'
});

Matrizador.hasMany(AutorizacionEntrega, {
  foreignKey: 'autorizadorId',
  as: 'autorizacionesOtorgadas'
});
AutorizacionEntrega.belongsTo(Matrizador, {
  foreignKey: 'autorizadorId',
  as: 'autorizador'
});

// Relaciones de DocumentosRelacionados
Documento.hasMany(DocumentosRelacionados, {
  foreignKey: 'documentoPrincipalId',
  as: 'documentosSecundarios'
});
DocumentosRelacionados.belongsTo(Documento, {
  foreignKey: 'documentoPrincipalId',
  as: 'documentoPrincipal'
});

Documento.hasMany(DocumentosRelacionados, {
  foreignKey: 'documentoSecundarioId',
  as: 'relDocumentosPrincipales'
});
DocumentosRelacionados.belongsTo(Documento, {
  foreignKey: 'documentoSecundarioId',
  as: 'documentoSecundario'
});

Matrizador.hasMany(DocumentosRelacionados, {
  foreignKey: 'usuarioId',
  as: 'relacionesDocumentosCreadas'
});
DocumentosRelacionados.belongsTo(Matrizador, {
  foreignKey: 'usuarioId',
  as: 'usuario'
});

module.exports = {
  Documento,
  Matrizador,
  EventoDocumento,
  RegistroAuditoria,
  DocumentoRelacion,
  CambioMatrizador,
  AutorizacionEntrega,
  DocumentosRelacionados
}; 