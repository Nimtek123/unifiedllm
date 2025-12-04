import { Client, Account, ID } from 'appwrite';
import { supabase } from '@/integrations/supabase/client';

const client = new Client();

client
  .setEndpoint('https://appwrite.unified-bi.org/v1')
  .setProject('6921fb6b001624e640e3');

export const account = new Account(client);

export const DATABASE_ID = '692f6e880008c421e414';
export const COLLECTIONS = {
  USER_SETTINGS: 'user_settings',
};

// Secure API calls through edge function proxy
export const appwriteDb = {
  listDocuments: async (databaseId: string, collectionId: string) => {
    const { data, error } = await supabase.functions.invoke('appwrite-proxy', {
      body: { action: 'listDocuments', collectionId },
    });
    if (error) throw new Error(error.message);
    return data;
  },
  
  getDocument: async (databaseId: string, collectionId: string, documentId: string) => {
    const { data, error } = await supabase.functions.invoke('appwrite-proxy', {
      body: { action: 'getDocument', collectionId, documentId },
    });
    if (error) throw new Error(error.message);
    return data;
  },
  
  createDocument: async (databaseId: string, collectionId: string, documentId: string, data: any) => {
    const { data: result, error } = await supabase.functions.invoke('appwrite-proxy', {
      body: { action: 'createDocument', collectionId, documentId, data },
    });
    if (error) throw new Error(error.message);
    return result;
  },
  
  updateDocument: async (databaseId: string, collectionId: string, documentId: string, data: any) => {
    const { data: result, error } = await supabase.functions.invoke('appwrite-proxy', {
      body: { action: 'updateDocument', collectionId, documentId, data },
    });
    if (error) throw new Error(error.message);
    return result;
  },
  
  deleteDocument: async (databaseId: string, collectionId: string, documentId: string) => {
    const { data, error } = await supabase.functions.invoke('appwrite-proxy', {
      body: { action: 'deleteDocument', collectionId, documentId },
    });
    if (error) throw new Error(error.message);
    return data;
  },
};

// Secure Dify API calls through edge function proxy
export const difyApi = {
  listDocuments: async (userId: string) => {
    const { data, error } = await supabase.functions.invoke('dify-proxy', {
      body: { action: 'listDocuments', userId },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  deleteDocument: async (userId: string, documentId: string) => {
    const { data, error } = await supabase.functions.invoke('dify-proxy', {
      body: { action: 'deleteDocument', userId, documentId },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  uploadDocument: async (userId: string, file: File, indexingTechnique: string = 'high_quality') => {
    const formData = new FormData();
    formData.append('action', 'uploadDocument');
    formData.append('userId', userId);
    formData.append('file', file);
    formData.append('indexingTechnique', indexingTechnique);

    const { data, error } = await supabase.functions.invoke('dify-proxy', {
      body: formData,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  checkDocuments: async (userId: string) => {
    const { data, error } = await supabase.functions.invoke('dify-proxy', {
      body: { action: 'checkDocuments', userId },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  getSettings: async (userId: string) => {
    const { data, error } = await supabase.functions.invoke('dify-proxy', {
      body: { action: 'getSettings', userId },
    });
    if (error) throw new Error(error.message);
    return data;
  },
};

export { client, ID };
