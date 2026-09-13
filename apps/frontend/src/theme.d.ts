// src/theme.d.ts
import '@mui/material/styles';
import { PaletteColor, PaletteColorOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    surfaceVariant?: string;
    onSurfaceVariant?: string; // ← Texto/Iconos para surfaceVariant
  }

  interface TypeText {
    surfaceVariant?: string; // ← Permite usar color="text.surfaceVariant" en Typography
  }
}

declare module '@mui/material/styles' {
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
