import { AppBar, Avatar, Badge, Box, Button, Card, CardActionArea, CircularProgress, Container, Dialog, Fab, IconButton, Paper, Stack, TextField, Toolbar, Typography } from "@mui/material";
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { type Chat } from "../types/Chat";
import { useState } from "react";
import { useConnection } from "../hooks/useConnection";
import { type User } from "dongo-shared";

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
  const { editChat, chats, socket, status, connect } = useConnection();
  const [userList, setUserList] = useState<User[]>([])

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
        {/* Botón flotante para crear chat */}
        <Box
          sx={{ position: 'fixed', bottom: 24, right: 24, gap: 1, display: 'flex', flexDirection: 'column' }}
        >
          <Dialog open={dialogOpen}>
            {/* ...contenido del dialog sin cambios... */}
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
        </Box>

        {/* Fab nuevo, abajo a la izquierda */}
        {(status.type !== 'connected' && status.type !== 'inboxed') && <Box
          sx={{ position: 'fixed', bottom: 24, left: 24 }}
        >
          <Fab
            variant={status.error ? 'extended' : 'circular'}
            color={status.error ? 'error' : (
              status.attempt && status.attempt > 2 ? 'warning' :
                'primary')}

            sx={{
              pointerEvents: status.error ? 'auto' : 'none',
              cursor: status.error ? 'pointer' : 'none'
            }}
            onClick={connect}
          >
            {status.error ? <Typography>{status.error}</Typography> : <CircularProgress color="inherit" sx={{ p: .75 }} />}
          </Fab>
        </Box>}
      </Box >
      <Dialog open={dialogOpen}>
        <Card sx={{ display: 'flex', flexDirection: 'column', p: 4, gap: 3, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <TextField
              value={newUser}
              label="Usuario"
              variant="outlined"
              onChange={v => setNewUser(v.target.value)}
              slotProps={{
                input: {
                  endAdornment: <IconButton color="primary"
                    onClick={async () => {
                      console.log('listing')
                      if ((newUser ?? '').length < 3) return
                      const list = await socket?.emitWithAck('list-user', newUser)
                      setUserList(list)
                    }}>
                    <SearchIcon />
                  </IconButton>,
                },
              }}
            />
          </Box>
          {(userList && userList.length > 0) && userList.map(u =>
            <Paper color="primary" key={u.id} variant="outlined" sx={{ px: 2, py: 1, width: '100%', display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', flexGrow: 1, gap: 1 }}>
                <Typography variant="body1" color="secondary">
                  ( {u.id.substring(0, 4)} )
                </Typography>
                <Typography variant="body1" >
                  {u.name}
                </Typography>
              </Box>
              <Box>
                <IconButton
                  sx={{
                    color: theme => theme.palette.primary.main,
                    alignSelf: 'stretch', // Estira el contenedor al alto total del flexbox
                    aspectRatio: '1 / 1', // Garantiza que el ancho sea igual al alto
                    p: 1,                 // Elimina el padding si prefieres el icono al límite
                  }}

                  onClick={async () => {
                    await editChat({
                      uuid: u.id,
                      name: u.name,
                      last: '',
                      lastTimestamp: 0,
                      bunchMaxSize: 20,
                      lastBunch: 0,
                    })

                    setDialogOpen(false);
                  }}
                >
                  <AddIcon />
                </IconButton>
              </Box>
            </Paper>
          )}
          <Button sx={{ p: 1 }} onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>

          {/* TODO: Agregar listado de usuarios con nombre
              */}

          {/*<Button sx={{ bgcolor: theme => theme.palette.primary.main, color: theme => theme.palette.primary.contrastText, width: 'fit-content' }}
              onClick={() => {
                if (!newUser || newUser in chats) return;
                editChat({
                  name: newUser,
                  uuid: cleanText(newUser),
                  last: '',
                  lastTimestamp: Date.now(),
                  bunchMaxSize: 20,
                  lastBunch: 0,
                });

                setDialogOpen(false);
              }}
            >
              ADD
            </Button>*/}
        </Card>
      </Dialog>

    </>
  );
}
