import { Client, Databases, Account, Storage, ID } from 'appwrite';

const client = new Client();

client
  .setEndpoint('https://appwrite.unified-bi.org/v1')
  .setProject('6921fb6b001624e640e3');

export const databases = new Databases(client);
export const account = new Account(client);
export const storage = new Storage(client);

export const DATABASE_ID = '692f6e880008c421e414';
export const COLLECTIONS = {
  USER_SETTINGS: 'user_settings',
};

// API Key for server-side operations (used when session cookies don't work)
const API_KEY = 'standard_43965d6c2e1ace9d44e489216b4eca0ffd78f700375a3aa6ad0763b94cc83858028132896b809e9b8b2a9439f8980577efcd303c7f4c58a340031832a3cca7d8f8a73f79ed6633805fe9c7c76a09dd6314f454493e57df5323cdec022aaf52860452a7dee7c82220f00983485a7dd0a124fee83f4434892105be8f3080579824';

const APPWRITE_ENDPOINT = 'https://appwrite.unified-bi.org/v1';
const PROJECT_ID = '6921fb6b001624e640e3';

// Helper function to make authenticated API requests
export const appwriteFetch = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Appwrite-Project': PROJECT_ID,
      'X-Appwrite-Key': API_KEY,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Appwrite request failed');
  }
  
  return response.json();
};

// Database helpers using API key
export const appwriteDb = {
  listDocuments: async (databaseId: string, collectionId: string) => {
    return appwriteFetch(`/databases/${databaseId}/collections/${collectionId}/documents`);
  },
  
  getDocument: async (databaseId: string, collectionId: string, documentId: string) => {
    return appwriteFetch(`/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`);
  },
  
  createDocument: async (databaseId: string, collectionId: string, documentId: string, data: any) => {
    return appwriteFetch(`/databases/${databaseId}/collections/${collectionId}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        documentId,
        data,
      }),
    });
  },
  
  updateDocument: async (databaseId: string, collectionId: string, documentId: string, data: any) => {
    return appwriteFetch(`/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ data }),
    });
  },
  
  deleteDocument: async (databaseId: string, collectionId: string, documentId: string) => {
    return appwriteFetch(`/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`, {
      method: 'DELETE',
    });
  },
};

export { client, ID };
