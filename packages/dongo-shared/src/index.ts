import { randomBytes } from "crypto";
export * as crypto from './crypto';

export function RandomHex(size: number = 32, encoding: BufferEncoding = 'hex') {
  return randomBytes(size).toString(encoding);
}

