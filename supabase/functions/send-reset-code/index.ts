import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APPWRITE_ENDPOINT = "https://appwrite.unified-bi.org/v1";
const PROJECT_ID = "6921fb6b001624e640e3";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const APPWRITE_API_KEY = Deno.env.get("APPWRITE_API_KEY");
    
    // First verify the email exists in Appwrite
    const usersResponse = await fetch(
      `${APPWRITE_ENDPOINT}/users?queries[]=${encodeURIComponent(`equal("email", ["${email}"])`)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": PROJECT_ID,
          "X-Appwrite-Key": APPWRITE_API_KEY!,
        },
      }
    );

    const usersData = await usersResponse.json();
    
    if (!usersData.users || usersData.users.length === 0) {
      // Don't reveal if email exists or not for security
      return new Response(
        JSON.stringify({ success: true, message: "If this email exists, a reset code has been sent." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate random 8-character code
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let securityCode = "";
    for (let i = 0; i < 8; i++) {
      securityCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Save the code to Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete any existing unused codes for this email
    await supabase
      .from("password_reset_codes")
      .delete()
      .eq("email", email.toLowerCase())
      .eq("used", false);

    // Insert new code
    const { error: insertError } = await supabase
      .from("password_reset_codes")
      .insert({
        email: email.toLowerCase(),
        security_code: securityCode,
      });

    if (insertError) {
      console.error("Error inserting reset code:", insertError);
      throw new Error("Failed to create reset code");
    }

    // Send email using a simple SMTP-like approach or log it
    // For now, we'll log the code (in production, integrate with Resend or similar)
    console.log(`Password reset code for ${email}: ${securityCode}`);
    
    // Try to send via Resend if available
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Unified LLM Portal <noreply@unified-bi.org>",
            to: [email],
            subject: "Password Reset Code",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Password Reset</h1>
                <p>You requested a password reset for your Unified LLM Portal account.</p>
                <p>Your reset code is:</p>
                <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 4px; font-weight: bold; color: #333;">
                  ${securityCode}
                </div>
                <p style="margin-top: 20px;">This code expires in 15 minutes.</p>
                <p>If you didn't request this reset, please ignore this email.</p>
              </div>
            `,
          }),
        });
        
        if (!emailResponse.ok) {
          console.error("Resend error:", await emailResponse.text());
        }
      } catch (emailErr) {
        console.error("Email sending error:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "If this email exists, a reset code has been sent." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-reset-code:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
