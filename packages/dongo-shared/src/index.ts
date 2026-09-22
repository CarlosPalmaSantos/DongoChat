import short from "short-uuid";

export function toUpperCamelCase(text: string) {
  if (!text) return '';

  return text
    // Remueve acentos / diacríticos
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Reemplaza cualquier carácter no alfanumérico por espacios
    .replace(/[^a-zA-Z0-9]/g, ' ')
    // Divide en palabras, convierte la primera letra a mayúscula y el resto a minúscula
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function cleanText(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\W]/g, '')
    .replace(/[\u0330-\u036f]/g, '')
}

export namespace Id {
  const ID_FLAGS = ['g', 't'] as const;
  type IdFlag = typeof ID_FLAGS[number];

  export function gen(...flags: IdFlag[]): string {
    const value = short.generate()
    let res = ''

    if (flags.length > 0)
      res += '@'


    if (flags.length > 0) {
      for (const c of flags) {
        res += c
      }

      res += ':'
    }

    return res + value
  }
}

export interface User {
  id: string;
  name: string;
}

export function ParseUser(data: any): User | undefined {
  if ('id' in data && 'name' in data)
    return {
      id: data.id,
      name: data.name,
    }

  return undefined
}

export interface PublicUser {
  id: string;
  name: string;
}

export interface Message {
  id: string;
  sender: string;
  receiver: string;
  content: string;
  timestamp: number;
}
