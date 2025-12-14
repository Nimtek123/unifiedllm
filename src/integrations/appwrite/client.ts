import { Client, Databases, Account, Storage, ID, Query, Functions } from "appwrite";

const client = new Client();

client.setEndpoint("http://localhost:8888/v1").setProject("693e368b0033aad1fe57");

// For cross-domain cookies
if (typeof window !== "undefined") {
  client.headers["X-Fallback-Cookies"] = "1";
}

export const databases = new Databases(client);
export const account = new Account(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

export const DATABASE_ID = "693eaa4d0039d9238080";
export const COLLECTIONS = {
  USER_SETTINGS: "user_settings",
  LLM_LIST: "llm_list",
};

// API Key for server-side operations (used when session cookies don't work)
const API_KEY =
  "standard_ca76034022f85f3a53321e8c43dc89a15e6ac9410a54084051f463e8ef10becfd55bd77bc51afa25730c11c830817fbf2c461c3af15ef5e8ae7ff07e8253ebb1298e3e2f8f8a83a0348daadd8a1383ead62b60342db8a56ca3040a89b4e95cba4a094ec98140066b84b1bad798c0dd960d8a60fa76a1353034e4d1bd5f53bf3a";

const APPWRITE_ENDPOINT = "http://localhost:8888/v1";
const PROJECT_ID = "693e368b0033aad1fe57";

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

// Dify API helper with direct connections
const DIFY_API_URL = "http://localhost:8088/v1";
const TEAM_MEMBERS_COLLECTION = "team_members";

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
