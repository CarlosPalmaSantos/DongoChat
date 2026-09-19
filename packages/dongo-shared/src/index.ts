import short from "short-uuid";

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

    for (const c of flags) {
      res += c
    }

    res += ':'

    return res + value
  }

}

export interface User {
  id: string;
  name: string;
  pass: string;
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
