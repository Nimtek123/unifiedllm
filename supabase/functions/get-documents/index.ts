import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const difyApiKey = Deno.env.get('DIFY_API_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`Fetching documents for user: ${user.id}`);

    // Get user's dataset
    const { data: dataset, error: datasetError } = await supabaseClient
      .from('datasets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (datasetError) {
      console.error('Error fetching dataset:', datasetError);
      throw new Error('Failed to fetch dataset');
    }

    if (!dataset) {
      console.log('No dataset found for user');
      return new Response(
        JSON.stringify({ documents: [], total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Using dataset: ${dataset.dify_dataset_id}`);

    // Fetch documents from Dify API
    const difyResponse = await fetch(
      `https://dify.unified-bi.org/v1/datasets/${dataset.dify_dataset_id}/documents?page=1&limit=100`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${difyApiKey}`,
        },
      }
    );

    if (!difyResponse.ok) {
      const errorText = await difyResponse.text();
      console.error('Dify API error:', errorText);
      throw new Error('Failed to fetch documents from Dify');
    }

    const difyData = await difyResponse.json();
    console.log(`Found ${difyData.total || 0} documents`);

    return new Response(
      JSON.stringify({
        documents: difyData.data || [],
        total: difyData.total || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
