'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Primero, agregamos la columna 'caja' a los valores posibles del enum
    await queryInterface.sequelize.query(`
      -- Crear columna temporal con tipo texto
      ALTER TABLE matrizadores ADD COLUMN rol_temp text;
      
      -- Copiar datos a la columna temporal
      UPDATE matrizadores SET rol_temp = rol::text;
      
      -- Eliminar la columna original con tipo enum
      ALTER TABLE matrizadores DROP COLUMN rol;
      
      -- Recrear la columna rol con el nuevo tipo enum
      ALTER TABLE matrizadores ADD COLUMN rol text;
      
      -- Reestablecer los datos
      UPDATE matrizadores SET rol = rol_temp;
      
      -- Eliminar la columna temporal
      ALTER TABLE matrizadores DROP COLUMN rol_temp;
      
      -- Agregar restricción de tipo enum con los valores actualizados
      ALTER TABLE matrizadores ADD CONSTRAINT rol_check 
        CHECK (rol IN ('admin', 'matrizador', 'recepcion', 'consulta', 'caja'));
        
      -- Añadir valor por defecto si es necesario
      ALTER TABLE matrizadores ALTER COLUMN rol SET DEFAULT 'matrizador';
      
      -- Establecer NOT NULL si era requerido
      ALTER TABLE matrizadores ALTER COLUMN rol SET NOT NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Para revertir, eliminamos la restricción y volvemos a configurar solo con los valores originales
    await queryInterface.sequelize.query(`
      -- Crear columna temporal con tipo texto
      ALTER TABLE matrizadores ADD COLUMN rol_temp text;
      
      -- Copiar datos a la columna temporal (reemplazando 'caja' con otro valor como 'admin')
      UPDATE matrizadores SET rol_temp = 
        CASE 
          WHEN rol = 'caja' THEN 'admin' 
          ELSE rol 
        END;
      
      -- Eliminar la columna original
      ALTER TABLE matrizadores DROP COLUMN rol;
      
      -- Recrear la columna rol
      ALTER TABLE matrizadores ADD COLUMN rol text;
      
      -- Reestablecer los datos
      UPDATE matrizadores SET rol = rol_temp;
      
      -- Eliminar la columna temporal
      ALTER TABLE matrizadores DROP COLUMN rol_temp;
      
      -- Agregar restricción con los valores originales
      ALTER TABLE matrizadores ADD CONSTRAINT rol_check 
        CHECK (rol IN ('admin', 'matrizador', 'recepcion', 'consulta'));
        
      -- Añadir valor por defecto
      ALTER TABLE matrizadores ALTER COLUMN rol SET DEFAULT 'matrizador';
      
      -- Establecer NOT NULL
      ALTER TABLE matrizadores ALTER COLUMN rol SET NOT NULL;
    `);
  }
};
