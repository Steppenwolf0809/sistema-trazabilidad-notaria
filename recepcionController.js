dashboard: (req, res) => {
  console.log("Accediendo al dashboard de recepción");
  console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
  console.log("Ruta solicitada:", req.originalUrl);
  res.render('recepcion/dashboard', { 
    layout: 'recepcion', 
    title: 'Panel de Recepción', 
    userRole: req.matrizador?.rol, 
    userName: req.matrizador?.nombre,
    usuario: {
      id: req.matrizador?.id,
      rol: req.matrizador?.rol,
      nombre: req.matrizador?.nombre
    }
  });
},

documento: (req, res) => {
  console.log("Accediendo al documento de recepción");
  console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
  console.log("Ruta solicitada:", req.originalUrl);
  res.render('recepcion/documento', { 
    layout: 'recepcion', 
    title: 'Documento de Recepción', 
    userRole: req.matrizador?.rol, 
    userName: req.matrizador?.nombre,
    usuario: {
      id: req.matrizador?.id,
      rol: req.matrizador?.rol,
      nombre: req.matrizador?.nombre
    },
    documento: null,
    error: 'El documento solicitado no existe'
  });
},

historial: (req, res) => {
  console.log("Accediendo al historial de recepción");
  console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
  console.log("Ruta solicitada:", req.originalUrl);
  res.render('recepcion/historial', { 
    layout: 'recepcion', 
    title: 'Historial de Recepción', 
    userRole: req.matrizador?.rol, 
    userName: req.matrizador?.nombre,
    usuario: {
      id: req.matrizador?.id,
      rol: req.matrizador?.rol,
      nombre: req.matrizador?.nombre
    },
    documento,
    historial
  });
},

// ... existing code ... 