import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Brain, Sparkles, ArrowLeft } from "lucide-react";
import { account, ID } from "@/integrations/appwrite/client";
import { supabase } from "@/integrations/supabase/client";
import ReCAPTCHA from "react-google-recaptcha";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const projectId = "6921fb6b001624e640e3";

  // Multi-step signup state
  const [signupStep, setSignupStep] = useState<"form" | "verify">("form");
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => {
    setCheckingSession(false);
  }, []);

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const selectedPlan = location.state?.selectedPlan;

  const handleSendVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!captchaToken) {
      toast.error("Please complete the CAPTCHA verification");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      // Call an Appwrite function to handle everything
      const execution = await functions.createExecution(
        "693ca01700141790a74b", // Your function ID
        JSON.stringify({
          email: email,
          action: "send_reset_code", // Specify action
        }),
      );

      const response = JSON.parse(execution.responseBody);

      if (response.success) {
        toast.success("Verification code sent to your email");
        setSignupStep("verify");
      } else {
        toast.error(response.error || "Failed to send reset code");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send verification code");
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationCode = async () => {
    setIsLoading(true);

    try {
      // Call an Appwrite function to handle everything
      const execution = await functions.createExecution(
        "693ca01700141790a74b", // Your function ID
        JSON.stringify({
          email: email,
          action: "send_reset_code", // Specify action
        }),
      );

      const response = JSON.parse(execution.responseBody);

      if (response.success) {
        toast.success("Verification code sent to your email");
      } else {
        toast.error(response.error || "Failed to send reset code");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send verification code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndSignUp = async () => {
    if (otpCode.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    setIsLoading(true);

    try {
      // Verify the code
      // Call the edge function
      const execution = await functions.createExecution("693cc640003623bac07b", JSON.stringify({ email, code }));

      const response = JSON.parse(execution.responseBody);

      if (!response.valid) {
        toast.error("Invalid or expired code");
        return;
      }

      // Create user account after verification
      await account.create(ID.unique(), email, password, fullName);

      // Create a session immediately after signup
      const session = await account.createEmailPasswordSession(email, password);

      // Store session info locally
      localStorage.setItem(
        "appwrite_session",
        JSON.stringify({
          userId: session.userId,
          sessionId: session.$id,
          sessionSecret: session.secret,
          email,
          name: fullName,
        }),
      );

      toast.success("Account created! Welcome to Unified LLM Portal");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to verify code or create account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!captchaToken) {
      toast.error("Please complete the CAPTCHA verification");
      return;
    }

    setIsLoading(true);

    try {
      const session = await account.createEmailPasswordSession(email, password);
      const encodedPassword = btoa(password);

      localStorage.setItem(
        "appwrite_session",
        JSON.stringify({
          userId: session.userId,
          sessionId: session.$id,
          email,
          encodedPassword,
        }),
      );
      document.cookie = `a_session_${projectId}=${session.secret}; path=/; domain=.unified-bi.org; secure; samesite=none`;
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Invalid email or password");
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const onCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
  };

  const handleBackToSignupForm = () => {
    setSignupStep("form");
    setOtpCode("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-subtle p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary text-white mb-4 shadow-glow">
            <Brain className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Unified LLM Portal</h1>
          <p className="text-muted-foreground">
            {selectedPlan ? `Sign up for ${selectedPlan} plan` : "Your private AI knowledge assistant"}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>Sign in or create a new account</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={selectedPlan ? "signup" : "signin"} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup" disabled={signupStep === "verify"}>
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex justify-center">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                      onChange={onCaptchaChange}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                  <div className="text-center">
                    <a href="/forgot-password" className="text-sm text-primary hover:underline">
                      Forgot password?
                    </a>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {signupStep === "form" ? (
                  <form onSubmit={handleSendVerificationCode} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        minLength={8}
                      />
                    </div>
                    <div className="flex justify-center">
                      <ReCAPTCHA
                        ref={recaptchaRef}
                        sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                        onChange={onCaptchaChange}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Sending code..." : "Continue"}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <Button variant="ghost" size="sm" onClick={handleBackToSignupForm} className="mb-2">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>

                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-2">Verify your email</h3>
                      <p className="text-sm text-muted-foreground mb-4">Enter the 8-digit code sent to {email}</p>
                    </div>

                    <div className="flex justify-center">
                      <InputOTP maxLength={8} value={otpCode} onChange={(value) => setOtpCode(value)}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <Button
                      onClick={handleVerifyAndSignUp}
                      className="w-full"
                      disabled={isLoading || otpCode.length !== 6}
                    >
                      {isLoading ? "Verifying..." : "Verify & Create Account"}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                      Didn't receive the code?{" "}
                      <button
                        type="button"
                        onClick={handleResendVerificationCode}
                        className="text-primary hover:underline"
                        disabled={isLoading}
                      >
                        Resend
                      </button>
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <a href="/pricing" className="text-primary hover:underline mr-4">
            View pricing plans
          </a>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>Powered by Dify AI</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
