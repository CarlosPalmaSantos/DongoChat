export interface User {

  id: string;
  name: string;
  pass: string;
}

export interface PublicUser {
  id: string;
  name: string;
}

export function isComplete<T extends object>(
  value: Partial<T>,
  keys: readonly (keyof T)[]
): value is T {
  return keys.every(key => value[key] !== undefined);
}

export interface Message {
  id: string;
  sender: string;
  receiver: string;
  content: string;
  timestamp: number;
}

