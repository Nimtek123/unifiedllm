import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Brain, ArrowLeft, Mail, KeyRound, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { account, appwriteDb, DATABASE_ID, COLLECTIONS, Query } from "@/integrations/appwrite/client";

type Step = "email" | "code" | "password";
const RESET_CODES_COLLECTION = "user_accounts";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Generate 8-character reset code
      const generatedCode = [...crypto.getRandomValues(new Uint8Array(8))]
        .map((v) => (v % 36).toString(36).toUpperCase())
        .join("");

      // Save the code in Appwrite DB
      await appwriteDb.createDocument(DATABASE_ID, RESET_CODES_COLLECTION, "unique()", {
        email,
        security_code: generatedCode,
        expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(), // 15 min expiry
        used: false,
      });

      // Call an Appwrite function to send the email
      await functions.createExecution("sendPasswordResetEmail", {
        email,
        code: generatedCode,
      });

      toast.success("If this email exists, a reset code has been sent.");
      setStep("code");
    } catch (error: any) {
      console.error(error);
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
      const res = await appwriteDb.listDocuments(DATABASE_ID, RESET_CODES_COLLECTION, [
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
      const execution = await functions.createExecution("resetPassword", {
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
              {step === "email" && (
                <>
                  <Mail className="w-5 h-5" /> Email Verification
                </>
              )}
              {step === "code" && (
                <>
                  <KeyRound className="w-5 h-5" /> Enter Code
                </>
              )}
              {step === "password" && (
                <>
                  <Lock className="w-5 h-5" /> New Password
                </>
              )}
            </CardTitle>
            <CardDescription>Step {step === "email" ? "1" : step === "code" ? "2" : "3"} of 3</CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" && (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send Reset Code"}
                </Button>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Reset Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="XXXXXXXX"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
                    required
                    disabled={isLoading}
                    className="text-center text-2xl tracking-widest font-mono"
                    maxLength={8}
                  />
                  <p className="text-sm text-muted-foreground text-center">Check your email for the 8-character code</p>
                </div>
                <Button type="submit" className="w-full" disabled={code.length !== 8}>
                  Verify Code
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("email")}>
                  Didn't receive code? Try again
                </Button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={() => navigate("/auth")} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign In
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
