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
  "standard_de746535fcf2dc1b8fffaf624081f752e4fee730bdf084bc23e55d3a4beeb1f226ca407e430adb14bfabb31a1e534671803358589e97b2171d985643244ff81ba22365c60f6c6e64b7c076fe1efe1529b2d213a02bc11c2c3343ed6b904c320fcd3e3bf220a6179055a7d50962525345a6672f6ef601b0aae5692e5b8beb79f6";

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
