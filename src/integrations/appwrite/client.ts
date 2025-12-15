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

// List all users from Appwrite
export const listAppwriteUsers = async () => {
  return appwriteFetch("/users");
};

// Dify API helper with direct connections
const DIFY_API_URL = "https://dify.unified-bi.org/v1";
const TEAM_MEMBERS_COLLECTION = "team_members";
const DIFY_ADMIN_API_KEY = "dataset-IZTSbWRnkOLUt5DKaI8V3W9WGu44LlJRz1mBYPQIIYQM5kMzF5LQeY8lNB8jLSJr"; // Admin key for dataset management

// Helper to get parent user ID for sub-users
const getParentUserId = async (userId: string): Promise<string | null> => {
  try {
    const query = JSON.stringify({ method: "equal", attribute: "userId", values: [userId] });
    const result = await appwriteDb.listDocuments(DATABASE_ID, TEAM_MEMBERS_COLLECTION, [query]);
    if (result.documents && result.documents.length > 0) {
      return result.documents[0].parentUserId;
    }
    return null;
  } catch {
    return null;
  }
};

// Helper to get user settings (with sub-user support)
const getUserCredentials = async (userId: string): Promise<{ datasetId: string; apiKey: string; maxDocuments: number } | null> => {
  try {
    // Check if user is a sub-user
    const parentUserId = await getParentUserId(userId);
    const effectiveUserId = parentUserId || userId;

    const query = JSON.stringify({ method: "equal", attribute: "userId", values: [effectiveUserId] });
    const result = await appwriteDb.listDocuments(DATABASE_ID, COLLECTIONS.USER_SETTINGS, [query]);
    
    if (result.documents && result.documents.length > 0) {
      const settings = result.documents[0];
      if (settings.datasetId && settings.apiKey) {
        return {
          datasetId: settings.datasetId,
          apiKey: settings.apiKey,
          maxDocuments: settings.maxDocuments || 5,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const difyApi = {
  // Admin function: List all datasets
  listDatasets: async () => {
    const response = await fetch(`${DIFY_API_URL}/datasets?page=1&limit=100`, {
      headers: {
        "Authorization": `Bearer ${DIFY_ADMIN_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status}`);
    }

    return response.json();
  },

  // Admin function: Create a new dataset
  createDataset: async (name: string) => {
    const response = await fetch(`${DIFY_API_URL}/datasets`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DIFY_ADMIN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        permission: "only_me",
      }),
    });

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status}`);
    }

    return response.json();
  },

  listDocuments: async (userId: string) => {
    const credentials = await getUserCredentials(userId);
    if (!credentials) {
      throw new Error("User API settings not configured. Please ask your administrator to configure API settings.");
    }

    const response = await fetch(`${DIFY_API_URL}/datasets/${credentials.datasetId}/documents?page=1&limit=100`, {
      headers: {
        "Authorization": `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status}`);
    }

    const data = await response.json();
    return { ...data, maxDocuments: credentials.maxDocuments };
  },

  deleteDocument: async (userId: string, documentId: string) => {
    const credentials = await getUserCredentials(userId);
    if (!credentials) {
      throw new Error("User API settings not configured.");
    }

    const response = await fetch(`${DIFY_API_URL}/datasets/${credentials.datasetId}/documents/${documentId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status}`);
    }

    return { success: true };
  },

  uploadDocuments: async (userId: string, files: File[], indexingTechnique: string = "high_quality") => {
    const credentials = await getUserCredentials(userId);
    if (!credentials) {
      throw new Error("User API settings not configured.");
    }

    const results = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("indexing_technique", indexingTechnique);
      formData.append("process_rule", JSON.stringify({ mode: "automatic" }));

      const response = await fetch(`${DIFY_API_URL}/datasets/${credentials.datasetId}/document/create_by_file`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${credentials.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Dify API error: ${response.status}`);
      }

      results.push(await response.json());
    }

    return { success: true, results };
  },
};

export { client, ID, Query };
