/**
 * Script simplificado para migración de base de datos
 * Ejecuta comandos individuales para evitar problemas de parsing
 */

const { sequelize } = require('../config/database');

async function runSimpleMigration() {
  try {
    console.log('🔄 Iniciando migración simplificada...');
    
    // Comandos de migración individuales
    const commands = [
      // Campos de información de pagos
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS valor_pagado DECIMAL(10,2) DEFAULT 0.00 NOT NULL`,
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS valor_pendiente DECIMAL(10,2) DEFAULT 0.00 NOT NULL`,
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS fecha_ultimo_pago TIMESTAMP WITH TIME ZONE`,
      
      // Campos de información de retenciones
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS tiene_retencion BOOLEAN DEFAULT FALSE NOT NULL`,
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS numero_comprobante_retencion VARCHAR(50)`,
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS valor_retenido DECIMAL(10,2) DEFAULT 0.00 NOT NULL`,
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS retencion_iva DECIMAL(10,2) DEFAULT 0.00 NOT NULL`,
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS retencion_renta DECIMAL(10,2) DEFAULT 0.00 NOT NULL`,
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS ruc_empresa_retenedora VARCHAR(13)`,
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS razon_social_retenedora VARCHAR(200)`,
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS fecha_retencion TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE documentos ADD COLUMN IF NOT EXISTS archivo_pdf_retencion TEXT`
    ];
    
    // Ejecutar comandos básicos
    for (let i = 0; i < commands.length; i++) {
      try {
        console.log(`⚡ Ejecutando comando ${i + 1}/${commands.length}...`);
        await sequelize.query(commands[i]);
        console.log(`✅ Comando ${i + 1} ejecutado exitosamente`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('ya existe')) {
          console.log(`⚠️  Campo ya existe, omitiendo...`);
        } else {
          console.error(`❌ Error en comando ${i + 1}:`, error.message);
        }
      }
    }
    
    // Crear tipo enum para estado_pago
    try {
      console.log('📝 Creando tipo enum para estado_pago...');
      await sequelize.query(`
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_pago_enum') THEN
                CREATE TYPE estado_pago_enum AS ENUM ('pendiente', 'pago_parcial', 'pagado_completo', 'pagado_con_retencion');
            END IF;
        END $$;
      `);
      console.log('✅ Tipo enum creado');
    } catch (error) {
      console.log('⚠️  Tipo enum ya existe o error:', error.message);
    }
    
    // Añadir columna estado_pago
    try {
      console.log('📝 Añadiendo columna estado_pago...');
      await sequelize.query(`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS estado_pago estado_pago_enum DEFAULT 'pendiente'`);
      console.log('✅ Columna estado_pago añadida');
    } catch (error) {
      console.log('⚠️  Columna estado_pago ya existe:', error.message);
    }
    
    // Crear tabla pagos
    try {
      console.log('📝 Creando tabla pagos...');
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS pagos (
            id SERIAL PRIMARY KEY,
            documento_id INTEGER NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
            usuario_id INTEGER NOT NULL,
            monto DECIMAL(10,2) NOT NULL,
            forma_pago VARCHAR(50) NOT NULL,
            numero_comprobante VARCHAR(100),
            es_retencion BOOLEAN DEFAULT FALSE NOT NULL,
            observaciones TEXT,
            fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            metadatos JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        )
      `);
      console.log('✅ Tabla pagos creada');
    } catch (error) {
      console.log('⚠️  Tabla pagos ya existe:', error.message);
    }
    
    // Crear índices
    const indices = [
      `CREATE INDEX IF NOT EXISTS idx_pagos_documento_id ON pagos(documento_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pagos_usuario_id ON pagos(usuario_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos(fecha_pago)`,
      `CREATE INDEX IF NOT EXISTS idx_pagos_es_retencion ON pagos(es_retencion)`
    ];
    
    for (const indice of indices) {
      try {
        await sequelize.query(indice);
        console.log('✅ Índice creado');
      } catch (error) {
        console.log('⚠️  Índice ya existe');
      }
    }
    
    // Actualizar datos existentes
    try {
      console.log('📝 Actualizando datos existentes...');
      
      // Inicializar valor_pendiente
      await sequelize.query(`
        UPDATE documentos 
        SET valor_pendiente = COALESCE(valor_factura, 0) - COALESCE(valor_pagado, 0)
        WHERE numero_factura IS NOT NULL
      `);
      
      // Actualizar estado_pago para documentos pagados
      await sequelize.query(`
        UPDATE documentos 
        SET estado_pago = 'pagado_completo'
        WHERE metodo_pago != 'pendiente' 
        AND metodo_pago IS NOT NULL 
        AND numero_factura IS NOT NULL
      `);
      
      console.log('✅ Datos existentes actualizados');
    } catch (error) {
      console.log('⚠️  Error actualizando datos:', error.message);
    }
    
    // Verificar estructura
    console.log('📊 Verificando estructura...');
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'documentos' 
      AND column_name IN (
        'valor_pagado', 'valor_pendiente', 'estado_pago', 'fecha_ultimo_pago',
        'tiene_retencion', 'numero_comprobante_retencion', 'valor_retenido'
      )
      ORDER BY column_name
    `);
    
    console.log('📋 Campos verificados:');
    results.forEach(col => {
      console.log(`   ✓ ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('🎉 ¡Migración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await sequelize.close();
  }
}

runSimpleMigration(); 