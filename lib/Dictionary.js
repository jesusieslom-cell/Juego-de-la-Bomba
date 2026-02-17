const fs = require('fs');
const path = require('path');

class Dictionary {
  constructor() {
    this.words = new Set();
  }

  normalize(word) {
    let w = word.trim().toLowerCase();
    w = w.replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
         .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u');
    w = w.replace(/[^a-zñ]/g, '');
    return w;
  }

  load() {
    const dictPath = path.join(__dirname, '..', 'data', 'spanish_words.txt');

    if (fs.existsSync(dictPath)) {
      const content = fs.readFileSync(dictPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      let count = 0;
      for (const line of lines) {
        const w = this.normalize(line);
        if (w.length >= 2) {
          this.words.add(w);
          count++;
        }
      }
      console.log(`📖 Diccionario cargado: ${count} palabras desde ${dictPath}`);
    } else {
      console.warn('\n⚠══════════════════════════════════════════════════════════════⚠');
      console.warn('  AVISO: No se encontró data/spanish_words.txt');
      console.warn('  Usando diccionario mínimo embebido (~800 palabras).');
      console.warn('  Para mejor experiencia, descarga un diccionario español');
      console.warn('  y guárdalo en: data/spanish_words.txt (una palabra por línea)');
      console.warn('⚠══════════════════════════════════════════════════════════════⚠\n');
      this.loadEmbedded();
    }
  }

  loadEmbedded() {
    // Minimal Spanish dictionary for testing
    const words = [
      'casa','cosa','mesa','peso','paso','piso','rojo','rosa','ropa','rato',
      'rata','rico','reja','reno','remo','rama','rana','real','raya','raza',
      'taza','tipo','tapa','tema','tela','toro','tono','todo','tren','tres',
      'alto','arco','arca','area','arma','arte','asno','aula','auto','azul',
      'bajo','bala','bano','base','beso','bien','boca','boda','bola','bote',
      'buey','buho','cabo','cafe','caja','cama','cana','capa','cara','casi',
      'caza','cebo','ceja','cena','cero','cien','cima','cine','cita','clam',
      'club','cola','como','copa','core','coro','cruz','cubo','dado','dama',
      'dano','dato','dedo','dios','doce','duda','duro','edad','ella','elmo',
      'faja','fama','faro','fase','fila','fino','flor','foca','foco','fosa',
      'gala','gana','gasa','gato','giro','gota','gran','gris','guia','haba',
      'idea','isla','jefe','jugo','juez','kilo','lado','lana','lata','lava',
      'leon','lima','lino','liso','lobo','loco','lodo','loma','luna','mago',
      'mala','malo','mama','mano','mapa','mayo','miel','mina','moda','modo',
      'mono','mora','moto','mudo','muro','nada','nido','nino','nube','nudo',
      'obra','odio','oido','once','oral','orca','oro','paca','palo','papa',
      'para','pare','paro','pata','pato','pena','peru','piel','polo','pomo',
      'poro','pozo','rabo','raro','raza','remo','rial','rico','rima','risa',
      'rizo','roca','roda','rojo','ropa','roto','rudo','saco','sala','sano',
      'sapo','seda','seis','seno','sera','seta','silo','soga','soja','solo',
      'sumo','taco','tapa','taxi','teja','tera','tina','tiza','toda','toma',
      'tubo','tuyo','unas','unos','urea','uvas','vaca','vago','vale','vara',
      'vaso','vela','vena','vera','vida','vino','vivo','yate','yoga','zona',
      'abajo','abeja','abril','abrir','acero','acido','actor','acudir','adios','agrio',
      'agudo','ahora','album','aldea','algol','algun','altar','amigo','ancho','angel',
      'animo','antes','apoyo','arbol','arena','arroz','asado','atajo','atlas','avion',
      'ayuda','bahia','baile','balsa','banco','banda','barba','barca','barco','barro',
      'basta','bello','bicho','bingo','blusa','bolsa','bomba','borde','bordo','bravo',
      'brazo','breve','brisa','brote','buena','bueno','bulto','burro','busca','cable',
      'cabra','cacho','caida','calma','calor','calvo','campo','canal','carne','carta',
      'cause','celda','cerca','cerdo','cesta','chica','chico','chile','china','chino',
      'civil','clara','claro','clase','clave','clima','cobro','cocoa','coger','collar',
      'color','comer','comun','conde','coral','corte','costa','creer','crema','cruel',
      'crudo','cueva','culpa','curso','danza','dejar','delta','denso','digno','disco',
      'dolor','droga','ducha','dulce','durar','efecto','elite','ellos','email','enero',
      'envio','epoca','error','escala','estar','exito','extra','falta','falso','feliz',
      'feria','fibra','ficha','fiesta','final','firma','flaco','fondo','forma','frase',
      'freno','fresa','frito','fruta','fuego','fuera','fumar','gallo','ganar','ganga',
      'gastar','genio','gente','globo','golpe','gordo','gozar','grado','grano','grave',
      'gripe','grupo','guapo','hacer','hacha','hielo','hierba','hierro','hongo','honra',
      'hueco','hueso','humor','hurto','jabon','jamon','jaula','joven','jugar','juicio',
      'julio','junio','junto','jurar','justo','labor','lacar','ladro','largo','latir',
      'lavar','leche','lento','letra','libre','limon','lindo','linea','listo','llama',
      'llano','lleno','lleva','local','logro','lucha','lugar','madre','magia','maize',
      'malla','manga','mango','manto','marca','marea','mayor','media','medio','mejor',
      'melon','menor','mente','menta','merito','metal','metro','miedo','mojar','molde',
      'monte','moral','morir','mosca','motor','mover','mucho','mujer','mundo','musgo',
      'nacer','nadie','negro','nieve','noble','noche','norma','norte','novio','nueva',
      'nuevo','nunca','obeso','ocean','ochos','omega','opera','orden','oruga','padre',
      'pagar','pared','parra','parte','pasar','pasta','patio','pausa','pecho','pelar',
      'perro','piano','picar','piedra','pieza','pinta','plano','plata','plato','playa',
      'plaza','pleno','plomo','pluma','pobre','poder','polvo','poner','prima','primo',
      'prisa','probar','puede','puente','punto','queso','quien','quiza','radio','razon',
      'reina','reloj','renta','resto','rezar','ritmo','rocio','rodar','romper','rueda',
      'ruido','rumbo','rural','sabio','sacar','salir','salsa','salto','salud','santa',
      'santo','secar','sello','selva','seria','serio','siglo','signo','silla','sitio',
      'sobre','solar','sonar','soplar','sordo','suave','subir','sucio','suelo','sueno',
      'sumar','surco','tabla','tacto','talla','tanto','tarea','techo','tejer','tenaz',
      'tener','terco','tiara','tigre','tinto','tomar','torpe','torre','total','traer',
      'traje','tramo','trece','tribu','trigo','trono','tropa','tumor','turno','union',
      'untar','urban','valer','valor','vapor','vario','varon','vasto','vejez','veloz',
      'venta','verde','verso','video','vigor','virus','viuda','viaje','volar','vuelo',
      'vuelta','yerba','zarpa',
      'abierto','abogado','abrazo','abuelo','acabar','accion','aceite','acerca',
      'activar','actriz','acuerdo','ademas','afuera','agosto','ahogar','alcalde',
      'alegre','alfiler','alguno','aliento','alivio','almeja','alojar','alumno',
      'amable','amargo','amarillo','ambiente','america','amistoso','amplio','anciano',
      'animal','antiguo','aparato','aplazar','aprender','apretar','arreglo',
      'arriba','asegurar','asunto','ataque','atencion','atrever','aumentar',
      'ausente','avanzar','aventura','azucar','bailar','balance','bandera',
      'batalla','bebida','belleza','bloqueo','bondad','brigada','brillar','brincar',
      'brindar','caballo','cadena','calidad','callado','caminar','campana',
      'campeon','candado','cancion','capitan','captura','caramba','carrera',
      'castillo','celebrar','centavo','cerebro','cerveza','cigarro','circulo',
      'ciudad','cocinar','colegio','combate','comedor','comenzar','comision',
      'comprar','comprobar','conducir','conejo','confiar','conocer','consejo',
      'contacto','contento','control','corazon','correcto','cortina','criatura',
      'cultura','cumplir','curiosa','curioso','defensa','delante','deposito',
      'derecho','derrotar','desayuno','descubrir','deseo','destino','detalle',
      'dialogo','dibujo','dificil','dinero','director','disparo','diverso',
      'ejemplo','ejercicio','elegir','empezar','empleo','empresa','encender',
      'enemigo','energia','enfermo','enorme','ensalada','ensayo','entrada',
      'equipar','escalera','esconder','escribir','escuela','espacio','espanol',
      'espejo','esperanza','esquina','estrella','estudiar','evaluar','evitar',
      'familia','fantasia','febrero','felicidad','fenomeno','fortuna','fracaso',
      'frontera','galleta','gallina','general','gobierno','gracias','guardar',
      'guitarra','hermano','hermosa','hermoso','higuera','historia','hospital',
      'idioma','iglesia','imagen','imaginar','imponer','incluir','informe',
      'ingenio','instalar','invierno','izquierda','jardin','jornada',
      'justicia','juventud','lectura','leyenda','libertad','limitar','llamada',
      'llegada','maestro','maldito','manejar','mantener','maquina','maravilla',
      'marchar','materia','memoria','mensaje','mentira','mercado','milagro',
      'ministro','momento','montaña','mostrar','movimiento','nacional',
      'navidad','negocio','nervioso','ninguno','notable','noventa','octubre',
      'oficina','opinion','paquete','palabra','palacio','palanca','paloma',
      'pantalla','paraguas','pasillo','pelota','pensar','pequeno','perdido',
      'perfecto','periodo','permiso','persona','pescado','pintura','planeta',
      'platano','policia','politica','popular','posible','postura','potencia',
      'practica','pregunta','primero','primavera','princesa','problema',
      'proceso','producir','programa','proyecto','publica','publico',
      'querido','quinientos','rapido','realidad','recibir','recuerdo',
      'refugio','religion','resolver','repente','reserva','respeto',
      'respuesta','reunir','saborear','segundo','semana','senalar',
      'silencio','sistema','soldado','sombrero','tambien','telefono',
      'trabajo','tranquilo','treinta','tropical','turista','universo',
      'vacacion','ventana','verdura','vestido','violento','voluntad',
      'zapato','absoluto','anterior','aprender','articulo','asistente',
      'aventurar','brillante','cabecera','campesino','capacidad','capitulo',
      'castigar','catedral','chocolate','comunidad','concierto','construir',
      'continuar','corriente','cualquier','descubrir','despertar','diferente',
      'disfrutar','distinguir','educacion','encontrar','entender','entonces',
      'escritora','escritor','esperanza','establece','estructura','evidencia',
      'favorito','funcionar','garantia','habitante','importante','industria',
      'inteligente','interesar','investigar','izquierdo','kilogramo',
      'kilometro','literatura','mantequilla','maravilloso','necesitar',
      'noviembre','obligacion','organizar','particular','pendiente',
      'permanecer','plataforma','presidente','principio','propietario',
      'proteccion','publicar','recomendar','reconocer','referencia',
      'registrar','relacion','representar','resultado','septiembre',
      'significar','siguiente','situacion','suficiente','television',
      'territorio','tradicional','transporte','universidad','voluntario'
    ];

    for (const w of words) {
      this.words.add(this.normalize(w));
    }
    console.log(`📖 Diccionario embebido cargado: ${this.words.size} palabras`);
  }

  has(word) {
    return this.words.has(word);
  }

  getAll() {
    return this.words;
  }
}

module.exports = Dictionary;
