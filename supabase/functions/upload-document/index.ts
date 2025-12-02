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

    console.log(`Upload request from user: ${user.id}`);

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`Processing file: ${file.name}, size: ${file.size}`);

    let dataset = await supabaseClient
      .from('datasets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!dataset.data) {
      console.log('Creating new dataset for user');
      const createDatasetResponse = await fetch('http://dify.unified-bi.org/v1/datasets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${difyApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Dataset for ${user.email}`,
        }),
      });

      if (!createDatasetResponse.ok) {
        const errorText = await createDatasetResponse.text();
        console.error('Dify dataset creation failed:', errorText);
        throw new Error('Failed to create dataset in Dify');
      }

      const difyDataset = await createDatasetResponse.json();
      console.log('Dify dataset created:', difyDataset.id);

      const { data: newDataset, error: insertError } = await supabaseClient
        .from('datasets')
        .insert({
          user_id: user.id,
          dify_dataset_id: difyDataset.id,
          name: 'My Knowledge Base',
        })
        .select()
        .single();

      if (insertError) throw insertError;
      dataset.data = newDataset;
    }

    const difyDatasetId = dataset.data.dify_dataset_id;
    console.log(`Using dataset: ${difyDatasetId}`);

    const kbFormData = new FormData();
    kbFormData.append('files', file);

    const uploadResponse = await fetch('http://158.220.104.64:3000/upload-kb', {
      method: 'POST',
      body: kbFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('KB upload failed:', errorText);
      throw new Error('Failed to upload to knowledge base');
    }

    const kbDocument = await uploadResponse.json();
    console.log('Document uploaded to KB:', kbDocument);

    const { error: fileInsertError } = await supabaseClient
      .from('files')
      .insert({
        user_id: user.id,
        dataset_id: dataset.data.id,
        filename: file.name,
        file_size: file.size,
        file_type: file.type,
        dify_document_id: kbDocument.id || null,
        upload_status: 'completed',
      });

    if (fileInsertError) {
      console.error('Error saving file record:', fileInsertError);
      throw fileInsertError;
    }

    let workflow = await supabaseClient
      .from('workflows')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!workflow.data) {
      console.log('Creating workflow for user');
      
      const { data: newWorkflow, error: workflowError } = await supabaseClient
        .from('workflows')
        .insert({
          user_id: user.id,
          dataset_id: dataset.data.id,
          dify_workflow_id: difyDatasetId,
          workflow_url: `http://dify.unified-bi.org/workflow/${difyDatasetId}`,
          name: 'My AI Workflow',
        })
        .select()
        .single();

      if (workflowError) {
        console.error('Error creating workflow:', workflowError);
      } else {
        console.log('Workflow created');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId: kbDocument.id || null,
        datasetId: difyDatasetId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
