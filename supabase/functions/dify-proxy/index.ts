import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APPWRITE_ENDPOINT = 'https://appwrite.unified-bi.org/v1';
const PROJECT_ID = '6921fb6b001624e640e3';
const DATABASE_ID = '692f6e880008c421e414';
const USER_SETTINGS_COLLECTION = 'user_settings';
const DIFY_API_URL = 'https://dify.unified-bi.org/v1';

// Fetch user settings from Appwrite
async function getUserSettings(appwriteApiKey: string, userId: string) {
  const response = await fetch(
    `${APPWRITE_ENDPOINT}/databases/${DATABASE_ID}/collections/${USER_SETTINGS_COLLECTION}/documents`,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': PROJECT_ID,
        'X-Appwrite-Key': appwriteApiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch user settings');
  }

  const data = await response.json();
  const settings = data.documents?.find((doc: any) => doc.userId === userId);
  
  if (!settings?.datasetId || !settings?.apiKey) {
    throw new Error('User API settings not configured');
  }

  return {
    datasetId: settings.datasetId,
    apiKey: settings.apiKey,
    maxDocuments: settings.maxDocuments || 5,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const appwriteApiKey = Deno.env.get('APPWRITE_API_KEY');
    if (!appwriteApiKey) {
      throw new Error('APPWRITE_API_KEY not configured');
    }

    const contentType = req.headers.get('content-type') || '';
    
    let action: string;
    let userId: string;
    let documentId: string | undefined;
    let formData: FormData | undefined;
    let indexingTechnique: string = 'high_quality';

    // Handle multipart form data for file uploads
    if (contentType.includes('multipart/form-data')) {
      formData = await req.formData();
      action = formData.get('action') as string;
      userId = formData.get('userId') as string;
      indexingTechnique = (formData.get('indexingTechnique') as string) || 'high_quality';
    } else {
      const json = await req.json();
      action = json.action;
      userId = json.userId;
      documentId = json.documentId;
    }

    if (!action || !userId) {
      throw new Error('action and userId are required');
    }

    console.log(`Dify proxy: ${action} for user ${userId}`);

    // Get user's Dify credentials from Appwrite
    const userSettings = await getUserSettings(appwriteApiKey, userId);
    const { datasetId, apiKey, maxDocuments } = userSettings;

    let result: any;

    switch (action) {
      case 'listDocuments': {
        const response = await fetch(
          `${DIFY_API_URL}/datasets/${datasetId}/documents?page=1&limit=100`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch documents from Dify');
        }
        
        result = await response.json();
        result.maxDocuments = maxDocuments;
        break;
      }

      case 'deleteDocument': {
        if (!documentId) throw new Error('documentId is required');
        
        const response = await fetch(
          `${DIFY_API_URL}/datasets/${datasetId}/documents/${documentId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to delete document');
        }
        
        result = { success: true };
        break;
      }

      case 'uploadDocument': {
        if (!formData) throw new Error('Form data required for upload');
        
        const file = formData.get('file') as File;
        if (!file) throw new Error('No file provided');

        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('data', JSON.stringify({
          indexing_technique: indexingTechnique,
          process_rule: { mode: 'automatic' }
        }));

        const response = await fetch(
          `${DIFY_API_URL}/datasets/${datasetId}/document/create_by_file`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: uploadFormData,
          }
        );
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to upload document');
        }
        
        result = await response.json();
        break;
      }

      case 'checkDocuments': {
        const response = await fetch(
          `${DIFY_API_URL}/datasets/${datasetId}/documents?page=1&limit=1`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        
        if (!response.ok) {
          throw new Error('Failed to check documents');
        }
        
        const data = await response.json();
        result = {
          hasDocuments: (data.total || data.data?.length || 0) > 0,
          total: data.total || 0,
        };
        break;
      }

      case 'getSettings': {
        result = {
          datasetId,
          maxDocuments,
          hasApiKey: true,
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Dify proxy error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
