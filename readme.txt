# Documentación del Proyecto y Distribución de Tareas

## 1. Patrones de Diseño y Arquitectura del Proyecto

Este proyecto implementa varios patrones de diseño y arquitecturas modernas comunes en el desarrollo web con Next.js y React.

### Arquitectura Basada en Componentes (Component-Based Architecture)
- **Descripción:** La interfaz de usuario está construida como un conjunto de componentes reutilizables y encapsulados. Esto se evidencia en la estructura del directorio `src/components`, que contiene elementos como `AdminChatWindow.tsx`, `ProfilePhotoUpload.tsx`, etc.
- **Ventajas:** Facilita el mantenimiento, la escalabilidad y la reutilización de código.

### Patrón Proveedor (Provider Pattern)
- **Descripción:** Se utiliza la API de Context de React para gestionar y proveer estados globales a través de la aplicación, como el estado de autenticación (`src/context/AuthContext.tsx`).
- **Ventajas:** Evita el "prop drilling" (pasar propiedades a través de múltiples niveles de componentes) y centraliza la lógica de estado.

### Patrón de Hooks
- **Descripción:** El proyecto utiliza hooks personalizados (ej. `useAuth.ts`, `use-mobile.tsx`) para encapsular y reutilizar lógica con estado entre componentes.
- **Ventajas:** Mejora la legibilidad y composición de la lógica de los componentes.

### Enrutamiento Basado en Archivos (File-Based Routing)
- **Descripción:** Next.js utiliza el sistema de archivos para definir las rutas de la aplicación. Las carpetas y archivos dentro de `src/app` (como `page.tsx` y `layout.tsx`) determinan la estructura de las URLs y la interfaz de usuario asociada.
- **Ventajas:** Simplifica la gestión de rutas y promueve una organización de proyecto intuitiva.

### Server Actions
- **Descripción:** La presencia de archivos como `src/lib/actions.ts` sugiere el uso de Server Actions de React, que permiten ejecutar código del lado del servidor directamente desde los componentes del cliente.
- **Ventajas:** Simplifica las mutaciones de datos y la comunicación entre el cliente y el servidor, reduciendo la necesidad de crear endpoints de API explícitos.

---

## 2. Distribución de Tareas del Equipo

### A. Tareas de Frontend (Diseño y Reactividad)

1.  **Daniel Meza (Diseño y Reactividad General):**
    *   **Responsabilidad:** Supervisar la consistencia del diseño general y la capacidad de respuesta (responsive design) de la aplicación.
    *   **Tareas:** Definir y mantener la guía de estilos con Tailwind CSS, asegurar que la UI se adapte a diferentes tamaños de pantalla y colaborar en la implementación de componentes principales.

2.  **Daniel Arzate (Marcos y Modales - Frames & Modals):**
    *   **Responsabilidad:** Desarrollar componentes complejos de la interfaz de usuario, como ventanas modales, diálogos, y la estructura principal (frames) de las páginas.
    *   **Tareas:** Implementar los componentes de UI de Shadcn/ui como `Dialog`, `Card`, etc., y asegurar su correcta funcionalidad y estado.

3.  **Daniel Alejandro (Animaciones):**
    *   **Responsabilidad:** Integrar animaciones y transiciones para mejorar la experiencia de usuario sin afectar el rendimiento.
    *   **Tareas:** Extraer o crear animaciones (inspiradas en Bootstrap o de otras fuentes), configurarlas en `tailwind.config.ts` y aplicarlas a los componentes para darles interactividad y fluidez.

4.  **Kevin Sando (Iconos y Activos Visuales):**
    *   **Responsabilidad:** Gestionar y optimizar todos los activos visuales, incluyendo iconos, imágenes y logos.
    *   **Tareas:** Integrar una librería de iconos (como Lucide-React, ya presente), optimizar imágenes para la web y asegurar que los recursos visuales se carguen de manera eficiente.

5.  **Juan Pablo (Reactivity y Lógica de Estado):**
    *   **Responsabilidad:** Manejar el estado del lado del cliente y la reactividad de los componentes.
    *   **Tareas:** Crear y mantener los React Contexts, desarrollar hooks personalizados para la lógica de negocio y gestionar cómo los datos fluyen y se actualizan en la UI.

6.  **Said Diaz (TypeScript y Tipado):**
    *   **Responsabilidad:** Asegurar la calidad y mantenibilidad del código a través de un tipado estricto con TypeScript.
    *   **Tareas:** Definir los tipos y interfaces para los datos de la aplicación (ej. en `src/lib/types.ts`), refactorizar el código para mejorar la seguridad de tipos y resolver errores de compilación de TypeScript.

### B. Tareas de Backend (Conexiones a Realtime Database)

Basado en la estructura del JSON de Firebase Realtime Database:

1.  **Daniel Meza (Gestión de Usuarios y Perfiles):**
    *   **Nodos:** `alumno`, `users`, `administrador`.
    *   **Tareas:** Implementar las funciones para crear, leer, actualizar y eliminar perfiles de usuarios y administradores. Gestionar la sincronización de datos de perfil entre el cliente y la base de datos.

2.  **Daniel Arzate (Gestión de Materiales y Préstamos):**
    *   **Nodos:** `materiales`, `prestamos`.
    *   **Tareas:** Desarrollar la lógica para registrar nuevos materiales, gestionar el inventario (cantidad), y crear y actualizar el estado de los préstamos (activo, devuelto, perdido).

3.  **Daniel Alejandro (Gestión de Adeudos y Pagos):**
    *   **Nodos:** `adeudos`, `pago`.
    *   **Tareas:** Crear la funcionalidad para generar adeudos cuando un material se pierde o daña. Implementar la lógica para registrar y verificar pagos, y actualizar el estado del adeudo.

4.  **Kevin Sando (Auditoría y Monitoreo de Administradores):**
    *   **Nodos:** `admin_access`, `admin_activity`.
    *   **Tareas:** Implementar el registro de eventos de acceso (login/logout) y las actividades importantes realizadas por los administradores en el sistema.

5.  **Juan Pablo (Sincronización en Tiempo Real):**
    *   **Responsabilidad:** Asegurar que la aplicación reaccione en tiempo real a los cambios en la base de datos.
    *   **Tareas:** Implementar los "listeners" de Firebase para nodos clave como `prestamos` y `adeudos`, para que la UI de los usuarios se actualice automáticamente.

6.  **Said Diaz (Lógica de Negocio y Notificaciones Backend):**
    *   **Responsabilidad:** Orquestar la interacción entre los diferentes nodos y gestionar la lógica de negocio del lado del servidor (o en el cliente donde corresponda).
    *   **Tareas:** Por ejemplo, al marcar un `prestamo` como "perdido", debe disparar la creación de un nuevo registro en el nodo `adeudos`. Gestionar la lógica para el envío de notificaciones por correo (como se ve en los campos `asunto` y `mensaje`).
