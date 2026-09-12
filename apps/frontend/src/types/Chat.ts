import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";

export interface Chat {
  name: string;
  last: string;
  pending?: number;
  uuid: string;
  bunchMaxSize: number;
  lastBunch: number;
}

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

interface MessageBunch {
  order: number;
  messages: Message[];
  size: number;
}

const CHATS_FOLDER = 'chats';

const getChatFilePath = (chatUuid: string) => `${CHATS_FOLDER}/${chatUuid}/metadata.json`;
const getBunchFilePath = (chatUuid: string, bunchOrder: number) =>
  `${CHATS_FOLDER}/${chatUuid}/bunch_${bunchOrder}.json`;

export const saveMessage = async (chat: Chat, message: Message): Promise<Chat> => {
  try {
    let currentBunchOrder = chat.lastBunch || 0;
    let bunch = await loadBunch(chat.uuid, currentBunchOrder);

    // Si el bunch actual no existe o ya alcanzó su límite máximo, creamos uno nuevo
    if (!bunch || bunch.size >= chat.bunchMaxSize) {
      currentBunchOrder = bunch ? currentBunchOrder + 1 : 0;
      bunch = {
        order: currentBunchOrder,
        messages: [],
        size: 0,
      };
    }

    // Añadimos el mensaje al bunch
    bunch.messages.push(message);
    bunch.size = bunch.messages.length;

    // Guardamos el archivo del bunch actualizado/nuevo
    await saveBunch(chat.uuid, bunch);

    // Actualizamos los metadatos del Chat
    const updatedChat: Chat = {
      ...chat,
      last: message.content,
      lastBunch: currentBunchOrder,
    };

    // Guardamos la metadata del chat actualizada
    await saveChatMetadata(updatedChat);

    return updatedChat;
  } catch (error) {
    console.error(`Error guardando mensaje en el chat ${chat.uuid}:`, error);
    throw error;
  }
};

/**
 * Carga un bunch específico según su orden (número de lote)
 */
export const loadBunch = async (chatUuid: string, bunchOrder: number): Promise<MessageBunch | null> => {
  try {
    const result = await Filesystem.readFile({
      path: getBunchFilePath(chatUuid, bunchOrder),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });

    return JSON.parse(result.data as string);
  } catch (error) {
    // Si el archivo no existe aún, retorna null
    return null;
  }
};

export const getAllChats = async (): Promise<Chat[]> => {
  try {
    // 1. Leemos el contenido de la carpeta principal de chats
    const result = await Filesystem.readdir({
      path: CHATS_FOLDER,
      directory: Directory.Data,
    });

    const chats: Chat[] = [];

    // 2. Iteramos sobre las entradas (cada subcarpeta representa un UUID de chat)
    for (const entry of result.files) {
      // En Capacitor, entry.name contiene el nombre de la carpeta/archivo
      const folderName = typeof entry === 'string' ? entry : entry.name;

      // Intentamos cargar la metadata de cada subcarpeta
      const chatMetadata = await loadChatMetadata(folderName);

      if (chatMetadata) {
        chats.push(chatMetadata);
      }
    }

    // 3. Opcional: Ordenamos los chats por actividad (si agregas timestamp) o alfabéticamente
    return chats;
  } catch (error) {
    console.warn("No se encontraron chats o la carpeta no existe aún:", error);
    return [];
  }
};

/**
 * Carga los metadatos de un Chat específico
 */
export const loadChatMetadata = async (chatUuid: string): Promise<Chat | null> => {
  try {
    const result = await Filesystem.readFile({
      path: getChatFilePath(chatUuid),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });

    return JSON.parse(result.data as string);
  } catch (error) {
    return null;
  }
};

/**
 * Guarda físicamente el archivo del bunch
 */

const saveBunch = async (chatUuid: string, bunch: MessageBunch): Promise<void> => {
  await Filesystem.writeFile({
    path: getBunchFilePath(chatUuid, bunch.order),
    data: JSON.stringify(bunch, null, 2),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true, // Crea las carpetas del chat automáticamente si no existen
  });
};

/**
 * Guarda los metadatos globales del Chat
 */
export const saveChatMetadata = async (chat: Chat): Promise<void> => {
  await Filesystem.writeFile({
    path: getChatFilePath(chat.uuid),
    data: JSON.stringify(chat, null, 2),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true,
  });
};

export const deleteAllChats = async (): Promise<void> => {
  try {
    await Filesystem.rmdir({
      path: CHATS_FOLDER,
      directory: Directory.Data,
      recursive: true, // Importante: elimina carpetas internas y todos los archivos bunch
    });
    console.log("Todos los chats han sido borrados con éxito.");
  } catch (error) {
    console.warn("No se pudo eliminar la carpeta de chats (posiblemente ya no existía):", error);
  }
};
