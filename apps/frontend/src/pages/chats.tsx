import { AppBar, Avatar, Badge, Box, Card, CardActionArea, Container, Fab, Stack, Toolbar, Typography } from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import { getAllChats, type Chat } from "../types/Chat";
import { useEffect, useState } from "react";

interface ChatProps {
  chats: Chat[];
  onChatSelected: (chat: Chat) => void;
}

function Chats({ chats, onChatSelected }: ChatProps) {
  return <Container maxWidth="sm" sx={{ p: 1.75 }}>
    <Stack spacing={1.75}>
      {chats.map((c) => (
        <Card
          key={c.name}
          variant="outlined"
          sx={{
            borderRadius: 4,
          }}
        >
          <CardActionArea sx={{
            px: 2,
            py: 2,
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 1.5,
          }} onClick={() => onChatSelected(c)}>
            <Avatar>{c.name[0]}</Avatar>

            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <Typography
                variant="subtitle2"
                color="primary"
                noWrap
                sx={{ fontWeight: 'bold', lineHeight: 1.5 }}
              >
                {c.name}
              </Typography>

              <Typography
                variant="body2"
                color="textSecondary"
                noWrap
                sx={{ lineHeight: 1.3 }}
              >
                {c.last}
              </Typography>
            </Box>
            {(!!c.pending && c.pending > 0) &&
              <Box sx={{ mx: 2 }} >
                <Badge badgeContent={c.pending} color="primary" max={99} />
              </Box>
            }
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  </Container >

}

interface ChatPageProps {
  onChatSelected: (chat: Chat) => void;
}

export default function ChatsPage({ onChatSelected }: ChatPageProps) {
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    getAllChats().then(setChats);
  }, [])

  return <>
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
      <Toolbar>
        <Typography variant="h5" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
          DongoChat
        </Typography>
      </Toolbar>
    </AppBar>

    {/* Lista con scroll */}
    <Chats chats={chats} onChatSelected={onChatSelected} />
    {/* Botón flotante para crear chat */}
    <Fab
      color="primary"
      sx={{ position: 'fixed', bottom: 24, right: 24 }}
      onClick={() => { }}
    >
      <AddIcon />
    </Fab>

  </>

}
