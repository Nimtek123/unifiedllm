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
    const { email, code, newPassword } = await req.json();

    if (!email || !code || !newPassword) {
      return new Response(JSON.stringify({ error: "Email, code, and new password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPassword.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const APPWRITE_API_KEY = Deno.env.get("APPWRITE_API_KEY");
    const normalizedEmail = email.toLowerCase();
    const normalizedCode = code.toUpperCase();

    // Verify the code in Appwrite user_accounts collection
    const docsResponse = await fetch(
      `${APPWRITE_ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_USER_ACCOUNTS}/documents?queries[]=${encodeURIComponent(`equal("email", ["${normalizedEmail}"])`)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": PROJECT_ID,
          "X-Appwrite-Key": APPWRITE_API_KEY!,
        },
      },
    );

    const docsData = await docsResponse.json();
    console.log("Docs for email:", docsData);

    if (!docsData.documents || docsData.documents.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userAccountDoc = docsData.documents[0];

    // Check if code matches
    if (userAccountDoc.security_code !== normalizedCode) {
      return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from Appwrite users
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
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = usersData.users[0].$id;

    // Update password in Appwrite
    const updateResponse = await fetch(`${APPWRITE_ENDPOINT}/users/${userId}/password`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": PROJECT_ID,
        "X-Appwrite-Key": APPWRITE_API_KEY!,
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error("Appwrite password update error:", errorData);
      return new Response(JSON.stringify({ error: "Failed to update password" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clear the security code after use
    await fetch(
      `${APPWRITE_ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_USER_ACCOUNTS}/documents/${userAccountDoc.$id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": PROJECT_ID,
          "X-Appwrite-Key": APPWRITE_API_KEY!,
        },
        body: JSON.stringify({
          data: { security_code: null },
        }),
      },
    );

    console.log("Password updated successfully for:", normalizedEmail);

    return new Response(JSON.stringify({ success: true, message: "Password updated successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in reset-password:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
