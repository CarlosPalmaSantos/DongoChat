import { AppBar, Avatar, Box, IconButton, Paper, TextField, Toolbar, Typography, CircularProgress } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import { loadBunch, saveMessage, type Chat } from "../types/Chat.ts";
import { useConnection } from "../hooks/useConnection.tsx";
import type { Message } from "dongo-shared";

const MessageItem = React.memo(({ message, style }: { message: string, style: 'me' | 'other' }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        alignSelf: style === 'me' ? "self-end" : "self-start",
        maxWidth: '80%',
        border: 0,
        borderRadius: 1.25,
        color: (theme) => style === 'me' ? theme.palette.primary.contrastText : theme.palette.secondary.contrastText,
        bgcolor: (theme) => style === 'me' ? theme.palette.primary.main : theme.palette.secondary.main
      }}
    >
      <Typography variant="body1">{message}</Typography>
    </Paper>
  </Box>
));

export default function ChatPage({ chat, clearSelectedChat }: { chat: Chat, clearSelectedChat: () => void, me: string }) {
  const [message, setMessage] = useState<string>(""); const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const { socket, conn, editChat } = useConnection();

  const currentBunchRef = useRef<number>(chat.lastBunch);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const isSendingRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const initChat = async () => {
      setLoading(true);
      currentBunchRef.current = chat.lastBunch;

      const bunch = await loadBunch(chat.uuid, chat.lastBunch);
      if (isMounted) {
        if (bunch && bunch.messages) {
          setChatHistory(bunch.messages);
          setHasMore(chat.lastBunch > 0);
        } else {
          setChatHistory([]);
          setHasMore(false);
        }
        setLoading(false);

        editChat({ ...chat, pending: 0 })
      }

      function handleMessage(msg: Message) {
        if (msg.sender !== chat.name) return;

        setChatHistory(prev => {
          const exists = prev.some(item => item.id === msg.id);

          if (exists) {
            return prev; // Devolvemos el estado sin cambios
          }
          return [...prev, msg];
        });

        saveMessage(chat, msg)
      }

      socket?.on('inbox-message', handleMessage)

      return () => { socket?.off('inbox-message', handleMessage) }
    };

    initChat();

    return () => {
      isMounted = false;
    };
  }, [chat.uuid, chat.lastBunch]);

  const loadMoreMessages = useCallback(async () => {
    if (loading || !hasMore || isSendingRef.current || currentBunchRef.current <= 0) return;

    setLoading(true);
    const nextBunchToLoad = currentBunchRef.current - 1;
    console.log(`Cargando bunch anterior: bunch_${nextBunchToLoad}.json`);

    const bunch = await loadBunch(chat.uuid, nextBunchToLoad);

    if (bunch && bunch.messages.length > 0) {
      currentBunchRef.current = nextBunchToLoad;
      // Anteponemos los mensajes del bunch más antiguo al historial actual
      setChatHistory((prev) => {
        const existingIds = new Set(prev.map((msg) => msg.id));
        const newUniqueMessages = bunch.messages.filter((msg) => !existingIds.has(msg.id));
        return [...newUniqueMessages, ...prev];
      });
      setHasMore(nextBunchToLoad > 0);
    } else {
      setHasMore(false);
    }

    setLoading(false);
  }, [loading, hasMore, chat.uuid]);

  // 3. Observer para el scroll infinito hacia arriba
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isSendingRef.current && !loading && hasMore) {
          loadMoreMessages();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreMessages, loading, hasMore]);

  // 4. Enviar mensaje
  const handleSendMessage = async () => {
    if (message.trim() === '') return;

    isSendingRef.current = true;
    const prevmsg: Partial<Message> = {
      sender: conn!.name!,
      receiver: chat.name,
      timestamp: Date.now(),
      content: message,
    };


    // TODO: Utilizar el mensaje devuelto por el servidor
    const msg = await socket?.emitWithAck('send-message', prevmsg);

    // Actualizar UI en memoria
    setChatHistory((prev) => [...prev, msg]);
    setMessage('');

    // Guardar en el filesystem (se encarga de crear nuevo bunch si bunchMaxSize se supera)
    await saveMessage(chat, msg);

    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }
    });


  };

  return (
    <Paper
      square
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          pt: 'calc(env(safe-area-inset-top) + 8px)',
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={clearSelectedChat}>
            <ArrowBackIcon />
          </IconButton>
          <Avatar sx={{ width: 36, height: 36 }}>{chat.name[0]}</Avatar>
          <Typography variant="h6" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
            {chat.name}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        ref={containerRef}
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column-reverse",
          gap: 1,
          p: 2,
          scrollBehavior: 'smooth',
        }}
      >
        {/* Renderizamos de forma segura asegurando que chatHistory siempre es array */}
        {(chatHistory || []).slice().sort((a, b) => b.timestamp - a.timestamp).map((v) => (
          <MessageItem
            key={v.id}
            message={v.content}
            style={v.sender === conn?.name ? 'me' : 'other'}
          />
        ))}

        {hasMore && (
          <Box ref={topSentinelRef} sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
            {loading && <CircularProgress size={24} />}
          </Box>
        )}
      </Box>

      <Box
        sx={{
          p: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 1,
          flexShrink: 0,
          pb: 'calc(env(safe-area-inset-bottom) + 12px)',
        }}
      >
        <TextField
          multiline
          maxRows={4}
          fullWidth
          placeholder="Escribe un mensaje..."
          variant="outlined"
          size="small"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <IconButton color="primary" onClick={handleSendMessage}>
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );
}
