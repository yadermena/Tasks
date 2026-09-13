**Task List**  
**Manual técnico y operativo**  
**Proyecto:** plataforma web de gestión de tareas, usuarios, roles y empresas  
   
 **Stack:** Angular, Node.js, Express y MongoDB Atlas  
   
 **Documento maestro:** este README.md  
   
 **Última actualización:** septiembre de 2026  
***Nota de versión:*** * la solicitud de producto identifica el frontend como Angular 19. El repositorio actual declara Angular * *22.1.0* * en * *task-list-frontend/package.json* *. Este manual describe el código presente y recomienda verificar la versión objetivo antes de realizar una actualización o despliegue.*  
**1. Descripción ejecutiva**  
Task List es una aplicación web responsive para administrar tareas asociadas a usuarios y empresas. El sistema combina un dashboard operativo, administración de usuarios y roles, gestión de empresas, control visual de estados, temporizadores y una vista pública compartible.  
La solución está separada en dos aplicaciones:  
- task-list-frontend: aplicación Angular standalone con rutas, dashboard, login, vista pública y soporte de compilación para producción.  
- task-list-backend: API REST desarrollada con Node.js y Express, persistencia en MongoDB mediante Mongoose y carga automática de roles.  
**2. Mejoras funcionales destacadas**  
**2.1 Dashboard segmentado por rol**  
El dashboard de administración organiza los usuarios por nombre de rol y ofrece contadores y filtros específicos para:  
- **Administradores (** **admin** **):** control global de tareas, usuarios, empresas, permisos, restauración y configuraciones.  
- **Editores (** **editor** **):** operación sobre tareas y perfil según los permisos asignados.  
- **Visualizadores (** **viewer** **):** consulta de información sin permisos de edición por defecto.  
La segmentación permite localizar rápidamente cada grupo, reduce la carga visual y mejora la operación del administrador. Los filtros se combinan con búsqueda por nombre, correo o rol.  
**2.2 Semáforo de estados de tareas**  
Cada tarea utiliza un estado controlado y visible en el dashboard:  
| | | |  
|-|-|-|  
| **Estado** | **Lectura operativa** | **Semáforo recomendado** |   
| ejecutando | Trabajo en curso | Verde |   
| acumulada | Pendiente o acumulada | Amarillo |   
| completada | Trabajo finalizado | Gris o azul de confirmación |   
   
El sistema también conserva tareas eliminadas mediante borrado lógico. Los administradores pueden consultar el filtro de eliminadas y restaurarlas. Las tareas pueden incluir un temporizador de entre 1 y 10.080 minutos, disponible para administración.  
**2.3 Empresa asociada al usuario**  
Un usuario puede pertenecer a una o varias empresas. El dashboard muestra la relación usuario-empresa y permite administrarla desde el módulo **Empresas**. Las empresas incluyen nombre y rubro; la API devuelve además el usuario asignado cuando corresponde.  
**2.4 Compartir URL con redirección al login**  
Desde el menú de perfil se puede copiar una URL individual con el formato:  
https://dominio-de-la-aplicacion/?loginAs=<ID_DEL_USUARIO>  
   
El parámetro identifica la cuenta esperada y presenta el login. La autenticación sigue requiriendo el correo y la contraseña correctos; si la cuenta autenticada no coincide con el usuario de la URL, se muestra un mensaje de validación. Una vez autenticado, el usuario puede consultar sus tareas.  
La vista pública de tareas utiliza además la ruta:  
/tareas/<ID_DEL_USUARIO>  
   
Esta ruta muestra las tareas activas compartidas y el nombre del usuario propietario.  
**2.5 Diseño responsive y experiencia visual**  
La interfaz está optimizada para escritorio, tablet y móvil. El dashboard utiliza navegación lateral adaptable, menú hamburguesa, formularios reorganizables, búsqueda y tarjetas de resumen por estado. El login presenta un estilo moderno, validación de campos, estado de carga, control para mostrar u ocultar contraseña y mensajes de error claros.  
La interfaz emplea colores funcionales para diferenciar estados y grupos de usuarios, de modo que el dashboard pueda escanearse rápidamente en operaciones diarias.  
**3. Arquitectura de la solución**  
Usuario / navegador  
     |  
     v  
 Angular frontend (desarrollo: :4200)  
     |  
     | HTTP/JSON + CORS  
     v  
 Express API (desarrollo: :5000)  
     |  
     | Mongoose  
     v  
 MongoDB Atlas  
   
**Frontend**  
- Angular standalone components.  
- Angular Router para / y /tareas/:userId.  
- Signals y computed values para estado reactivo del dashboard.  
- fetch para consumir la API REST.  
- Service worker configurado en angular.json y ngsw-config.json.  
- Renderizado/servido preparado para SSR mediante los archivos main.server.ts y server.ts.  
- En local, la API se resuelve como http://localhost:5000; fuera de localhost, el código actual utiliza el endpoint publicado https://tasks-2x63.onrender.com.  
**Backend**  
- Express 4.  
- CORS habilitado.  
- JSON requests habilitadas.  
- Dotenv para variables de entorno.  
- Mongoose 8 para modelos y conexión a MongoDB.  
- crypto.pbkdf2Sync con salt para el hash de contraseñas.  
- Inicialización automática de los roles admin, editor y viewer al conectar con la base de datos.  
**4. Estructura del repositorio**  
   
   
Tasks/  
 ├── README.md  
 ├── task-list-backend/  
 │   ├── package.json  
 │   ├── server.js  
 │   └── models/  
 │       ├── empresa.js  
 │       ├── role.js  
 │       ├── task.js  
 │       └── user.js  
 └── task-list-frontend/  
     ├── angular.json  
     ├── package.json  
     ├── ngsw-config.json  
     ├── public/  
     └── src/  
     ├── main.ts  
     ├── main.server.ts  
     ├── server.ts  
     └── app/  
         ├── app.ts  
         ├── app.html  
         ├── app.css  
         ├── app.routes.ts  
         ├── login/  
         └── public-tasks/  
   
**5. Requisitos previos**  
- Node.js 22 LTS recomendado.  
- npm 10 o superior.  
- Una base de datos MongoDB local o MongoDB Atlas.  
- Acceso de red desde el equipo hacia MongoDB Atlas.  
- Navegador moderno con soporte para aplicaciones web actuales.  
Comprobar versiones:  
node --version  
 npm --version  
   
Para gestionar Node.js sin modificar la versión del sistema se recomienda NVM:  
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash  
 nvm install 22  
 nvm alias default 22  
   
**6. Configuración de MongoDB y variables de entorno**  
Crear un archivo .env dentro de task-list-backend/:  
MONGO_URI=mongodb+srv://USUARIO:CONTRASENA@CLUSTER.mongodb.net/taskdb?retryWrites=true&w=majority  
 PORT=5000  
 NODE_ENV=development  
   
Para MongoDB Atlas:  
1. Crear o seleccionar un cluster.  
2. Crear un usuario de base de datos con permisos sobre taskdb.  
3. Autorizar la IP de desarrollo en **Network Access**.  
4. Copiar la cadena de conexión desde **Connect > Drivers**.  
5. Sustituir usuario, contraseña y cluster en MONGO_URI.  
Nunca publicar contraseñas, tokens ni cadenas mongodb+srv reales en Git. El archivo .env debe estar incluido en .gitignore. Si se comparte el repositorio, rotar inmediatamente cualquier credencial que haya quedado expuesta.  
**7. Instalación y ejecución local**  
**7.1 Backend**  
En una terminal:  
cd task-list-backend  
 npm install  
 npm start  
   
El servidor queda disponible en http://localhost:5000. Al iniciar correctamente debe mostrar mensajes de escucha del servidor y conexión a MongoDB. La conexión también ejecuta la inicialización o actualización de los roles base.  
**7.2 Frontend**  
En una segunda terminal:  
cd task-list-frontend  
 npm install  
 npm start  
   
Abrir http://localhost:4200. El frontend detecta localhost y consume automáticamente el backend en http://localhost:5000.  
**7.3 Compilación de producción**  
cd task-list-frontend  
 npm run build  
   
El resultado se genera en dist/task-list-frontend. El proyecto también incluye el script de servicio SSR:  
npm run serve:ssr:task-list-frontend  
   
**8. Flujo de autenticación y permisos**  
1. El usuario introduce correo y contraseña en el login.  
2. Express busca el usuario y valida la contraseña con el salt almacenado.  
3. La respuesta excluye password y salt.  
4. Angular establece la sesión de trabajo y carga usuarios, empresas o tareas según el rol.  
5. En las operaciones de API se envían encabezados de contexto como x-user-id, x-user-role y permisos x-user-can-*.  
***Consideración de seguridad:*** * el código actual implementa autenticación de sesión en el cliente mediante * *localStorage* * y encabezados de contexto. Para un entorno productivo se recomienda incorporar sesiones seguras o JWT validado en el servidor, autorización centralizada, cookies * *HttpOnly* *, protección CSRF, rate limiting y HTTPS.*  
**Permisos base**  
| | | | |  
|-|-|-|-|  
| **Permiso** | **Admin** | **Editor** | **Viewer** |   
| Eliminar tareas | Sí | No | No |   
| Editar perfil | Sí | Sí | No |   
| Editar tareas | Sí | Sí | No |   
| Cambiar a ejecutando | Sí | Sí | No |   
| Completar tareas | Sí | No | No |   
| Restaurar tareas | Sí | No | No |   
   
Los permisos individuales se guardan en el usuario y pueden ser sobrescritos por un administrador.  
**9. Modelos de datos**  
**User**  
name, email, role, credenciales hash/salt, permisos individuales, empresas asociadas y createdAt.  
**Role**  
Nombre único (admin, editor, viewer) y objeto de permisos por defecto.  
**Empresa**  
name, rubro y timestamps de Mongoose.  
**Task**  
userId, name, status, completed, completedAt, timerMinutes, timerEndsAt, isDeleted y timestamps. Las tareas no se eliminan físicamente al usar el flujo de borrado lógico.  
**10. API REST de referencia**  
Base local: http://localhost:5000/api  
| | | |  
|-|-|-|  
| **Método** | **Endpoint** | **Uso** |   
| POST | /auth/login | Autenticar usuario |   
| GET | /tasks | Obtener tareas activas o eliminadas según filtro |   
| GET | /tasks/public/:userId | Obtener tareas públicas de un usuario |   
| POST | /tasks | Crear tarea |   
| PUT | /tasks/:id | Editar nombre, estado, asignación o temporizador |   
| PUT | /tasks/:id/status | Actualizar estado |   
| DELETE | /tasks/:id | Borrado lógico |   
| POST | /tasks/:id/restore | Restaurar tarea |   
| GET | /users | Listar usuarios y empresas |   
| POST | /users | Crear usuario |   
| PUT | /users/:id | Actualizar usuario, rol o permisos |   
| DELETE | /users/:id | Eliminar usuario |   
| GET | /empresas | Listar empresas y usuario asignado |   
| POST | /empresas | Crear empresa |   
| PUT | /empresas/:id | Actualizar empresa |   
| DELETE | /empresas/:id | Eliminar empresa |   
   
Las respuestas de error usan códigos HTTP convencionales como 400, 401, 403, 404, 409 y 500, junto con un campo message.  
**11. Operación del dashboard**  
**Administrador**  
Puede cambiar entre **Tareas**,  **Usuarios**,  **Empresas** y  **Configuraciones**. En Tareas puede consultar todo el sistema, filtrar por usuario y estado, asignar tareas, definir temporizadores, eliminar lógicamente y restaurar. En Usuarios puede localizar personas por grupo de rol. En Empresas puede crear, editar, eliminar y relacionar empresas con usuarios.  
**Editor**  
Opera las tareas habilitadas por sus permisos y puede editar su perfil si tiene canEditProfile.  
**Viewer**  
Accede a la información permitida en modo consulta. No recibe permisos de edición por defecto.  
**12. Pruebas y comprobaciones recomendadas**  
cd task-list-frontend  
 npm test  
 npm run build  
   
Checklist funcional mínimo:  
- Login correcto e incorrecto.  
- Validación del login desde URL compartida.  
- Visualización por cada rol.  
- Segmentación de administradores, editores y viewers.  
- Creación y asignación de empresas.  
- Semáforo y cambio de estado de tareas.  
- Temporizador y expiración.  
- Borrado lógico y restauración.  
- Diseño en móvil, tablet y escritorio.  
- Vista /tareas/:userId con usuario válido e inválido.  
**13. Despliegue y mantenimiento**  
- Configurar MONGO_URI, PORT y NODE_ENV en el proveedor del backend.  
- Configurar CORS con una lista de orígenes permitidos en producción.  
- Construir el frontend con npm run build.  
- Servir los archivos estáticos o el servidor SSR según la estrategia de hosting.  
- Verificar que el dominio del frontend apunte al endpoint correcto de la API.  
- No incluir .env, secretos ni credenciales en el repositorio.  
- Revisar periódicamente dependencias con npm audit y actualizaciones controladas.  
- Configurar copias de seguridad y políticas de acceso en MongoDB Atlas.  
**14. Solución de problemas**  
**No conecta con MongoDB:** revisar MONGO_URI, usuario, contraseña, IP autorizada y permisos del usuario de Atlas.  
**El frontend muestra error de red:** comprobar que el backend esté levantado en el puerto 5000 y que CORS permita el origen del frontend.  
**No aparece una empresa:** verificar que la empresa exista y que sus IDs estén correctamente asignados al usuario.  
**La URL compartida no valida la cuenta:** confirmar que el parámetro loginAs contenga el ObjectId correcto y que el correo usado pertenezca a ese usuario.  
**El dashboard no actualiza una tarea:** revisar el rol, los permisos individuales y el estado actual; las tareas completadas tienen restricciones para usuarios que no son administradores.  
**15. Próximas mejoras recomendadas**  
- Migrar la autenticación de encabezados de confianza del cliente a JWT o sesión segura validada por el backend.  
- Eliminar cualquier fallback de credenciales de MongoDB en código y exigir MONGO_URI mediante variables de entorno.  
- Incorporar pruebas de integración para permisos, estados y URLs compartidas.  
- Centralizar la URL de API mediante configuración de entorno de Angular.  
- Añadir auditoría de cambios de usuarios, permisos, empresas y tareas.  
- Añadir paginación y límites de consulta para instalaciones con grandes volúmenes.  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAALUlEQVR4nO3OQQ0AIAwEsAMlSJ0UrOFkGngRklZBR1WtJDsAAPzizNcDAADuNcKwAyU+nb+5AAAAAElFTkSuQmCC)  
**Mantenimiento del documento:** actualizar este README junto con cualquier cambio en rutas, permisos, modelos, variables de entorno o versión de Angular.  
