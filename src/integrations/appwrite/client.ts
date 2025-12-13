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
  "standard_94c348a0ac072b102b61f6f39a90674f22017215a091705208b64f95874c89c2cb3854a1095d177df6deead5b947a130dac15604db292fa26a6149dc1978c811fe49b779c9df5165e8074f56fafe400dcb710db4cd665157361ac4fe1b68a0512c2ca25beb0bf3bf7af0e7bd8bd63266e1a538d44220d55e3921d873d800aabd";

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
