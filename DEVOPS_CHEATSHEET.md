# 🐳 DevOps & Docker Cheatsheet

Guarda este archivo en tus favoritos. Estos son los comandos que usarás el 99% del tiempo en tu día a día como desarrollador Full-Stack/DevOps.

*(Nota: Si usas WSL sin Docker Desktop, recuerda poner `wsl` antes de cada comando).*

## 🎵 Docker Compose (El Director de Orquesta)
Es la herramienta que más vas a usar, porque maneja múltiples contenedores a la vez leyendo tu `docker-compose.yml`.

* **`docker compose up -d`**
  Enciende toda la infraestructura en segundo plano (detached). Usa las imágenes que ya tiene guardadas.
  
* **`docker compose up -d --build`**
  **El más importante si haces cambios en el código.** Obliga a Docker a leer tu `Dockerfile` nuevamente, reconstruir las imágenes y luego encenderlas.
  
* **`docker compose up -d postgres redis`**
  Enciende *solamente* servicios específicos. ¡Ideal para tu entorno de desarrollo local cuando quieres correr Node.js por fuera!

* **`docker compose down`**
  Apaga todos los contenedores de la orquesta de forma segura.

* **`docker compose down -v`**
  **⚠️ PELIGROSO PERO ÚTIL:** Apaga todo y *destruye los volúmenes* (borra tu base de datos y caché). Úsalo cuando quieres empezar con una base de datos 100% limpia.

* **`docker compose logs -f backend`**
  Te muestra la consola (los console.logs) de un servicio específico en tiempo real. Para salir presionas `Ctrl + C`.

---

## 🐋 Docker CLI (Comandos Directos)
Para interactuar directamente con contenedores y la limpieza del sistema.

* **`docker ps`**
  Lista todos los contenedores que están encendidos en este momento, sus nombres y qué puertos están ocupando.

* **`docker exec -it <nombre-contenedor> sh`**
  Te teletransporta *adentro* del contenedor. Abre una terminal de Linux dentro de tu imagen. (Ej: `docker exec -it watchparty-backend sh`). Para salir escribes `exit`.

* **`docker system prune -f`**
  El comando de la limpieza. Borra contenedores detenidos, redes sin uso e imágenes basura. Útil cuando Docker empieza a ocupar mucho espacio en tu disco duro.

---

## 🐙 Git & CI/CD
El flujo de trabajo perfecto para activar tus automatizaciones (GitHub Actions).

* **`git add .`** -> **`git commit -m "Mensaje"`** -> **`git push`**
  Tu pan de cada día. Al hacer el `push` a la rama `master`, se activará el archivo `server-ci.yml`.

* **`git pull`**
  El comando que tu servidor VPS (o tú en tu Notebook) ejecutará para traer los cambios más recientes antes de hacer un `--build`.

---
*Pro tip: Imprime esta hoja o déjala abierta en tu editor. ¡Con estos comandos puedes sobrevivir en cualquier empresa de software del mundo!*
