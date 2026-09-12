import { constants, publicEncrypt, randomBytes } from 'crypto';

export function PublicEncrypt(puk: string, raw: string) {
  const buffer = publicEncrypt({
    key: puk,
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, Buffer.from(raw));

  const challenge = buffer.toString('base64');

  return challenge;
}

export function PrivateEncrypt(prk: string, raw: string) {
  const buffer = publicEncrypt({
    key: prk,
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, Buffer.from(raw));

  const challenge = buffer.toString('base64');

  return challenge;
}
