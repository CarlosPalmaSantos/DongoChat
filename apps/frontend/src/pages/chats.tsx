import { AppBar, Avatar, Badge, Box, Button, Card, CardActionArea, Container, Dialog, Fab, Stack, TextField, Toolbar, Typography } from "@mui/material";
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import { getAllChats, saveMessage, type Chat } from "../types/Chat";
import { useEffect, useRef, useState } from "react";
import { useConnection } from "../hooks/useConnection";

interface ChatProps {
  chats: Chat[];
  onChatSelected: (chat: Chat) => void;
}

function Chats({ chats, onChatSelected }: ChatProps) {
  return <Container maxWidth="sm" sx={{ p: 1.75 }}>
    <Stack spacing={1.75}>
      {Object.values(chats).sort((a, b) => (b.lastTimestamp ?? 0) - (a.lastTimestamp ?? 0)).map((c) => (
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
  onChatSelected: (chat: Chat | 'settings' | null) => void;
}

export default function ChatsPage({ onChatSelected }: ChatPageProps) {
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [newUser, setNewUser] = useState<string>();
  const { editChat, chats } = useConnection();

  return (
    <>
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
      <Chats chats={Object.values(chats)} onChatSelected={onChatSelected} />

      {/* Botón flotante para crear chat */}
      <Box
        sx={{ position: 'fixed', bottom: 24, right: 24, gap: 1, display: 'flex', flexDirection: 'column' }}
      >
        <Dialog open={dialogOpen}>
          <Card sx={{ display: 'flex', flexDirection: 'column', p: 4, gap: 3, alignItems: 'center' }}>
            <TextField
              value={newUser}
              label="Usuario"
              variant="outlined"
              onChange={v => setNewUser(v.target.value)}
            />
            <Button sx={{ bgcolor: theme => theme.palette.primary.main, color: theme => theme.palette.primary.contrastText, width: 'fit-content' }}
              onClick={() => {
                if (!newUser || newUser in chats) return;
                editChat({
                  name: newUser,
                  uuid: newUser,
                  last: '',
                  lastTimestamp: Date.now(),
                  bunchMaxSize: 20,
                  lastBunch: 0,
                });

                setDialogOpen(false);
              }}
            >
              ADD
            </Button>
          </Card>
        </Dialog>
        <Fab
          color="primary"
          onClick={() => { setDialogOpen(true); }}
        >
          <AddIcon />
        </Fab>
        <Fab
          color="primary"
          onClick={() => { onChatSelected('settings'); }}
        >
          <SettingsIcon />
        </Fab>
      </Box >
    </>
  );
}
