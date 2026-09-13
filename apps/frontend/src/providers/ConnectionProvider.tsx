import { useEffect, useState, type ReactNode } from "react";
import { loadConnectionSettings, saveConnectionSettings, type ConnectionSettings } from "../types/User";
import { io, Socket } from "socket.io-client";
import { ConnectionContext } from "../contexts/ConnectionContext";

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [conn, setConn] = useState<ConnectionSettings>();
  const [socket, setSocket] = useState<Socket>();

  useEffect(() => {
    loadConnectionSettings().then(setConn);
  }, []);

  useEffect(() => {
    if (!conn) return;

    saveConnectionSettings(conn);

    let activeSocket: Socket | undefined; // <- Variable local para atrapar la instancia

    if (conn.ip && conn.name) {
      activeSocket = io(conn.ip, {
        auth: {
          name: conn.name,
          pass: conn.token,
        },
      });

      setSocket(activeSocket); // Actualizamos el estado para los demás componentes
    }

    // Función de limpieza
    return () => {
      activeSocket?.disconnect(); // Desconecta la instancia real que creamos arriba
      setSocket(undefined);
    };
  }, [conn]);

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

  return (
    <ConnectionContext.Provider
      value={{
        ping,
        conn,
        editConn,
        socket
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}
