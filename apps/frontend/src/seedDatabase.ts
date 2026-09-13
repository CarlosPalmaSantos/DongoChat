import { Filesystem, Directory } from "@capacitor/filesystem";
import { type Chat, type Message, saveMessage } from "./types/Chat"; // Ajusta la ruta a tu módulo

const CHATS_FOLDER = 'chats';

// Datos fácticos para los chats de prueba
const INITIAL_CHATS: Omit<Chat, 'last' | 'lastBunch'>[] = [
  {
    uuid: 'chat-dev-01',
    name: 'Soporte Técnico',
    pending: 2,
    bunchMaxSize: 5, // Límite pequeño para probar la creación de varios bunches rápidamente
  },
  {
    uuid: 'chat-dev-02',
    name: 'Equipo de Desarrollo',
    pending: 0,
    bunchMaxSize: 10,
  },
];

// Mensajes simulados para llenar los lotes
const MOCK_MESSAGES = [
  "¡Hola! Bienvenidos a la aplicación.",
  "Este es un mensaje de prueba inicial.",
  "Probando el sistema de guardado por Bunch/Lotes.",
  "¿Cómo va la optimización del scroll?",
  "Todo parece funcionar de manera muy fluida.",
  "Agregando un mensaje más para forzar el límite del lote...",
  "Este mensaje debería estrenar un nuevo archivo de Bunch.",
  "¡Increíble! La carga en bloques evita tirones de memoria.",
  "Mas mensajes de pruebas 0",
  "Mas mensajes de pruebas 1",
  "Mas mensajes de pruebas 2",
  "Mas mensajes de pruebas 3",
  "Mas mensajes de pruebas 4",
  "Mas mensajes de pruebas 5",
  "Mas mensajes de pruebas 6",
  "Mas mensajes de pruebas 7",
  "Mas mensajes de pruebas 8",
  "Mas mensajes de pruebas 9",
];

/**
 * Inicializa la estructura de datos en el dispositivo si no existe previa.
 */
export const initializeMockData = async (): Promise<void> => {
  try {
    // 1. Verificamos si la carpeta principal existe leyendo su contenido
    await Filesystem.readdir({
      path: CHATS_FOLDER,
      directory: Directory.Data,
    });

    console.log("Estructura de chats existente. Omitiendo seed de datos.");
  } catch (error) {
    // Si la lectura falla, asumimos que no existe la carpeta y procedemos a crearla
    console.log("No se encontraron chats previos. Generando datos de prueba...");

    for (const chatSeed of INITIAL_CHATS) {
      let currentChat: Chat = {
        ...chatSeed,
        last: '',
        lastBunch: 0,
      };

      // 2. Generamos una serie de mensajes simulados para cada chat
      for (let i = 0; i < MOCK_MESSAGES.length; i++) {
        const message: Message = {
          id: `msg-${chatSeed.uuid}-${i + 1}`,
          receiver: chatSeed.name,
          sender: i % 2 === 0 ? 'other' : 'me',
          content: `${MOCK_MESSAGES[i]} (ID: ${i + 1})`,
          timestamp: Date.now() - (MOCK_MESSAGES.length - i) * 60000,
        };

        // Reutilizamos la función del sistema para autogenerar los bunches
        currentChat = await saveMessage(currentChat, message);
      }
    }

    console.log("Datos de prueba e historial de Bunches creados exitosamente.");
  }
};
