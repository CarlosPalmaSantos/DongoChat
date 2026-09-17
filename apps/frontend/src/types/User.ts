import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { User } from "dongo-shared";

export interface ConnectionSettings {
  ip?: string,
  user?: User;
}

export const saveConnectionSettings = async (conn: ConnectionSettings): Promise<void> => {
  console.log('Saving')
  console.log(conn)
  await Filesystem.writeFile({
    path: "con.json",
    data: JSON.stringify(conn, null, 2),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true,
  });
};
export const loadConnectionSettings = async (): Promise<ConnectionSettings | undefined> => {
  console.log('Saving')
  try {
    return JSON.parse((await Filesystem.readFile({
      path: "con.json",
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    })).data.toString());
  }
  catch {
    return undefined;
  }
};

export const deleteConnectionSettings = async (): Promise<void> => {
  try {
    await Filesystem.deleteFile({
      path: "con.json",
      directory: Directory.Data,
    });
  }
  catch {
    console.log('No file to delete')
  }
}
