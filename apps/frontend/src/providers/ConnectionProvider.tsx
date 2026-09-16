import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { loadConnectionSettings, saveConnectionSettings, type ConnectionSettings } from "../types/User";
import { io, Socket } from "socket.io-client";
import { ConnectionContext } from "../contexts/ConnectionContext";
import { getAllChats, saveChatMetadata, saveMessage, type Chat } from "../types/Chat";
import { type Message, type User } from "dongo-shared";
import { useLog } from "../hooks/useLog";

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [conn, setConn] = useState<ConnectionSettings>();
  const [socket, setSocket] = useState<Socket>();
  const [chats, setChats] = useState<Record<string, Chat>>({});
  const logger = useLog();

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  // Ref "espejo" del socket: nos deja leer el socket vigente dentro de
  // callbacks (como handleIncomingMessage) SIN que ese callback tenga que
  // declarar `socket` como dependencia. Eso es lo que rompe el ciclo:
  // el efecto que crea el socket ya no se re-dispara cada vez que el
  // socket cambia.
  const socketRef = useRef<Socket | undefined>(undefined);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // Punto único para emitir de forma segura sin repetir el chequeo de
  // undefined en cada sitio que lo use.
  const emitSafe = useCallback((event: string, data: unknown) => {
    if (!socketRef.current) {
      logger.warn(`Tried to emit '${event}' with no active socket`);
      return;
    }
    socketRef.current.emit(event, data);
  }, []);

  // Igual para conn: lo usamos dentro de handleIncomingMessage sin que
  // forme parte de sus dependencias (así handleIncomingMessage no cambia
  // de identidad cada vez que conn se actualiza levemente).
  const connRef = useRef<ConnectionSettings | undefined>(undefined);
  useEffect(() => {
    connRef.current = conn;
  }, [conn]);

  useEffect(() => {
    loadConnectionSettings().then(setConn);
    getAllChats().then(c => setChats(Object.fromEntries(c.map(c1 => ([c1.uuid, c1])))));
  }, []);

  const saveQueuesRef = useRef<Map<string, Promise<void>>>(new Map());

  // Identidad estable: no depende de `socket` ni de `conn`, así que nunca
  // provoca que otros efectos se re-ejecuten por su culpa.
  const handleIncomingMessage = useCallback(async (msg: Message) => {
    logger.debug('incoming msg', msg);

    const chatUuid = msg.sender;

    const previousQueue = saveQueuesRef.current.get(chatUuid) ?? Promise.resolve();

    const currentQueue = previousQueue.then(async () => {
      const prevChat = chatsRef.current[chatUuid];

      const currentChat: Chat = prevChat ?? {
        uuid: chatUuid,
        name: chatUuid,
        last: '',
        lastTimestamp: Date.now(),
        pending: 0,
        bunchMaxSize: 100,
        lastBunch: 0,
      };

      const chatToUpdate: Chat = {
        ...currentChat,
        last: msg.content,
        lastTimestamp: Date.now(),
        pending: (currentChat.pending ?? 0) + 1,
      };

      const updatedChat = await saveMessage(chatToUpdate, {
        id: msg.id,
        timestamp: msg.timestamp,
        sender: msg.sender,
        receiver: connRef.current!.user!.name!,
        content: msg.content,
      });

      chatsRef.current = {
        ...chatsRef.current,
        [chatUuid]: updatedChat,
      };

      setChats(prev => ({
        ...prev,
        [chatUuid]: updatedChat,
      }));

      emitSafe('ack-message', msg.id);
    });

    // Guardamos la promesa actual como cola
    saveQueuesRef.current.set(chatUuid, currentQueue);

    try {
      await currentQueue;
    } finally {
      // Solo eliminamos la cola si sigue siendo la última
      if (saveQueuesRef.current.get(chatUuid) === currentQueue) {
        saveQueuesRef.current.delete(chatUuid);
      }
    }
  }, [emitSafe]);

  useEffect(() => {
    if (!socket) return;

    const currentSocket = socket;

    currentSocket.on('inbox-message', handleIncomingMessage);

    return () => {
      currentSocket.off('inbox-message', handleIncomingMessage);
    };
  }, [socket, handleIncomingMessage]);

  // Este efecto ahora depende SOLO de `conn`. handleIncomingMessage tiene
  // identidad estable (deps: []), así que ya no puede disparar un re-run
  // de este efecto por sí sola.
  useEffect(() => {
    if (!conn) return;

    saveConnectionSettings(conn);
    logger.log('conn modified', conn);

    if (!conn.ip || !conn.user) return;

    const activeSocket = io(conn.ip, {
      auth: conn.user,
    });

    const onConnectedInbox = async (d: Record<string, Message>) => {
      logger.log('connected inbox', d);
      // Procesamos en orden y esperamos cada guardado antes de mandar el
      // ack, para no perder mensajes si la app vuelve a segundo plano
      // justo después de recibir el inbox.
      for (const msg of Object.values(d)) {
        await handleIncomingMessage(msg);
      }
      activeSocket.emit('ack-connected-inbox');
      setSocket(activeSocket);
    };

    activeSocket.on('connected-inbox', onConnectedInbox);

    return () => {
      activeSocket.off('connected-inbox', onConnectedInbox);
      activeSocket.disconnect();
      setSocket(undefined);
    };
  }, [conn, handleIncomingMessage]);

  function emit(event: string, data: unknown) {
    return new Promise((resolve) => {
      socket?.emit(event, data, (res: unknown) => resolve(res));
    });
  }

  async function ping(): Promise<number> {
    const prev = Date.now();
    try {
      const res = (await emit('ping', '')) as string;
      const post = Date.now();
      if (res !== 'pong') return -1;
      return post - prev;
    } catch {
      return -1;
    }
  }

  function editConn(val: Partial<ConnectionSettings>) {
    setConn((prev) => ({ ...prev, ...val }));
  }

  function editUser(val: User) {
    setConn(prev => ({
      ...prev, user: val as User
    }));
  }

  function editChat(chat: Chat) {
    setChats(prev => {
      saveChatMetadata(chat);
      return { ...prev, [chat.uuid]: chat };
    });
  }

  return (
    <ConnectionContext.Provider
      value={{
        ping,
        conn,
        editConn,
        socket,
        chats,
        editChat,
        editUser,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}
