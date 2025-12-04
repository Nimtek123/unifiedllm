import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, MessageSquare, FileText, LogOut, FolderOpen, Settings, Users, Activity } from "lucide-react";
import { toast } from "sonner";
import { account, difyApi } from "@/integrations/appwrite/client";
import SubUserManagement from "@/components/SubUserManagement";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PingLog {
  date: Date;
  method: string;
  path: string;
  status: number;
  response: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [fileCount, setFileCount] = useState(0);
  const [hasApiSettings, setHasApiSettings] = useState(false);
  const [maxDocuments, setMaxDocuments] = useState(5);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pingStatus, setPingStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pingLogs, setPingLogs] = useState<PingLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // First, try to get current session
      const session = await account.getSession("current");

      // Then get account with the session
      const currentUser = await account.get();
      setUser(currentUser);
      const labels = currentUser.labels || [];
      setIsAdmin(labels.includes("admin"));
      await loadUserData(currentUser.$id);
    } catch (error) {
      console.log("Auth check failed, trying fallback:", error);

      // Fallback 1: Try to create session from stored data
      const storedSession = localStorage.getItem("appwrite_session");
      if (storedSession) {
        try {
          const sessionData = JSON.parse(storedSession);
          const decodedPassword = atob(sessionData.encodedPassword);

          console.log(decodedPassword);
          // Try to create session with stored credentials
          const newSession = await account.createEmailPasswordSession(
            sessionData.email,
            decodedPassword, // You'll need to store password securely or use different approach
          );

          // Retry account.get() with new session
          const currentUser = await account.get();
          setUser(currentUser);
          await loadUserData(currentUser.$id);
          return;
        } catch (sessionError) {
          console.log("Session recreation failed:", sessionError);
        }
      }

      // Fallback 2: Set user from stored data only
      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        setUser({
          $id: sessionData.userId,
          name: sessionData.name || sessionData.email,
          email: sessionData.email,
        });
        await loadUserData(sessionData.userId);
      } else {
        navigate("/auth");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      const result = await difyApi.listDocuments(userId);
      setFileCount(result.total || result.data?.length || 0);
      setMaxDocuments(result.maxDocuments || 5);
      setHasApiSettings(true);
    } catch (error: any) {
      if (error.message?.includes("not configured")) {
        setHasApiSettings(false);
      } else {
        console.error("Error loading user data:", error);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await account.deleteSession("current");
    } catch (error) {
      // Session might not exist on server, continue anyway
    }
    localStorage.removeItem("appwrite_session");
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const sendPing = async () => {
    if (pingStatus === "loading") return;
    setPingStatus("loading");
    try {
      const result = await account.get();
      const log: PingLog = {
        date: new Date(),
        method: "GET",
        path: "/v1/account",
        status: 200,
        response: `User: ${result.email}`,
      };
      setPingLogs((prev) => [log, ...prev]);
      setPingStatus("success");
      toast.success("Server is online and responding");
    } catch (err: any) {
      const log: PingLog = {
        date: new Date(),
        method: "GET",
        path: "/v1/account",
        status: err.code || 500,
        response: err.message || "Connection failed",
      };
      setPingLogs((prev) => [log, ...prev]);
      setPingStatus("error");
      toast.error("Ping failed: " + log.response);
    }
    setShowLogs(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-subtle">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white font-bold">
              UL
            </div>
            <h1 className="text-xl font-bold">Unified LLM Portal</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h2 className="text-3xl font-bold mb-2">Welcome back, {user?.name || "User"}!</h2>
          <p className="text-muted-foreground">Manage your knowledge base and chat with your AI assistant</p>
        </div>

        {!hasApiSettings && (
          <Card className="mb-8 border-amber-500/50 bg-amber-500/10 animate-slide-up">
            <CardContent className="py-4">
              <p className="text-amber-700 dark:text-amber-300">
                Please configure your API settings to start using the portal.{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto text-amber-700 dark:text-amber-300 underline"
                  onClick={() => navigate("/settings")}
                >
                  Go to Settings
                </Button>
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-3 mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {fileCount} / {maxDocuments}
              </div>
              <p className="text-xs text-muted-foreground">Files in your knowledge base</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Workflow Status</CardTitle>
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{hasApiSettings && fileCount > 0 ? "Active" : "Setup Required"}</div>
              <p className="text-xs text-muted-foreground">
                {hasApiSettings
                  ? fileCount > 0
                    ? "Ready to chat"
                    : "Upload documents first"
                  : "Configure API settings"}
              </p>
            </CardContent>
          </Card>

          <Card
            className="gradient-primary text-white cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => (isAdmin ? navigate("/admin") : navigate("/settings"))}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{isAdmin ? "Manage Users" : "Account"}</CardTitle>
              <Users className="w-4 h-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isAdmin ? "Admin Panel" : "Settings"}</div>
              <p className="text-xs opacity-90">
                {isAdmin ? "Manage user accounts & permissions" : "Configure your account"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Upload Documents
              </CardTitle>
              <CardDescription>Add PDFs, DOCX, or TXT files to your private knowledge base</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate("/upload")} disabled={!hasApiSettings}>
                {hasApiSettings ? "Go to Upload" : "Configure Settings First"}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                Manage Documents
              </CardTitle>
              <CardDescription>View, manage, and delete your uploaded documents</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => navigate("/documents")}
                disabled={!hasApiSettings}
              >
                View Documents
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Chat with AI
              </CardTitle>
              <CardDescription>Query your documents using natural language</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => navigate("/chat")}
                disabled={!hasApiSettings || fileCount === 0}
              >
                {hasApiSettings ? (fileCount > 0 ? "Start Chatting" : "Upload Docs First") : "Configure Settings First"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Server Connection Test */}
        <Card className="mt-8 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <CardHeader>
            <CardTitle>Server Connection</CardTitle>
            <CardDescription>Test connectivity to the backend server</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium">Server Status</Label>
                  {pingStatus !== "idle" && (
                    <Badge
                      variant={
                        pingStatus === "success" ? "default" : pingStatus === "error" ? "destructive" : "secondary"
                      }
                    >
                      {pingStatus === "success" ? "Online" : pingStatus === "error" ? "Error" : "Testing..."}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Endpoint: appwrite.unified-bi.org</p>
              </div>
              <Button onClick={sendPing} disabled={pingStatus === "loading"} variant="outline">
                {pingStatus === "loading" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Pinging...
                  </>
                ) : (
                  <>
                    <Activity className="mr-2 h-4 w-4" />
                    Send Ping
                  </>
                )}
              </Button>
            </div>

            {showLogs && pingLogs.length > 0 && (
              <div className="mt-6 space-y-2">
                <Label className="text-base font-medium">Request Log</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Path</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Response</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pingLogs.slice(0, 5).map((log, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-xs">{log.date.toLocaleTimeString()}</TableCell>
                          <TableCell className="text-xs font-mono">{log.method}</TableCell>
                          <TableCell className="text-xs font-mono">{log.path}</TableCell>
                          <TableCell>
                            <Badge variant={log.status === 200 ? "default" : "destructive"}>{log.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-xs truncate">{log.response}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Management Section */}
        <div className="mt-8 animate-slide-up" style={{ animationDelay: "0.4s" }}>
          <SubUserManagement />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
