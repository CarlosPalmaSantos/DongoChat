import { Injectable, Logger } from '@nestjs/common';
import { Message, User, cleanText } from 'dongo-shared';

export class UserEntry {
  constructor(
    public inbox: Record<string, Message>,
    public user: User,
    public puk: string,
  ) {
    //
  }
}

@Injectable()
export class AppService {
  public registeredUsers: Record<string, UserEntry | 'temp'> = {};

  listUser(input: string) {
    const filter = cleanText(input);
    return Object.values(this.registeredUsers)
      .filter((u) => u !== 'temp' && cleanText(u.user.name).includes(filter))
      .map((u) => {
        if (u === 'temp') throw new Error();
        return u.user;
      });
  }

  searchUser(id: string, includeTermporal: boolean = true) {
    Logger.debug(`SEARCH USER '${id}'`);
    const res = this.registeredUsers[id];

    if (res || (res === 'temp' && includeTermporal)) return res;
    return undefined;
  }

  bookUser(id: string) {
    if (this.searchUser(id)) throw new Error('Already registered user');

    this.registeredUsers[id] = 'temp';
    return this.registeredUsers[id];
  }

  saveUser(user: UserEntry) {
    Logger.log(user);
    this.registeredUsers[user.user.id] = user;
  }
}
