/**
 * secureKeys.ts
 * ------------------------------------------------------------------
 * Generación y almacenamiento seguro de un par de claves RSA-OAEP
 * para cifrado/descifrado de mensajes, válido tanto para web como
 * para Capacitor (Android/iOS), sin dependencias nativas.
 *
 * PRINCIPIO CLAVE:
 * La clave privada se genera como CryptoKey NO extraíble
 * (extractable: false) y se guarda tal cual -como objeto CryptoKey,
 * nunca como string PEM/base64- en IndexedDB. El motor de structured
 * clone del navegador/WebView soporta guardar CryptoKeys de forma
 * nativa. Como resultado:
 *
 *   - Nunca existe un string con la clave privada en memoria ni en
 *     disco (ni en logs, ni en un JSON, ni accesible por
 *     Filesystem.readFile).
 *   - Ni tu propio código ni un atacante que consiga ejecutar JS en
 *     tu origen (p. ej. una vulnerabilidad XSS) pueden "exportar" o
 *     leer los bytes crudos de la clave: crypto.subtle.exportKey()
 *     lanzará un error porque extractable = false.
 *   - Solo se puede *usar* la clave (pedirle al navegador que
 *     descifre con ella), nunca extraerla.
 *
 * Esto es una mejora fuerte frente a guardar el PEM en con.json, pero
 * ten en cuenta sus límites (ver notas al final del archivo).
 *
 * Dependencia: idb-keyval (wrapper minúsculo sobre IndexedDB)
 *   npm install idb-keyval
 */

import { get, set, del, createStore } from 'idb-keyval';

// Un "store" propio en IndexedDB, separado de otros datos de la app.
const keyStore = createStore('dongo-secure-keys', 'keys');

const PRIVATE_KEY_ID = 'rsa-private-key';
const PUBLIC_KEY_PEM_ID = 'rsa-public-key-pem';

const RSA_OAEP_PARAMS: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

export interface KeyPairInfo {
  publicKeyPem: string;
}

/**
 * Genera un nuevo par de claves y sustituye cualquier par anterior
 * guardado. Llama a esto solo quiere decir que el usuario está creando
 * una identidad nueva (primer arranque, o un "reset" explícito) -
 * genera una clave pública distinta, así que si tu backend asocia la
 * clave pública a la identidad del usuario, tendrás que volver a
 * registrarla.
 */
export async function generateAndStoreKeyPair(): Promise<KeyPairInfo> {
  const keyPair = await crypto.subtle.generateKey(RSA_OAEP_PARAMS, false, [
    'encrypt',
    'decrypt',
  ]);
  // Nota: keyPair.publicKey.extractable es SIEMPRE true, aunque hayamos
  // pedido extractable:false — esa opción solo afecta a la privada.
  // keyPair.privateKey.extractable es false: no se puede exportar.

  const publicKeyPem = await exportPublicKeyToPem(keyPair.publicKey);

  await set(PRIVATE_KEY_ID, keyPair.privateKey, keyStore);
  await set(PUBLIC_KEY_PEM_ID, publicKeyPem, keyStore);

  return { publicKeyPem };
}

/** true si ya hay un par de claves generado en este dispositivo. */
export async function hasStoredKeyPair(): Promise<boolean> {
  const key = await get<CryptoKey>(PRIVATE_KEY_ID, keyStore);
  return key !== undefined;
}

/** Clave pública en PEM, para mandar al servidor / a otros usuarios. */
export async function getStoredPublicKeyPem(): Promise<string | undefined> {
  return get<string>(PUBLIC_KEY_PEM_ID, keyStore);
}

async function getStoredPrivateKey(): Promise<CryptoKey> {
  const key = await get<CryptoKey>(PRIVATE_KEY_ID, keyStore);
  if (!key) {
    throw new Error(
      'No hay ninguna clave privada almacenada en este dispositivo.',
    );
  }
  return key;
}

/**
 * Descifra un mensaje (llegado como base64) usando la clave privada
 * guardada. La clave nunca sale de IndexedDB/memoria del navegador.
 */
export async function decryptWithStoredKey(
  cipherBase64: string,
): Promise<ArrayBuffer> {
  const privateKey = await getStoredPrivateKey();
  const cipherBytes = base64ToBytes(cipherBase64);
  return crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    cipherBytes as BufferSource,
  );
}

/**
 * Cifra datos con la clave pública PEM de otro usuario (p. ej. antes
 * de mandarle un mensaje).
 */
export async function encryptWithPublicKeyPem(
  pem: string,
  data: ArrayBuffer,
): Promise<string> {
  const publicKey = await importPublicKeyFromPem(pem);
  const cipher = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    data,
  );
  return bytesToBase64(new Uint8Array(cipher));
}

/** Borra el par de claves de este dispositivo (logout / reset). */
export async function deleteStoredKeyPair(): Promise<void> {
  await del(PRIVATE_KEY_ID, keyStore);
  await del(PUBLIC_KEY_PEM_ID, keyStore);
}

// ---------------------------------------------------------------
// Hashing (SHA-256 por defecto vía Web Crypto, sin dependencias)
// ---------------------------------------------------------------

/** Algoritmos de digest soportados por SubtleCrypto que nos interesan aquí. */
export type DigestAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

/**
 * Hashea datos arbitrarios (string, ArrayBuffer o Uint8Array) y
 * devuelve el digest como Uint8Array. Es la base de las funciones
 * de conveniencia de abajo (hex / base64).
 *
 * Nota: SHA-1 y MD5 NO están disponibles vía crypto.subtle a
 * propósito (son inseguros para huellas/integridad). Si en algún
 * punto necesitas interoperar con un sistema legado que los exija,
 * necesitarás una librería aparte (p. ej. crypto-js) — no lo añado
 * aquí para no meter una dependencia extra sin necesidad real.
 */
export async function hashData(
  data: string | ArrayBuffer | Uint8Array,
  algorithm: DigestAlgorithm = 'SHA-256',
): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = toBufferSource(data);
  const digest = await crypto.subtle.digest(algorithm, bytes);
  return new Uint8Array(digest) as Uint8Array<ArrayBuffer>;
}

/** Hash en hexadecimal minúsculas (el formato más habitual para mostrar huellas). */
export async function hashHex(
  data: string | ArrayBuffer | Uint8Array,
  algorithm: DigestAlgorithm = 'SHA-256',
): Promise<string> {
  const bytes = await hashData(data, algorithm);
  return bytesToHex(bytes);
}

/** Hash en base64 (útil si quieres mandarlo en JSON/backend). */
export async function hashBase64(
  data: string | ArrayBuffer | Uint8Array,
  algorithm: DigestAlgorithm = 'SHA-256',
): Promise<string> {
  const bytes = await hashData(data, algorithm);
  return bytesToBase64(bytes);
}

/**
 * Huella digital (fingerprint) de una clave pública en PEM, calculada
 * como SHA-256 de los bytes DER (SPKI) — NO del texto PEM en sí, ya
 * que dos PEMs "equivalentes" con distinto formateo (saltos de línea,
 * espacios) deben dar la MISMA huella. Este es el patrón estándar
 * (parecido a lo que hacen TLS/SSH/Signal para "safety numbers").
 *
 * Si no se pasa `pem`, usa la clave pública guardada en este
 * dispositivo.
 *
 * Devuelve la huella en hex, agrupada de 4 en 4 para que sea legible
 * al leerla en voz alta o compararla a simple vista, p. ej.:
 *   "a1b2 c3d4 e5f6 ..."
 */
export async function getPublicKeyFingerprint(pem?: string): Promise<string> {
  const targetPem = pem ?? (await getStoredPublicKeyPem());
  if (!targetPem) {
    throw new Error('No hay ninguna clave pública disponible para hashear.');
  }
  const der = pemToDer(targetPem);
  const hex = await hashHex(der, 'SHA-256');
  return hex.match(/.{1,4}/g)?.join(' ') ?? hex;
}

// ---------------------------------------------------------------
// Helpers PEM / base64 / hex (sin dependencias externas)
// ---------------------------------------------------------------

async function exportPublicKeyToPem(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', key);
  const base64 = bytesToBase64(new Uint8Array(exported));
  const formatted = base64.match(/.{1,64}/g)?.join('\n') ?? base64;
  return `-----BEGIN PUBLIC KEY-----\n${formatted}\n-----END PUBLIC KEY-----`;
}

async function importPublicKeyFromPem(pem: string): Promise<CryptoKey> {
  const bytes = pemToDer(pem);
  return crypto.subtle.importKey(
    'spki',
    bytes as BufferSource,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt'],
  );
}

/** Quita las cabeceras/pies PEM y espacios, y decodifica a bytes DER. */
function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  return base64ToBytes(base64);
}

/** Normaliza string/ArrayBuffer/Uint8Array a algo aceptado por SubtleCrypto. */
function toBufferSource(
  data: string | ArrayBuffer | Uint8Array,
): BufferSource {
  if (typeof data === 'string') {
    return new TextEncoder().encode(data) as BufferSource;
  }
  if (data instanceof Uint8Array) {
    return data as BufferSource;
  }
  return data;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * ------------------------------------------------------------------
 * NOTAS IMPORTANTES
 * ------------------------------------------------------------------
 *
 * 1) ¿Funciona igual en Capacitor que en web?
 *    Sí: el WebView de Capacitor (WKWebView en iOS, WebView basado en
 *    Chromium en Android) expone IndexedDB y Web Crypto igual que un
 *    navegador normal, y ambos soportan structured-clone de
 *    CryptoKey. Aun así, pruébalo específicamente en la versión de
 *    iOS que soportes: hubo bugs antiguos de WebKit en el manejo de
 *    IndexedDB+CryptoKey no extraíbles, ya resueltos en versiones
 *    recientes, pero conviene verificarlo en tu rango mínimo de iOS.
 *
 * 2) ¿Qué nivel de seguridad da esto realmente?
 *    IndexedDB vive dentro del sandbox de datos de tu app (carpeta
 *    privada de la app en Android/iOS, origin storage en navegador).
 *    Un atacante con JS en tu origen NO puede exportar la clave, pero
 *    SÍ podría, mientras el usuario tiene la app abierta, pedirle al
 *    navegador que descifre mensajes arbitrarios con ella. No es
 *    invulnerable, pero es un salto grande respecto a un PEM en
 *    texto plano, que se puede copiar y usar offline sin límite.
 *
 * 3) ¿Merece la pena una capa extra con Keychain/Keystore nativo?
 *    Si quieres protección adicional en Android/iOS (a nivel
 *    hardware, opcionalmente con gate biométrico), el patrón es:
 *      a) generar el par RSA con extractable:true,
 *      b) generar una clave AES-GCM aleatoria "wrapping key",
 *      c) usar crypto.subtle.wrapKey() para cifrar la privada con esa
 *         AES key, y guardar SOLO el blob cifrado (en IndexedDB),
 *      d) guardar la AES wrapping key en el Keychain/Keystore nativo
 *         vía un plugin como @aparajita/capacitor-secure-storage
 *         (activo, Capacitor 6+, usa iOS Keychain / Android Keystore).
 *      e) al arrancar, recuperar la wrapping key del Keychain,
 *         hacer unwrapKey() (idealmente devolviendo un CryptoKey NO
 *         extraíble) y operar con eso.
 *    Esto es más trabajo y añade una dependencia nativa por
 *    plataforma; solo lo recomendaría si el modelo de amenaza incluye
 *    un dispositivo rooteado/jailbreakeado con acceso al sandbox de
 *    la app. Para la mayoría de apps de chat, el enfoque de arriba
 *    (clave no extraíble en IndexedDB) ya es una mejora sólida y
 *    suficiente.
 *
 * 4) Migración desde el sistema actual (PEM en con.json):
 *    No hay forma de "convertir" el PEM antiguo en una clave no
 *    extraíble sin pasar por texto plano una vez (es inherente:
 *    tienes que importar el PEM con importKey y extractable:false
 *    para dejar de tener el string por ahí). Lo más limpio es tratarlo
 *    como una rotación de clave: generar un par nuevo con
 *    generateAndStoreKeyPair(), registrar la nueva clave pública en tu
 *    backend, borrar el con.json antiguo (o al menos los campos
 *    puk/prk) y notificar a los contactos si tu protocolo lo requiere.
 *
 * 5) Sobre las funciones de hashing añadidas:
 *    - hashData/hashHex/hashBase64 son genéricas: sirven para
 *      checksums de mensajes, verificar integridad de adjuntos
 *      descargados, etc. NO son para hashear contraseñas (para eso
 *      necesitas un KDF lento tipo Argon2/scrypt/PBKDF2, no SHA-256
 *      puro — si tienes ese caso de uso dímelo y te lo añado aparte).
 *    - getPublicKeyFingerprint() te da un "número de seguridad" que
 *      dos usuarios pueden comparar fuera de banda (verbalmente, por
 *      otro canal) para confirmar que no hay un ataque
 *      man-in-the-middle sustituyendo la clave pública en el
 *      servidor.
 */
