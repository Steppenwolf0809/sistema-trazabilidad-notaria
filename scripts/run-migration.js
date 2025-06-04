/**
 * Script para ejecutar migración de base de datos
 * Añade campos del sistema de pagos con retenciones
 */

const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Iniciando migración de base de datos...');
    
    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, '../migrations/001_add_payment_retention_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Dividir en comandos individuales (separados por ;)
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('PRINT'));
    
    console.log(`📝 Ejecutando ${commands.length} comandos SQL...`);
    
    // Ejecutar cada comando
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim()) {
        try {
          console.log(`⚡ Ejecutando comando ${i + 1}/${commands.length}...`);
          await sequelize.query(command);
          console.log(`✅ Comando ${i + 1} ejecutado exitosamente`);
        } catch (error) {
          // Algunos errores son esperados (como columnas que ya existen)
          if (error.message.includes('already exists') || 
              error.message.includes('ya existe') ||
              error.message.includes('duplicate')) {
            console.log(`⚠️  Comando ${i + 1} omitido (ya existe): ${error.message.split('\n')[0]}`);
          } else {
            console.error(`❌ Error en comando ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Migración completada exitosamente');
    console.log('📊 Verificando estructura de la tabla...');
    
    // Verificar que los campos se añadieron correctamente
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'documentos' 
      AND column_name IN (
        'valor_pagado', 'valor_pendiente', 'estado_pago', 'fecha_ultimo_pago',
        'tiene_retencion', 'numero_comprobante_retencion', 'valor_retenido',
        'retencion_iva', 'retencion_renta', 'ruc_empresa_retenedora',
        'razon_social_retenedora', 'fecha_retencion', 'archivo_pdf_retencion'
      )
      ORDER BY column_name;
    `);
    
    console.log('📋 Nuevos campos añadidos:');
    results.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Verificar tabla pagos
    const [pagosCols] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'pagos'
      ORDER BY ordinal_position;
    `);
    
    if (pagosCols.length > 0) {
      console.log('📋 Tabla pagos creada con columnas:');
      pagosCols.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
    }
    
    console.log('🎉 ¡Migración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar migración
runMigration(); 