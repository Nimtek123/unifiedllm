import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APPWRITE_ENDPOINT = 'https://appwrite.unified-bi.org/v1';
const PROJECT_ID = '6921fb6b001624e640e3';
const DATABASE_ID = '692f6e880008c421e414';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const appwriteApiKey = Deno.env.get('APPWRITE_API_KEY');
    if (!appwriteApiKey) {
      throw new Error('APPWRITE_API_KEY not configured');
    }

    const { action, userId, collectionId, documentId, data } = await req.json();

    // Validate required fields
    if (!action) {
      throw new Error('Action is required');
    }

    let path = '';
    let method = 'GET';
    let body: string | undefined;

    switch (action) {
      case 'listDocuments':
        if (!collectionId) throw new Error('collectionId is required');
        path = `/databases/${DATABASE_ID}/collections/${collectionId}/documents`;
        break;

      case 'getDocument':
        if (!collectionId || !documentId) throw new Error('collectionId and documentId are required');
        path = `/databases/${DATABASE_ID}/collections/${collectionId}/documents/${documentId}`;
        break;

      case 'createDocument':
        if (!collectionId || !documentId || !data) throw new Error('collectionId, documentId, and data are required');
        path = `/databases/${DATABASE_ID}/collections/${collectionId}/documents`;
        method = 'POST';
        body = JSON.stringify({ documentId, data });
        break;

      case 'updateDocument':
        if (!collectionId || !documentId || !data) throw new Error('collectionId, documentId, and data are required');
        path = `/databases/${DATABASE_ID}/collections/${collectionId}/documents/${documentId}`;
        method = 'PATCH';
        body = JSON.stringify({ data });
        break;

      case 'deleteDocument':
        if (!collectionId || !documentId) throw new Error('collectionId and documentId are required');
        path = `/databases/${DATABASE_ID}/collections/${collectionId}/documents/${documentId}`;
        method = 'DELETE';
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Appwrite proxy: ${action} ${path}`);

    const response = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': PROJECT_ID,
        'X-Appwrite-Key': appwriteApiKey,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Appwrite error:', error);
      throw new Error(error.message || 'Appwrite request failed');
    }

    const result = action === 'deleteDocument' ? { success: true } : await response.json();

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Appwrite proxy error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
