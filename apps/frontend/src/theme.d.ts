// src/theme.d.ts
import '@mui/material/styles';
import '@mui/material/Button';
import '@mui/material/Chip';
import '@mui/material/Fab';
import '@mui/material/IconButton';
import '@mui/material/Badge';
import '@mui/material/LinearProgress';
import '@mui/material/CircularProgress';

declare module '@mui/material/styles' {
  interface TypeBackground {
    surfaceVariant?: string;
    onSurfaceVariant?: string; // ← Texto/Iconos para surfaceVariant
  }

  interface TypeText {
    surfaceVariant?: string; // ← Permite usar color="text.surfaceVariant" en Typography
  }

  interface PaletteColor {
    container?: string;
    onContainer?: string;
  }
  interface SimplePaletteColorOptions {
    container?: string;
    onContainer?: string;
  }

  interface Palette {
    tertiary: PaletteColor;
  }
  interface PaletteOptions {
    tertiary?: SimplePaletteColorOptions;
  }
}

// Habilita color="tertiary" en los componentes que lo necesites
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    tertiary: true;
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    tertiary: true;
  }
}

declare module '@mui/material/Fab' {
  interface FabPropsColorOverrides {
    tertiary: true;
  }
}

declare module '@mui/material/IconButton' {
  interface IconButtonPropsColorOverrides {
    tertiary: true;
  }
}

declare module '@mui/material/Badge' {
  interface BadgePropsColorOverrides {
    tertiary: true;
  }
}
