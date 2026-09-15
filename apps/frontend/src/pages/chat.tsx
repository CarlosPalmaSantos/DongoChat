import { AppBar, Avatar, Box, IconButton, Paper, TextField, Toolbar, Typography, CircularProgress } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import { loadBunch, saveMessage, type Chat } from "../types/Chat.ts";
import { useConnection } from "../hooks/useConnection.tsx";
import type { Message } from "dongo-shared";
import { createTranslator } from 'short-uuid';

type MenuState = {
  message: Message;
  top: number;
  left?: number;
  right?: number;
};

const MessageItem = React.memo(
  ({
    message,
    style,
    onContextMenu,
  }: {
    message: Message;
    style: 'me' | 'other';
    onContextMenu: (message: Message, rect: DOMRect) => void;
  }) => {
    const ref = React.useRef<HTMLDivElement>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();

      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;

      onContextMenu(message, rect);
    };

    return (
      <Box
        sx={{ display: 'flex', justifyContent: style === 'me' ? 'flex-end' : 'flex-start' }}
        onContextMenu={handleContextMenu}
      >
        <Paper
          ref={ref}
          variant="outlined"
          sx={{
            p: 2,
            maxWidth: '80%',
            border: 0,
            borderRadius: 1.25,
            color: (theme) =>
              style === 'me'
                ? theme.palette.primary.contrastText
                : theme.palette.secondary.contrastText,
            bgcolor: (theme) =>
              style === 'me'
                ? theme.palette.primary.main
                : theme.palette.secondary.main,
          }}
        >
          <Typography>{message.content}</Typography>
        </Paper>
      </Box>
    );
  },
);

export default function ChatPage({ chat, clearSelectedChat }: { chat: Chat, clearSelectedChat: () => void, me: string }) {
  const [message, setMessage] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const { socket, conn, editChat } = useConnection();
  const shortify = createTranslator()

  const currentBunchRef = useRef<number>(chat.lastBunch);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const isSendingRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [menuState, setMenuState] = useState<MenuState | null>(null);


  const handleOpenMenu = useCallback((msg: Message, rect: DOMRect) => {
    const width = 220;

    setMenuState(
      rect.right + width <= window.innerWidth
        ? { message: msg, top: rect.top, left: rect.right + 8 }
        : { message: msg, top: rect.top, right: window.innerWidth - rect.left + 8 },
    );
  }, []);

  useEffect(() => {
    if (!menuState) return;


    const closeMenu = () => setMenuState(null);

    const handlePointerDown = () => closeMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuState]);

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
            return prev;
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


  // TODO: mover el envío parcialmente al Provider
  const handleSendMessage = async () => {
    if (isSendingRef.current) return;
    if (message.trim() === '') return;

    isSendingRef.current = true;
    const prevmsg: Partial<Message> = {
      sender: conn!.user!.name,
      receiver: chat.name,
      timestamp: Date.now(),
      content: message,
    };


    // TODO: Utilizar el mensaje devuelto por el servidor
    setMessage('');
    inputRef.current?.focus();

    // TODO: Utilizar asíncrono, para ello utilizar mensajes temporales
    const msg = await socket?.emitWithAck('send-message', prevmsg);
    // TODO: modificación del chat en memoria tb

    setChatHistory((prev) => [...prev, msg]);

    saveMessage(chat, msg); // No esperar para mas fluidez

    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }
    });
    isSendingRef.current = false;
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
        onScroll={() => setMenuState(null)}
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
            message={v}
            style={v.sender === conn?.user?.id ? 'me' : 'other'}
            onContextMenu={handleOpenMenu}
          />
        ))}

        {hasMore && (
          <Box ref={topSentinelRef} sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
            {loading && <CircularProgress size={24} />}
          </Box>
        )}
      </Box>

      {/* Única instancia del menú contextual para todo el chat */}
      {menuState && (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            top: menuState.top,
            left: menuState.left,
            right: menuState.right,
            p: 2,
            zIndex: 1500,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-all' }}>ID:</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-all' }}>
              {shortify.fromUUID(menuState.message.id)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-all' }}>Sender:</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-all' }}>
              {menuState.message.sender}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-all' }}>Receiver:</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-all' }}>
              {menuState.message.receiver}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-all' }}>Timestamp:</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-all' }}>
              {menuState.message.timestamp}
            </Typography>
          </Box>


        </Paper>
      )}

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
          inputRef={inputRef}
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
