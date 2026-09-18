import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { saveConnectionSettings, type ConnectionSettings } from "../types/User";
import { io, Socket } from "socket.io-client";
import { ConnectionContext } from "../contexts/ConnectionContext";
import { getAllChats, saveChatMetadata, saveMessage, type Chat } from "../types/Chat";
import { type Message, type User } from "dongo-shared";
import { useLog } from "../hooks/useLog";
import { Backdrop, CircularProgress } from "@mui/material";

export function ConnectionProvider({ children, selectedChat, conn, setConn }:
  {
    children: ReactNode,
    selectedChat: Chat | "settings" | null,
    conn: ConnectionSettings | undefined,
    setConn: React.Dispatch<React.SetStateAction<ConnectionSettings | undefined>>,
  }) {
  const [socket, setSocket] = useState<Socket>();
  // Estado de conexión para la UI: permite distinguir "nunca conectado",
  // "conectado", "reconectando tras una caída" y "desconectado sin
  // reintentos en curso" (p.ej. mientras se agota reconnectionAttempts,
  // que aquí está puesto a Infinity, o justo antes del primer intento).
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  >('idle');
  const [chats, setChats] = useState<Record<string, Chat>>({});
  const logger = useLog();

  // Ref estable para el logger: evita que efectos/callbacks dependan
  // de una referencia de logger que puede cambiar en cada render.
  const loggerRef = useRef(logger);
  useEffect(() => {
    loggerRef.current = logger;
  }, [logger]);

  useEffect(() => {
    loggerRef.current.log(`Cambio SC ${selectedChat}`);
  }, [selectedChat]);

  const selectedChatRef = useRef(selectedChat);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const socketRef = useRef<Socket | undefined>(undefined);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const emitSafe = useCallback((event: string, data: unknown) => {
    if (!socketRef.current) {
      loggerRef.current.warn(`Tried to emit '${event}' with no active socket`);
      return;
    }
    socketRef.current.emit(event, data);
  }, []);

  const connRef = useRef<ConnectionSettings | undefined>(undefined);
  useEffect(() => {
    connRef.current = conn;
  }, [conn]);

  useEffect(() => {
    getAllChats().then(c => setChats(Object.fromEntries(c.map(c1 => ([c1.uuid, c1])))));
  }, [conn]);

  const saveQueuesRef = useRef<Map<string, Promise<void>>>(new Map());

  const handleIncomingMessage = useCallback(async (msg: Message) => {
    loggerRef.current.debug('incoming msg', msg);

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
        pending: (currentChat.pending ?? 0) + (!selectedChatRef.current ? 1 : 0),
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

    saveQueuesRef.current.set(chatUuid, currentQueue);

    try {
      await currentQueue;
    } finally {
      if (saveQueuesRef.current.get(chatUuid) === currentQueue) {
        saveQueuesRef.current.delete(chatUuid);
      }
    }
  }, [emitSafe]);

  // Ref estable para handleIncomingMessage: evita que el efecto del socket
  // se re-ejecute solo porque esta función cambió de referencia.
  const handleIncomingMessageRef = useRef(handleIncomingMessage);
  useEffect(() => {
    handleIncomingMessageRef.current = handleIncomingMessage;
  }, [handleIncomingMessage]);

  useEffect(() => {
    if (!socket) return;

    const currentSocket = socket;
    const listener = (msg: Message) => handleIncomingMessageRef.current(msg);
    currentSocket.on('inbox-message', listener);

    return () => {
      currentSocket.off('inbox-message', listener);
    };
  }, [socket]);

  // Manejo del ciclo de vida del Socket.
  // IMPORTANTE: este efecto depende SOLO de los valores primitivos que
  // identifican la conexión real (ip, user). NO depende de `socket` ni de
  // `connected`, porque eso provocaba el bucle: cada disconnect/connect_error
  // ponía socket en undefined, lo que volvía a disparar el efecto y creaba
  // una instancia de socket nueva mientras la anterior seguía reintentando
  // reconectar por su cuenta (comportamiento por defecto de socket.io-client).
  //
  // Ahora se crea UNA sola instancia por conexión y se deja que socket.io
  // gestione sus propios reintentos (reconnection: true). El estado
  // `connected` solo se usa para reflejar el estado en la UI.
  useEffect(() => {
    if (!conn?.ip || !conn?.user) return;

    saveConnectionSettings(conn);
    loggerRef.current.log('conn modified', conn);

    const activeSocket = io(conn.ip, {
      auth: conn.user,
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // La instancia se registra una única vez al crearse; no se recrea
    // en cada evento de conexión/desconexión.
    setSocket(activeSocket);
    setStatus('connecting');

    // Evento 1: Conexión Exitosa (primera vez o tras una reconexión)
    activeSocket.on('connect', () => {
      loggerRef.current.log(`Socket conectado con éxito. ID: ${activeSocket.id}`);
      setStatus('connected');
    });

    // --- Eventos internos de reconexión de socket.io-client ---
    // Se disparan automáticamente cuando, tras un 'disconnect', el propio
    // socket intenta reconectar solo (gracias a reconnection: true).

    // Se dispara justo antes de cada intento de reconexión.
    activeSocket.io.on('reconnect_attempt', (attempt: number) => {
      loggerRef.current.log(`Intento de reconexión nº ${attempt}...`);
      setStatus('reconnecting');
    });

    // Se dispara cuando un intento de reconexión ha tenido éxito.
    // (activeSocket.on('connect') también se dispara en este caso,
    // así que esto es solo para loguear el número de intentos que costó).
    activeSocket.io.on('reconnect', (attempt: number) => {
      loggerRef.current.log(`Reconectado tras ${attempt} intento(s).`);
    });

    // Se dispara cuando un intento individual de reconexión falla.
    activeSocket.io.on('reconnect_error', (err: Error) => {
      loggerRef.current.warn(`Fallo en intento de reconexión: ${err.message}`);
    });

    // Solo se dispara si reconnectionAttempts es finito y se agotan todos.
    // Con Infinity nunca debería llegar a dispararse, pero se deja por
    // seguridad ante un cambio futuro de configuración.
    activeSocket.io.on('reconnect_failed', () => {
      loggerRef.current.warn('Se agotaron los intentos de reconexión.');
      setStatus('disconnected');
    });

    // Evento 2: Procesamiento del inbox inicial
    const onConnectedInbox = async (d: Record<string, Message>) => {
      loggerRef.current.log('connected inbox', d);
      for (const msg of Object.values(d)) {
        await handleIncomingMessageRef.current(msg);
      }
      activeSocket.emit('ack-connected-inbox');
    };

    activeSocket.on('connected-inbox', onConnectedInbox);

    // Evento 3: Error de Conexión o Autenticación
    activeSocket.on('connect_error', (err) => {
      loggerRef.current.warn(`Error de conexión socket: ${err.message}`);
      setStatus('reconnecting');
      // No se destruye ni recrea el socket aquí: socket.io-client ya
      // reintentará automáticamente según reconnection/reconnectionAttempts.
    });

    // Evento 4: Desconexión
    activeSocket.on('disconnect', (reason) => {
      loggerRef.current.warn(`Socket desconectado: ${reason}`);

      if (reason === 'io server disconnect') {
        // El servidor cerró la conexión explícitamente: socket.io-client
        // NO reintenta solo en este caso, así que forzamos el intento
        // manualmente. connect() dispara internamente el ciclo normal
        // de reconexión (reconnect_attempt, etc. no aplican aquí porque
        // es un intento manual, así que lo marcamos a mano).
        setStatus('reconnecting');
        activeSocket.connect();
      } else {
        // Resto de casos (red caída, transporte cerrado, ping timeout...):
        // socket.io-client reintenta solo y disparará 'reconnect_attempt'.
        setStatus('reconnecting');
      }
    });

    return () => {
      activeSocket.off('connected-inbox', onConnectedInbox);
      activeSocket.off('connect');
      activeSocket.off('connect_error');
      activeSocket.off('disconnect');
      activeSocket.io.off('reconnect_attempt');
      activeSocket.io.off('reconnect');
      activeSocket.io.off('reconnect_error');
      activeSocket.io.off('reconnect_failed');
      activeSocket.disconnect();
      setSocket(undefined);
      setStatus('idle');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn?.ip, conn?.user?.name, conn?.user?.pass]);

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

  const sendMessage = useCallback(async (chat: Chat, message: Message): Promise<Message> => {
    if (!socketRef.current) {
      loggerRef.current.warn('Tried to send message with no active socket');
      throw new Error('No active socket');
    }

    const msg = await socketRef.current.emitWithAck('send-message', message) as Message;

    loggerRef.current.log('saving chat history', msg);
    const updatedChat = await saveMessage(chat, msg);
    setChats(prev => ({ ...prev, [updatedChat.uuid]: updatedChat }));

    return msg;
  }, []);

  // Permite forzar un intento de reconexión manual (p.ej. botón "Reconectar"
  // en la UI) sin destruir ni recrear la instancia del socket.
  const forceReconnect = useCallback(() => {
    if (!socketRef.current) {
      loggerRef.current.warn('No hay socket para reconectar');
      return;
    }
    socketRef.current.connect();
  }, []);

  return (
    <ConnectionContext.Provider
      value={{
        ping,
        conn,
        editConn,
        socket,
        status,
        chats,
        editChat,
        editUser,
        sendMessage,
        forceReconnect,
      }}
    >
      {children}
      <Backdrop open={!!socket && status !== 'connected'}>
        <CircularProgress color='primary' />
      </Backdrop>
    </ConnectionContext.Provider>
  );
}
