import { AppBar, Box, Button, IconButton, Paper, Snackbar, TextField, Toolbar, Typography } from "@mui/material";

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HelpIcon from '@mui/icons-material/Help';
import { useConnection } from "../hooks/useConnection";
import { useState } from "react";

export default function SettingsPage({ clearSelectedChat }: { clearSelectedChat: () => void }) {
  const { conn, editConn, ping } = useConnection();
  const [openPingSnackbar, setOpenPingSnackbar] = useState(false);
  const [error, setError] = useState<string | undefined>()
  const [pingResult, setPingResult] = useState(-1);

  return <Paper
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
        <Typography variant="h6" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
          Settings (v1)
        </Typography>
      </Toolbar>

    </AppBar>
    <Box
      sx={{
        p: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        maxWidth: 420,
        mx: 'auto',
      }}
    >
      <Typography
        variant="h5"
        color="primary"
        align="center"
        sx={{ fontWeight: 'bold' }}
      >
        Connection
      </Typography>

      <TextField
        fullWidth
        label="Name"
        variant="outlined"
        value={conn?.name}
        onChange={e => { editConn({ name: e.target.value }) }}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'background.paper',
            borderRadius: 2,
          }
        }} />
      <TextField
        fullWidth
        label="IP Address"
        variant="outlined"
        type={'url'}
        value={conn?.ip}
        onChange={e => { editConn({ ip: e.target.value }) }}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'background.paper',
            borderRadius: 2,
          }
        }} />
      <Button
        variant="contained"
        color="primary"
        size="large"
        startIcon={<HelpIcon />}
        onClick={() => {
          ping().then(r => { setPingResult(r); if (r >= 0) setOpenPingSnackbar(true) }).catch(setError)
        }}
        sx={{ borderRadius: 1 }}
      >
        Check Server
      </Button>
      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(undefined)}
        message={error}
      />

      <Snackbar
        open={openPingSnackbar}
        autoHideDuration={4000}
        onClose={() => setOpenPingSnackbar(false)}
        message={`Pong received in ${pingResult}ms`}
      />
    </Box>
  </Paper>
}
