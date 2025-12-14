import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APPWRITE_ENDPOINT = "https://appwrite.unified-bi.org/v1";
const PROJECT_ID = "6921fb6b001624e640e3";
const DATABASE_ID = "692f6e880008c421e414";
const COLLECTION_USER_ACCOUNTS = "user_accounts";

serve(async (req) => {
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
    const normalizedEmail = email.toLowerCase();
    
    // Check if user already exists
    const usersResponse = await fetch(
      `${APPWRITE_ENDPOINT}/users?queries[]=${encodeURIComponent(`equal("email", ["${normalizedEmail}"])`)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": PROJECT_ID,
          "X-Appwrite-Key": APPWRITE_API_KEY!,
        },
      }
    );

    const usersData = await usersResponse.json();
    
    if (usersData.users && usersData.users.length > 0) {
      return new Response(
        JSON.stringify({ error: "An account with this email already exists. Please sign in." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate random 6-character code
    const characters = "0123456789";
    let verificationCode = "";
    for (let i = 0; i < 6; i++) {
      verificationCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if document exists for this email in user_accounts
    const existingDocsResponse = await fetch(
      `${APPWRITE_ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_USER_ACCOUNTS}/documents?queries[]=${encodeURIComponent(`equal("email", ["${normalizedEmail}"])`)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": PROJECT_ID,
          "X-Appwrite-Key": APPWRITE_API_KEY!,
        },
      }
    );

    const existingDocs = await existingDocsResponse.json();
    console.log("Existing docs for email:", existingDocs);

    if (existingDocs.documents && existingDocs.documents.length > 0) {
      // Update existing document with new verification code
      const docId = existingDocs.documents[0].$id;
      const updateResponse = await fetch(
        `${APPWRITE_ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_USER_ACCOUNTS}/documents/${docId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Appwrite-Project": PROJECT_ID,
            "X-Appwrite-Key": APPWRITE_API_KEY!,
          },
          body: JSON.stringify({
            data: { security_code: verificationCode },
          }),
        }
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        console.error("Error updating verification code:", error);
        throw new Error("Failed to update verification code");
      }
    } else {
      // Create new document
      const createResponse = await fetch(
        `${APPWRITE_ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_USER_ACCOUNTS}/documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Appwrite-Project": PROJECT_ID,
            "X-Appwrite-Key": APPWRITE_API_KEY!,
          },
          body: JSON.stringify({
            documentId: "unique()",
            data: {
              email: normalizedEmail,
              security_code: verificationCode,
            },
          }),
        }
      );

      if (!createResponse.ok) {
        const error = await createResponse.json();
        console.error("Error creating verification code:", error);
        throw new Error("Failed to create verification code");
      }
    }

    console.log(`Verification code for ${normalizedEmail}: ${verificationCode}`);
    
    // Send email via Resend
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

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent to your email." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-verification-code:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
