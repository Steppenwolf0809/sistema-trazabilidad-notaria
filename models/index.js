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
const AuditoriaEliminacion = require('./AuditoriaEliminacion');
const NotificacionEnviada = require('./NotificacionEnviada');
const AutorizacionUrgente = require('./AutorizacionUrgente');
const NotificacionGrupal = require('./NotificacionGrupal');

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

// CORREGIDO: Relación Documento - EventoDocumento (Un documento puede tener muchos eventos)
Documento.hasMany(EventoDocumento, { 
  foreignKey: 'documentoId', // CORREGIDO: usar documentoId en lugar de idDocumento
  as: 'eventos'
});
EventoDocumento.belongsTo(Documento, {
  foreignKey: 'documentoId', // CORREGIDO: usar documentoId en lugar de idDocumento
  as: 'documento'
});

// AGREGADO: Relación Matrizador - EventoDocumento (Un matrizador puede crear muchos eventos)
Matrizador.hasMany(EventoDocumento, {
  foreignKey: 'usuarioId',
  as: 'eventosCreados'
});
EventoDocumento.belongsTo(Matrizador, {
  foreignKey: 'usuarioId',
  as: 'matrizador' // Usar alias 'matrizador' para consistencia
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

Matrizador.hasMany(AuditoriaEliminacion, {
  foreignKey: 'eliminadoPor',
  as: 'auditoriasEliminacion'
});
AuditoriaEliminacion.belongsTo(Matrizador, {
  foreignKey: 'eliminadoPor',
  as: 'administrador'
});

// ============== RELACIONES PARA NOTIFICACIONES ==============

// Relación Documento - NotificacionEnviada
Documento.hasMany(NotificacionEnviada, {
  foreignKey: 'documentoId',
  as: 'notificaciones'
});
NotificacionEnviada.belongsTo(Documento, {
  foreignKey: 'documentoId',
  as: 'documento'
});

// ============== RELACIONES PARA NOTIFICACIONES GRUPALES ==============

// Relación NotificacionGrupal - Documento (Un grupo tiene muchos documentos)
NotificacionGrupal.hasMany(Documento, {
  foreignKey: 'notificacionGrupalId',
  as: 'documentos'
});
Documento.belongsTo(NotificacionGrupal, {
  foreignKey: 'notificacionGrupalId',
  as: 'notificacionGrupal'
});

// Relación Matrizador - NotificacionGrupal (Un matrizador puede crear muchos grupos)
Matrizador.hasMany(NotificacionGrupal, {
  foreignKey: 'matrizadorId',
  as: 'gruposNotificacion'
});
NotificacionGrupal.belongsTo(Matrizador, {
  foreignKey: 'matrizadorId',
  as: 'matrizador'
});

// ============== RELACIONES PARA AUTORIZACIONES URGENTES ==============

// Relación Documento - AutorizacionUrgente
Documento.hasMany(AutorizacionUrgente, {
  foreignKey: 'documento_id',
  as: 'autorizacionesUrgentes'
});
AutorizacionUrgente.belongsTo(Documento, {
  foreignKey: 'documento_id',
  as: 'documento'
});

// Relación Matrizador (solicitante) - AutorizacionUrgente
Matrizador.hasMany(AutorizacionUrgente, {
  foreignKey: 'solicitado_por_id',
  as: 'autorizacionesSolicitadas'
});
AutorizacionUrgente.belongsTo(Matrizador, {
  foreignKey: 'solicitado_por_id',
  as: 'solicitante'
});

// Relación Matrizador (responsable) - AutorizacionUrgente
Matrizador.hasMany(AutorizacionUrgente, {
  foreignKey: 'matrizador_responsable_id',
  as: 'autorizacionesAsignadas'
});
AutorizacionUrgente.belongsTo(Matrizador, {
  foreignKey: 'matrizador_responsable_id',
  as: 'matrizadorResponsable'
});

// Relación Matrizador (autorizador) - AutorizacionUrgente
Matrizador.hasMany(AutorizacionUrgente, {
  foreignKey: 'autorizada_por_id',
  as: 'autorizacionesOtorgadasUrgentes'
});
AutorizacionUrgente.belongsTo(Matrizador, {
  foreignKey: 'autorizada_por_id',
  as: 'autorizador'
});

// Relación Matrizador (rechazador) - AutorizacionUrgente
Matrizador.hasMany(AutorizacionUrgente, {
  foreignKey: 'rechazada_por_id',
  as: 'autorizacionesRechazadas'
});
AutorizacionUrgente.belongsTo(Matrizador, {
  foreignKey: 'rechazada_por_id',
  as: 'rechazador'
});

// NOTA: Las relaciones para el sistema de notificaciones están definidas en models/Documento.js
// para evitar conflictos de alias duplicados

module.exports = {
  Documento,
  Matrizador,
  EventoDocumento,
  RegistroAuditoria,
  DocumentoRelacion,
  CambioMatrizador,
  AutorizacionEntrega,
  DocumentosRelacionados,
  AuditoriaEliminacion,
  NotificacionEnviada,
  AutorizacionUrgente,
  NotificacionGrupal
}; 