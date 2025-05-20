# Instrucciones para subir el proyecto a GitHub

## 1. Preparar el repositorio local

Abre un terminal (cmd, PowerShell o Git Bash) y navega a la carpeta del proyecto:

```bash
cd C:/Users/Usuario02/sistema-notaria
```

Inicia un repositorio Git:

```bash
git init
```

## 2. Agregar archivos al repositorio

Agrega todos los archivos al staging:

```bash
git add .
```

Realiza el primer commit:

```bash
git commit -m "mvp antes de notificaciones"
```

## 3. Crear un repositorio en GitHub

1. Ve a [GitHub](https://github.com/) e inicia sesión
2. Haz clic en el botón "+" en la esquina superior derecha y selecciona "New repository"
3. Nombre del repositorio: `sistema-trazabilidad-notaria`
4. Descripción (opcional): `Sistema de Trazabilidad Documental para Notarías`
5. Deja el repositorio público para que puedas compartirlo fácilmente
6. No inicialices el repositorio con README, .gitignore o licencia
7. Haz clic en "Create repository"

## 4. Conectar el repositorio local con GitHub

GitHub te mostrará instrucciones después de crear el repositorio. Copia los comandos para un repositorio existente:

```bash
git remote add origin https://github.com/Steppenwolf0809/sistema-trazabilidad-notariasistema-trazabilidad-notaria.git
git branch -M main
git push -u origin main
```

Reemplaza `TU_USUARIO` con tu nombre de usuario de GitHub.

## 5. Verificar que todo esté subido correctamente

Ve a la URL de tu repositorio en GitHub:
```
https://github.com/TU_USUARIO/sistema-trazabilidad-notaria
```

Deberías ver todos los archivos del proyecto subidos correctamente.

## Notas importantes

- Si nunca has usado Git en tu computadora, es posible que te pida configurar tu email y nombre:
  ```bash
  git config --global user.email "tu@email.com"
  git config --global user.name "Tu Nombre"
  ```

- Es posible que te pida las credenciales de GitHub al hacer push. Ingresa tu nombre de usuario y contraseña de GitHub.

- Si tienes problemas con la autenticación, GitHub recomienda usar tokens de acceso personal en lugar de contraseñas. Puedes crear uno en: 
  Settings > Developer settings > Personal access tokens 