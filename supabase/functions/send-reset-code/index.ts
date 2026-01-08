import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APPWRITE_ENDPOINT = "https://appwrite.unified-bi.org/v1";
const PROJECT_ID = "695514d70000b996a41e";
const DATABASE_ID = "692f6e880008c421e414";
const COLLECTION_USER_ACCOUNTS = "user_accounts";

serve(async (req) => {
  // Handle CORS preflight requests
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

    // First verify the email exists in Appwrite users
    const usersResponse = await fetch(
      `${APPWRITE_ENDPOINT}/users?queries[]=${encodeURIComponent(`equal("email", ["${normalizedEmail}"])`)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": PROJECT_ID,
          "X-Appwrite-Key": APPWRITE_API_KEY!,
        },
      },
    );

    const usersData = await usersResponse.json();

    if (!usersData.users || usersData.users.length === 0) {
      // Don't reveal if email exists or not for security
      return new Response(
        JSON.stringify({ success: true, message: "If this email exists, a reset code has been sent." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate random 8-character code
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let securityCode = "";
    for (let i = 0; i < 8; i++) {
      securityCode += characters.charAt(Math.floor(Math.random() * characters.length));
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
      },
    );

    const existingDocs = await existingDocsResponse.json();
    console.log("Existing docs for email:", existingDocs);

    if (existingDocs.documents && existingDocs.documents.length > 0) {
      // Update existing document with new security code
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
            data: { security_code: securityCode },
          }),
        },
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        console.error("Error updating reset code:", error);
        throw new Error("Failed to update reset code");
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
              security_code: securityCode,
            },
          }),
        },
      );

      if (!createResponse.ok) {
        const error = await createResponse.json();
        console.error("Error creating reset code:", error);
        throw new Error("Failed to create reset code");
      }
    }

    console.log(`Password reset code for ${normalizedEmail}: ${securityCode}`);

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
        } else {
          console.log("Reset email sent successfully");
        }
      } catch (emailErr) {
        console.error("Email sending error:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "If this email exists, a reset code has been sent." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in send-reset-code:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
