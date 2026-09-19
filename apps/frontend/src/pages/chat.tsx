import { AppBar, Avatar, Box, IconButton, Paper, TextField, Toolbar, Typography, CircularProgress, Card, Stack } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import { loadBunch, saveMessage, type Chat } from "../types/Chat.ts";
import { useConnection } from "../hooks/useConnection.tsx";
import type { Message } from "dongo-shared";

import { AnimatePresence, motion } from 'framer-motion';
import { generate } from 'short-uuid'

const MessageItem = React.memo(
  ({
    message,
    style,
    debugMessage,
    setDebugMessage,
  }: {
    message: Message;
    style: 'me' | 'other';
    debugMessage?: string;
    setDebugMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  }) => {
    const debugging = debugMessage === message.id;

    const ref = React.useRef<HTMLDivElement>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();

      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;

      setDebugMessage(prev => {
        if (prev === message.id) return undefined;
        return message.id;
      });
    };

    return (
      <Box
        sx={{ display: 'flex', justifyContent: style === 'me' ? 'flex-end' : 'flex-start', bgcolor: 'transparent' }}
        onContextMenu={handleContextMenu}
      >
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            flexDirection: style === 'me' ? 'row-reverse' : 'row',
            bgcolor: 'transparent',
            gap: 1,
          }}
        >
          <Paper
            ref={ref}
            variant="outlined"
            sx={{
              display: 'flex',
              maxWidth: '60%',
              p: 1.5,
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
            <Typography
              sx={{
                minWidth: 0,
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {message.content}
            </Typography>
          </Paper>

          <AnimatePresence initial={false}>
            {debugging && (
              <motion.div
                key={`msg-debug-${message.id}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                style={{ willChange: 'height, opacity', transform: 'translateZ(0)', transformOrigin: 'top', overflow: 'hidden' }}
              >
                <Card
                  sx={{
                    px: 1,
                    py: 0.75,
                    bgcolor: (theme) => theme.palette.background.surfaceVariant,
                    color: (theme) => theme.palette.background.onSurfaceVariant,
                  }}
                >
                  <Stack spacing={0.25}>
                    {[
                      ['Id', message.id],
                      ['Sender', message.sender],
                      ['Receiver', message.receiver],
                      ['TimeStamp', message.timestamp],
                    ].map(([label, value]) => (
                      <Stack key={label} direction="row" spacing={1}>
                        <Typography
                          variant="caption"
                          sx={{ opacity: 0.7, minWidth: 68, flexShrink: 0 }}
                        >
                          {label}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            minWidth: 0,
                            overflowWrap: 'break-word',
                            wordBreak: 'break-word',
                          }}
                        >
                          {value}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </Box>
    );
  },
);
export default function ChatPage({ chat, clearSelectedChat }: { chat: Chat, clearSelectedChat: () => void, me: string }) {
  const [message, setMessage] = useState<string>("");
  const [debugMessage, setDebugMessage] = useState<string>();

  const [chatHistory, setChatHistory] = useState<Record<string, Message>>({});
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const { socket, conn, editChat, sendMessage } = useConnection();

  const currentBunchRef = useRef<number>(chat.lastBunch);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const isSendingRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!debugMessage) return;


    const closeMenu = () => setDebugMessage(undefined);

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
  }, [debugMessage]);

  // Efecto 1: cargar historial inicial cuando cambia el chat
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoading(true);
      currentBunchRef.current = chat.lastBunch;

      const bunch = await loadBunch(chat.uuid, chat.lastBunch);
      if (!isMounted) return;

      if (bunch && bunch.messages) {
        setChatHistory(Object.fromEntries(bunch.messages.map(m => [m.id, m])));
        setHasMore(chat.lastBunch > 0);
      } else {
        setChatHistory({});
        setHasMore(false);
      }
      setLoading(false);

      editChat({ ...chat, pending: 0 });
    }
    init();

    return () => {
      isMounted = false;
    };
  }, [chat.uuid, chat.lastBunch]);

  // Efecto 2: suscribirse a mensajes entrantes, con socket como dependencia real
  useEffect(() => {
    if (!socket) return;

    function handleMessage(msg: Message) {
      if (msg.sender !== chat.name) return;
      setChatHistory(prev => ({ [msg.id]: msg, ...prev }));
      saveMessage(chat, msg);
    }

    socket.on('inbox-message', handleMessage);
    return () => {
      socket.off('inbox-message', handleMessage);
    };
  }, [socket, chat.uuid, chat.name]);

  const loadMoreMessages = useCallback(async () => {
    if (loading || !hasMore || isSendingRef.current || currentBunchRef.current <= 0) return;

    setLoading(true);
    const nextBunchToLoad = currentBunchRef.current - 1;
    console.log(`Cargando bunch anterior: bunch_${nextBunchToLoad}.json`);

    const bunch = await loadBunch(chat.uuid, nextBunchToLoad);

    if (bunch && bunch.messages.length > 0) {
      currentBunchRef.current = nextBunchToLoad;

      setChatHistory((prev) => {
        const bunchMessages = Object.fromEntries(bunch.messages.map(m => [m.id, m]))
        return { ...bunchMessages, ...prev };
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
  const messageRef = useRef(message);
  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  const handleSendMessage = useCallback(async () => {
    inputRef.current?.focus();

    if (isSendingRef.current) return;
    if (messageRef.current.trim() === '') return;

    isSendingRef.current = true;
    const content = messageRef.current;
    setMessage('');

    const prevmsg: Message = {
      id: generate(),
      sender: conn!.user!.id,
      receiver: chat.uuid,
      timestamp: Date.now(),
      content,
    };

    try {
      const msg = await sendMessage(chat, prevmsg);
      setChatHistory((prev) => ({ [msg.id]: msg, ...prev }));

      requestAnimationFrame(() => {
        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } finally {
      isSendingRef.current = false;
    }
  }, [chat, conn, sendMessage]);

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
        onScroll={() => setDebugMessage(undefined)}
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
        {(Object.values(chatHistory) || []).slice().sort((a, b) => b.timestamp - a.timestamp).map((v) => (
          <MessageItem
            key={v.id}
            message={v}
            style={v.sender === conn?.user?.id ? 'me' : 'other'}
            debugMessage={debugMessage}
            setDebugMessage={setDebugMessage}
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
