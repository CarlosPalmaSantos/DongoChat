// src/theme.d.ts
import '@mui/material/styles';
import { PaletteColor, PaletteColorOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    surfaceVariant?: string;
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
