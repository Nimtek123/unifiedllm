import { Client, Databases, Account, Storage, ID } from 'appwrite';

const client = new Client();

client
  .setEndpoint('https://appwrite.unified-bi.org:3443/v1')
  .setProject('6921fb6b001624e640e3');

export const databases = new Databases(client);
export const account = new Account(client);
export const storage = new Storage(client);

export const DATABASE_ID = '692f6e880008c421e414';
export const COLLECTIONS = {
  USER_SETTINGS: 'user_settings',
};

export { client, ID };
