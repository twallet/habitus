# Habitus Bot

## Descripción

Bot de Telegram para diseñar y seguir hábitos, metas y registros con recordatorios periodicos e informes para monitorear progresos, a través de una simple interfaz de chat.

Se puede usar gratuitamente (por ahora) el bot [@habitusBotBot](https://t.me/habitusBotBot).

## Características

- **Creación de nuevos seguimientos:** Define nuevos monitoreos de hábitos, metas o registros.
- **Edición de seguimientos:** Modifica la configuración de tus monitoreos en cualquier momento.
- **Reportes de progreso:** Visualiza tu progreso a lo largo del tiempo con reportes de monitoreo.
- **Notificaciones personalizadas:** Recibe recordatorios en los días y horas y con la periodicidad que tú elijas.
- **Interfaz intuitiva:** Interactúa con el bot a través de comandos y botones en Telegram.
- **Soporte multi-idioma:** Ingles, Español y Francés por ahora.

## Comandos

- `/new`: Inicia el proceso para crear un nuevo monitoreo de hábito.

![New](/images/New.jpg)  

- `/edit`: Te permite editar o archivar un seguimiento existente.

![Edit](/images/Edit.jpg)

- `/progress`: Genera un reporte de tu progreso para un hábito específico.
![Progress](/images/Progress.jpg)
![Progress Report](/images/ProgressReport.jpg)

Además, el bot te estará enviado recordatorios en los momentos pactados y te mostrará avances al recibir tu respuesta:  
![Requests](/images/Requests.jpg)
![Racha](/images/Racha.jpg)

## Estructura del Código
El bot está construido con _**Google Apps Script**_, usa la _**API de Telegram**_ y guarda datos en _**Google Sheet**_. Toda la lógica se encuentro en los archivos `.gs`:

-   `main.gs`: El punto de entrada principal de la aplicación. Contiene la lógica para manejar las peticiones `doPost` de Telegram.
-   `configs/`: Contiene las clases para manejar los flujos de configuración de los comandos (`/new`, `/edit`, `/progress`).
-   `db/`: La clase `DB.gs` maneja toda la comunicación con la Hoja de Cálculo de Google, que actúa como base de datos.
-   `model/`: Define las clases de modelo para `User`, `Request`, y `Tracking`, que representan las entidades principales de la aplicación.
-   `telegram/`: La clase `Telegram.gs` se encarga de las interacciones con la API de Telegram, como enviar mensajes y teclados.
-   `utils/`: Funciones de utilidad para logging, internacionalización (i18n), etc.
