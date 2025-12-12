import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Brain, ArrowLeft, Mail, KeyRound, Lock } from "lucide-react";
import { Client, Databases, Functions } from "appwrite";
import { account, appwriteDb, DATABASE_ID, COLLECTIONS, Query } from "@/integrations/appwrite/client";

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT);

const db = new Databases(client);
const functions = new Functions(client);

const RESET_CODES_COLLECTION = "user_accounts";

type Step = "email" | "code" | "password";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /** STEP 1 — Send Reset Code */
  const handleSendCode = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    // 1. Check if user exists in Appwrite Auth
    let userFound = null;
    try {
      // Try login with fake password to see if email exists
      await appwriteAccount.createEmailPasswordSession(email, "invalid");
    } catch (err: any) {
      if (err?.response?.message?.includes("Invalid credentials")) {
        userFound = true; 
      }
    }

    if (!userFound) {
      toast.success("If this email exists, a reset code has been sent.");
      setStep("code");
      return;
    }

    // 2. Generate random 8-character code
    const resetCode = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((v) => (v % 36).toString(36).toUpperCase())
      .join("");

    // 3. Store in Appwrite database (upsert)
    const existing = await appwriteDb.listDocuments(DATABASE_ID, USER_ACCOUNTS, [
      Query.equal("email", email),
    ]);

    if (existing.documents.length > 0) {
      await appwriteDb.updateDocument(
        DATABASE_ID,
        USER_ACCOUNTS,
        existing.documents[0].$id,
        { security_code: resetCode }
      );
    } else {
      await appwriteDb.createDocument(
        DATABASE_ID,
        USER_ACCOUNTS,
        ID.unique(),
        { email, security_code: resetCode }
      );
    }

    toast.success("If this email exists, a reset code has been sent.");
    setStep("code");
  } catch (error: any) {
    toast.error(error.message || "Failed to send reset code");
  } finally {
    setIsLoading(false);
  }
};


  /** STEP 2 — Verify Code */
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 8) {
      toast.error("Please enter the 8-character code");
      return;
    }

    try {
      const res = await db.listDocuments(DATABASE_ID, RESET_CODES_COLLECTION, [
        Query.equal("email", email),
        Query.equal("code", code.toUpperCase()),
        Query.equal("used", false),
      ]);

      if (res.documents.length === 0) {
        toast.error("Invalid or expired code");
        return;
      }

      setStep("password");
    } catch (error: any) {
      toast.error("Verification failed");
    }
  };

  /** STEP 3 — Reset Password */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      // Call Appwrite backend function to update the password
      const execution = await functions.createExecution("update-user-password", {
        email,
        code: code.toUpperCase(),
        newPassword,
      });

      const response = JSON.parse(execution.responseBody);

      if (response.error) throw new Error(response.error);

      toast.success("Password updated successfully!");
      navigate("/auth");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-subtle p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary text-white mb-4 shadow-glow">
            <Brain className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
          <p className="text-muted-foreground">
            {step === "email" && "Enter your email to receive a reset code"}
            {step === "code" && "Enter the 8-character code sent to your email"}
            {step === "password" && "Create your new password"}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === "email" && <Mail className="w-5 h-5" />}
              {step === "code" && <KeyRound className="w-5 h-5" />}
              {step === "password" && <Lock className="w-5 h-5" />}
              {step === "email" && "Email Verification"}
              {step === "code" && "Enter Code"}
              {step === "password" && "New Password"}
            </CardTitle>
            <CardDescription>
              Step {step === "email" ? "1" : step === "code" ? "2" : "3"} of 3
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* STEP 1 — EMAIL */}
            {step === "email" && (
              <form onSubmit={handleSendCode} className="space-y-4">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <Button className="w-full">{isLoading ? "Sending..." : "Send Reset Code"}</Button>
              </form>
            )}

            {/* STEP 2 — CODE */}
            {step === "code" && (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <Label>Reset Code</Label>
                <Input
                  type="text"
                  placeholder="XXXXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
                  maxLength={8}
                  className="text-center text-2xl tracking-widest font-mono"
                />
                <Button className="w-full" disabled={code.length !== 8}>
                  Verify Code
                </Button>
              </form>
            )}

            {/* STEP 3 — PASSWORD */}
            {step === "password" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <Button className="w-full">{isLoading ? "Updating..." : "Update Password"}</Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={() => navigate("/auth")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
