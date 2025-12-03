import { Client, Account, Databases, ID } from 'appwrite';

const client = new Client();

client
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://appwrite.unified-bi.org:3443/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '6921fb6b001624e640e3');

export const account = new Account(client);
export const databases = new Databases(client);

export const DATABASE_ID = 'unified_llm';
export const COLLECTIONS = {
  USER_SETTINGS: 'user_settings',
};

export { ID };
export default client;
