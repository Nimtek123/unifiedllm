import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APPWRITE_ENDPOINT = "https://appwrite.unified-bi.org/v1";
const PROJECT_ID = "6921fb6b001624e640e3";
const DATABASE_ID = "692f6e880008c421e414";
const COLLECTION_ID = "user_settings";
const APPWRITE_API_KEY = Deno.env.get("APPWRITE_API_KEY") || "";
const DIFY_API_URL = "https://dify.unified-bi.org/v1";

interface UserSettings {
  datasetId: string;
  apiKey: string;
  maxDocuments?: number;
}

// Fetch user settings from Appwrite
async function getUserSettings(userId: string): Promise<UserSettings | null> {
  try {
    console.log(`Fetching user settings for userId: ${userId}`);
    
    // Query for documents where userId matches
    const queryUrl = `${APPWRITE_ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents?queries[]=${encodeURIComponent(`equal("userId","${userId}")`)}`;
    
    const response = await fetch(queryUrl, {
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": PROJECT_ID,
        "X-Appwrite-Key": APPWRITE_API_KEY,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch user settings:", await response.text());
      return null;
    }

    const data = await response.json();
    console.log(`Found ${data.documents?.length || 0} user settings documents`);
    
    if (data.documents && data.documents.length > 0) {
      const settings = data.documents[0];
      return {
        datasetId: settings.datasetId,
        apiKey: settings.apiKey,
        maxDocuments: settings.maxDocuments || 5,
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return null;
  }
}

// List documents from Dify
async function listDocuments(datasetId: string, apiKey: string) {
  console.log(`Listing documents for dataset: ${datasetId}`);
  
  const response = await fetch(`${DIFY_API_URL}/datasets/${datasetId}/documents?page=1&limit=100`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Dify list documents error:", errorText);
    throw new Error(`Dify API error: ${response.status}`);
  }

  return response.json();
}

// Delete document from Dify
async function deleteDocument(datasetId: string, apiKey: string, documentId: string) {
  console.log(`Deleting document ${documentId} from dataset: ${datasetId}`);
  
  const response = await fetch(`${DIFY_API_URL}/datasets/${datasetId}/documents/${documentId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Dify delete document error:", errorText);
    throw new Error(`Dify API error: ${response.status}`);
  }

  return { success: true };
}

// Upload documents to Dify
async function uploadDocuments(datasetId: string, apiKey: string, formData: FormData) {
  console.log(`Uploading documents to dataset: ${datasetId}`);
  
  // Get the files from formData and create a new FormData for Dify
  const difyFormData = new FormData();
  
  const files = formData.getAll("files");
  for (const file of files) {
    if (file instanceof File) {
      difyFormData.append("file", file);
    }
  }
  
  difyFormData.append("indexing_technique", "high_quality");
  difyFormData.append("process_rule", JSON.stringify({
    mode: "automatic"
  }));

  const response = await fetch(`${DIFY_API_URL}/datasets/${datasetId}/document/create_by_file`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: difyFormData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Dify upload error:", errorText);
    throw new Error(`Dify API error: ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let action: string;
    let userId: string;
    let documentId: string | undefined;
    let formData: FormData | undefined;

    // Parse request based on content type
    if (contentType.includes("multipart/form-data")) {
      formData = await req.formData();
      action = formData.get("action") as string;
      userId = formData.get("userId") as string;
    } else {
      const body = await req.json();
      action = body.action;
      userId = body.userId;
      documentId = body.documentId;
    }

    console.log(`Processing action: ${action} for user: ${userId}`);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user settings from Appwrite
    const userSettings = await getUserSettings(userId);
    
    if (!userSettings || !userSettings.datasetId || !userSettings.apiKey) {
      console.log("User API settings not found or incomplete");
      return new Response(
        JSON.stringify({ error: "User API settings not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { datasetId, apiKey, maxDocuments } = userSettings;

    let result;

    switch (action) {
      case "listDocuments":
        const docs = await listDocuments(datasetId, apiKey);
        result = {
          ...docs,
          maxDocuments: maxDocuments || 5,
        };
        break;

      case "deleteDocument":
        if (!documentId) {
          return new Response(
            JSON.stringify({ error: "Document ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = await deleteDocument(datasetId, apiKey, documentId);
        break;

      case "uploadDocuments":
        if (!formData) {
          return new Response(
            JSON.stringify({ error: "Form data with files is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = await uploadDocuments(datasetId, apiKey, formData);
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Edge function error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});