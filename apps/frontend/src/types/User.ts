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
export const loadConnectionSettings = async (): Promise<ConnectionSettings> => {
  console.log('Saving')
  try {
    return JSON.parse((await Filesystem.readFile({
      path: "con.json",
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    })).data.toString());
  }
  catch {
    const res = {
      name: '<NONAME>',
      ip: 'wss://dongo.magin.top'
    }

    await saveConnectionSettings(res);

    return res;
  }
};
