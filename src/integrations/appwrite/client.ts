import { Client, Databases, Account, Storage, ID, Query, Functions } from "appwrite";

const client = new Client();

client.setEndpoint("https://appwrite.unified-bi.org/v1").setProject("6921fb6b001624e640e3");

// For cross-domain cookies
if (typeof window !== "undefined") {
  client.headers["X-Fallback-Cookies"] = "1";
}

export const databases = new Databases(client);
export const account = new Account(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

export const DATABASE_ID = "692f6e880008c421e414";
export const COLLECTIONS = {
  USER_SETTINGS: "user_settings",
  LLM_LIST: "llm_list",
};

// API Key for server-side operations (used when session cookies don't work)
const API_KEY =
  "standard_7e09b4939bca901fe26ba745737c6c674cb4ccb4a9acf1b13a2e1a88e6529613793e0e505d84257f2841e7c415921606a204320960828ea771b62adea751a198dce1638fa30a4f5ee762ee9522914dcd16df3f0cee8e1dc8b4a700f8f9af2418ad21ee55df621693c7f32fc8666a0371a9e95d70e2b184c4b7a28499421f3e70";

const APPWRITE_ENDPOINT = "https://appwrite.unified-bi.org/v1";
const PROJECT_ID = "6921fb6b001624e640e3";

// Helper function to make authenticated API requests
export const appwriteFetch = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": PROJECT_ID,
      "X-Appwrite-Key": API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Appwrite request failed");
  }

  return response.json();
};

// Database helpers using API key
export const appwriteDb = {
  listDocuments: async (databaseId: string, collectionId: string, queries?: string[]) => {
    let url = `/databases/${databaseId}/collections/${collectionId}/documents`;
    if (queries && queries.length > 0) {
      const queryParams = queries.map((q) => `queries[]=${encodeURIComponent(q)}`).join("&");
      url += `?${queryParams}`;
    }
    return appwriteFetch(url);
  },

  getDocument: async (databaseId: string, collectionId: string, documentId: string) => {
    return appwriteFetch(`/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`);
  },

  createDocument: async (databaseId: string, collectionId: string, documentId: string, data: any) => {
    return appwriteFetch(`/databases/${databaseId}/collections/${collectionId}/documents`, {
      method: "POST",
      body: JSON.stringify({
        documentId,
        data,
      }),
    });
  },

  updateDocument: async (databaseId: string, collectionId: string, documentId: string, data: any) => {
    return appwriteFetch(`/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`, {
      method: "PATCH",
      body: JSON.stringify({ data }),
    });
  },

  deleteDocument: async (databaseId: string, collectionId: string, documentId: string) => {
    return appwriteFetch(`/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`, {
      method: "DELETE",
    });
  },
};

// Dify API helper that calls the secure edge function
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://trhnhfqkxgbjcrficgek.supabase.co";

export const difyApi = {
  listDocuments: async (userId: string) => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/dify-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listDocuments", userId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list documents");
    }
    return response.json();
  },

  deleteDocument: async (userId: string, documentId: string) => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/dify-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteDocument", userId, documentId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete document");
    }
    return response.json();
  },

  uploadDocuments: async (userId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("userId", userId);
    formData.append("action", "uploadDocuments");

    const response = await fetch(`${SUPABASE_URL}/functions/v1/dify-proxy`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to upload documents");
    }
    return response.json();
  },
};

export { client, ID, Query };
