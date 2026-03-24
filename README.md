# 💣 Juego de la Bomba (Bomb Party)

Juego web multijugador en tiempo real inspirado en Bomb Party. Los jugadores deben escribir palabras que contengan un fragmento mostrado antes de que explote la bomba.

## Árbol de archivos

```
juego-de-la-bomba/
├── package.json
├── server.js
├── README.md
├── lib/
│   ├── Dictionary.js
│   ├── FragmentGenerator.js
│   └── RoomManager.js
├── scripts/
│   └── buildFragments.js
├── data/
│   ├── .gitkeep
│   ├── spanish_words.txt      (opcional - diccionario completo)
│   └── fragments.json         (generado por build:fragments)
└── public/
    └── index.html
```

## Instalación y ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. (Opcional) Agregar diccionario español completo
#    Descarga un diccionario y guárdalo como data/spanish_words.txt
#    Una palabra por línea.

# 3. (Opcional) Generar índice de fragmentos optimizado
npm run build:fragments

# 4. Iniciar el servidor
npm start
```

El servidor estará disponible en: **http://localhost:3000**

## Diccionario

- Si existe `data/spanish_words.txt`, se carga como diccionario principal.
- Si no existe, se usa un diccionario mínimo embebido (~800 palabras).
- Se muestra un warning en consola indicando dónde colocar el diccionario real.

## Fragmentos inteligentes

Ejecuta `npm run build:fragments` para pre-calcular fragmentos válidos desde el diccionario:
- Lee todas las palabras del diccionario
- Genera substrings de longitud 2, 3 y 4
- Filtra por frecuencia mínima (≥20 palabras que lo contengan)
- Guarda en `data/fragments.json`

Si `fragments.json` no existe, los fragmentos se calculan en runtime al arrancar.

## Reglas del juego

1. Los jugadores se turnan para escribir palabras
2. La palabra debe **CONTENER** el fragmento mostrado (substring)
3. La palabra debe existir en el diccionario español
4. Si se acaba el tiempo, la bomba explota y pierdes una vida
5. El último jugador con vidas gana

## Características

- Salas con código de 4 letras
- Lobby con ajustes configurables:
  - Vidas iniciales, tiempo mínimo y máximo, longitud mínima de palabra.
  - **NUEVO**: Modo de turnos (Aleatorio Justo, En orden visual).
  - **NUEVO**: Opción de no repetir palabras en la sala.
  - **NUEVO**: Ajuste de longitud de fragmento (2, 3, 4 o Aleatorio Mixto).
- Chat en tiempo real con sistema Anti-Spam (Rate Limit) y sanitización.
- Visualización en tiempo real de lo que escribe el jugador activo.
- Espectadores para jugadores que se unen a mitad de partida o después de la muerte.
- Reconexión automática con token y manejo de gracia al desconectar en pleno turno.
- **Moderación Avanzada**: Opción del Host para expulsar (Kick) a un jugador problemático con pase automático de turno.
- Servidor autoritativo (anti-trampas, validador de tiempo y diccionarios).
- Animación de bomba sincronizada con el servidor.

## Nuevas opciones de configuración (Beta)

- `turnMode`: `RANDOM` (Aleatorio Justo) o `LINEAR` (orden visual)
- `fragLen`: `2`, `3`, `4` o `random` (mezcla)
- `fragWeight2Pct` / `fragWeight4Pct`: porcentajes para favorecer longitudes 2/4 cuando `fragLen=random` (por defecto 10/80/10)
- `recentFragMemory`: cuántos fragmentos recientes evitar repetir (por defecto 20)
- `disconnectGraceMs`: milisegundos de gracia para reconexión cuando un jugador en turno se desconecta (por defecto 2000)
- `noRepeat`: evitar repetir palabras ya aceptadas en la sala

Estos ajustes son editables por el host desde el lobby y se aplican al iniciar y durante la partida.

## Archivos adicionales

- `data/custom_words.txt`: si existe, se carga y mezcla con el diccionario principal (una palabra por línea). Útil para añadir términos locales o corregir faltas.

## Despliegue

El servidor usa `process.env.PORT || 3000`, por lo que es compatible con servicios como Render.

```bash
# Instalar dependencias
npm install

# Ejecutar local (puerto 3000 por defecto)
npm start

# Para generar fragments optimizados
npm run build:fragments
```

## Tecnología

- **Servidor:** Node.js + Express + Socket.IO
- **Cliente:** HTML/CSS/JS vanilla (sin frameworks)
- **CommonJS** (require/module.exports)
