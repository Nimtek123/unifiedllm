import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APPWRITE_ENDPOINT = "https://appwrite.unified-bi.org/v1";
const PROJECT_ID = "695514d70000b996a41e";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const APPWRITE_API_KEY = Deno.env.get("APPWRITE_API_KEY");
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists in Appwrite
    const usersResponse = await fetch(
      `${APPWRITE_ENDPOINT}/users?queries[]=${encodeURIComponent(JSON.stringify(['equal("email", ["' + normalizedEmail + '"])']))}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": PROJECT_ID,
          "X-Appwrite-Key": APPWRITE_API_KEY!,
        },
      },
    );

    const usersData = await usersResponse.json();
    console.log("Users check response:", usersData);

    if (usersData.users && usersData.users.length > 0) {
      return new Response(JSON.stringify({ error: "An account with this email already exists. Please sign in." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate random 6-digit code
    const characters = "0123456789";
    let verificationCode = "";
    for (let i = 0; i < 6; i++) {
      verificationCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Use Supabase to store the verification code
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete any existing codes for this email
    await supabase.from("password_reset_codes").delete().eq("email", normalizedEmail);

    // Insert new verification code with 15 minute expiry
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase.from("password_reset_codes").insert({
      email: normalizedEmail,
      security_code: verificationCode,
      expires_at: expiresAt,
      used: false,
    });

    if (insertError) {
      console.error("Error storing verification code:", insertError);
      throw new Error("Failed to store verification code");
    }

    console.log(`Verification code for ${normalizedEmail}: ${verificationCode}`);

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Unified LLM Portal <noreply@unified-bi.org>",
            to: [email],
            subject: "Verify Your Email",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Verify Your Email</h1>
                <p>Welcome to Unified LLM Portal! Please verify your email address.</p>
                <p>Your verification code is:</p>
                <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #333;">
                  ${verificationCode}
                </div>
                <p style="margin-top: 20px;">This code expires in 15 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          console.error("Resend error:", await emailResponse.text());
        } else {
          console.log("Verification email sent successfully");
        }
      } catch (emailErr) {
        console.error("Email sending error:", emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Verification code sent to your email." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-verification-code:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
