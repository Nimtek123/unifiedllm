import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APPWRITE_ENDPOINT = "https://appwrite.unified-bi.org/v1";
const PROJECT_ID = "695514d70000b996a41e";
const DATABASE_ID = "692f6e880008c421e414";
const USER_SETTINGS_COLLECTION = "user_settings";
const TEAM_MEMBERS_COLLECTION = "team_members";
const APPWRITE_API_KEY =
  "standard_b21d55c9c77abc712095488fa957328c5a8d19dda991e27bdf14285d2409e943f654d4d660fa041480c4a262640d647ecb5cc1f1f4fd42c9ca77304dfc348312ba15f6dd014eff439e13ac25c111ab1f54c51dec22370e685b43a0ecc7e3cf11a2691004963d3a7ac8a63df4dc8cdb6f61bd41a7d2e8db79bb8197a944cbce2e";
const DIFY_API_URL = "https://dify.unified-bi.org/v1";

interface UserSettings {
  datasetId: string;
  apiKey: string;
  maxDocuments?: number;
}

interface TeamMember {
  parentUserId: string;
  userId: string;
  can_view?: boolean;
  can_upload?: boolean;
  can_delete?: boolean;
}

// Helper to build Appwrite query URL
function buildQueryUrl(collectionId: string, attribute: string, value: string): string {
  const query = JSON.stringify({
    method: "equal",
    attribute: attribute,
    values: [value],
  });
  return `${APPWRITE_ENDPOINT}/databases/${DATABASE_ID}/collections/${collectionId}/documents?queries[]=${encodeURIComponent(query)}`;
}

// Check if user is a sub-user and get their parent's ID
async function getParentUserId(userId: string): Promise<string | null> {
  try {
    console.log(`Checking if user ${userId} is a sub-user...`);

    const queryUrl = buildQueryUrl(TEAM_MEMBERS_COLLECTION, "userId", userId);
    console.log(`Query URL: ${queryUrl}`);

    const response = await fetch(queryUrl, {
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": PROJECT_ID,
        "X-Appwrite-Key": APPWRITE_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to check team_members:", errorText);
      return null;
    }

    const data = await response.json();
    console.log(`team_members query returned ${data.documents?.length || 0} documents`);

    if (data.documents && data.documents.length > 0) {
      const teamMember = data.documents[0] as TeamMember;
      console.log(`User ${userId} is a sub-user of parent ${teamMember.parentUserId}`);
      return teamMember.parentUserId;
    }

    console.log(`User ${userId} is not a sub-user (no team_members record found)`);
    return null;
  } catch (error) {
    console.error("Error checking team_members:", error);
    return null;
  }
}

// Fetch user settings from Appwrite
async function getUserSettings(userId: string): Promise<UserSettings | null> {
  try {
    console.log(`Fetching user settings for userId: ${userId}`);

    const queryUrl = buildQueryUrl(USER_SETTINGS_COLLECTION, "userId", userId);
    console.log(`Query URL: ${queryUrl}`);

    const response = await fetch(queryUrl, {
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": PROJECT_ID,
        "X-Appwrite-Key": APPWRITE_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch user settings:", errorText);
      return null;
    }

    const data = await response.json();
    console.log(`user_settings query returned ${data.documents?.length || 0} documents`);

    if (data.documents && data.documents.length > 0) {
      const settings = data.documents[0];
      console.log(
        `Found settings with datasetId: ${settings.datasetId ? "yes" : "no"}, apiKey: ${settings.apiKey ? "yes" : "no"}`,
      );
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

// Get credentials - checks if sub-user first, then uses parent's credentials
async function getCredentials(userId: string): Promise<UserSettings | null> {
  // First, check if this user is a sub-user
  const parentUserId = await getParentUserId(userId);

  if (parentUserId) {
    // User is a sub-user, fetch parent's credentials
    console.log(`Fetching credentials from parent user: ${parentUserId}`);
    return getUserSettings(parentUserId);
  }

  // User is not a sub-user, fetch their own credentials
  console.log(`User is not a sub-user, fetching own credentials for: ${userId}`);
  return getUserSettings(userId);
}

// List documents from Dify
async function listDocuments(datasetId: string, apiKey: string) {
  console.log(`Listing documents for dataset: ${datasetId}`);

  const response = await fetch(`${DIFY_API_URL}/datasets/${datasetId}/documents?page=1&limit=100`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
      Authorization: `Bearer ${apiKey}`,
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
  difyFormData.append(
    "process_rule",
    JSON.stringify({
      mode: "automatic",
    }),
  );

  const response = await fetch(`${DIFY_API_URL}/datasets/${datasetId}/document/create_by_file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credentials (checks for sub-user and uses parent's credentials if applicable)
    const userSettings = await getCredentials(userId);

    if (!userSettings || !userSettings.datasetId || !userSettings.apiKey) {
      console.log("User API settings not found or incomplete");
      return new Response(
        JSON.stringify({
          error: "User API settings not configured. Please ask your administrator to configure API settings.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
          return new Response(JSON.stringify({ error: "Document ID is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await deleteDocument(datasetId, apiKey, documentId);
        break;

      case "uploadDocuments":
        if (!formData) {
          return new Response(JSON.stringify({ error: "Form data with files is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await uploadDocuments(datasetId, apiKey, formData);
        break;

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Edge function error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
