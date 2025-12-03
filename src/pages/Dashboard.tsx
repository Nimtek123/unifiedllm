import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, MessageSquare, FileText, LogOut, FolderOpen, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import { account, databases, DATABASE_ID, COLLECTIONS } from "@/integrations/appwrite/client";

const Dashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [fileCount, setFileCount] = useState(0);
  const [hasApiSettings, setHasApiSettings] = useState(false);
  const [maxDocuments, setMaxDocuments] = useState(5);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await account.get();
      setUser(currentUser);
      const labels = currentUser.labels || [];
      setIsAdmin(labels.includes("admin"));
      await loadUserSettings(currentUser.$id);
    } catch (error) {
      navigate("/auth");
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserSettings = async (userId: string) => {
    try {
      const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_SETTINGS);
      const userSettings = response.documents.find((doc: any) => doc.userId === userId);
      
      if (userSettings?.datasetId && userSettings?.apiKey) {
        setHasApiSettings(true);
        setMaxDocuments(userSettings.maxDocuments || 5);
        await fetchDocumentCount(userSettings.datasetId, userSettings.apiKey);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const fetchDocumentCount = async (datasetId: string, apiKey: string) => {
    try {
      const response = await fetch(
        `https://dify.unified-bi.org/v1/datasets/${datasetId}/documents?page=1&limit=100`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setFileCount(data.total || data.data?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await account.deleteSession("current");
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error: any) {
      toast.error(error.message);
    }
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
                <Button variant="link" className="p-0 h-auto text-amber-700 dark:text-amber-300 underline" onClick={() => navigate("/settings")}>
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
              <div className="text-2xl font-bold">{fileCount} / {maxDocuments}</div>
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
                {hasApiSettings ? (fileCount > 0 ? "Ready to chat" : "Upload documents first") : "Configure API settings"}
              </p>
            </CardContent>
          </Card>

          <Card 
            className="gradient-primary text-white cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => isAdmin ? navigate("/admin") : navigate("/settings")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{isAdmin ? "Manage Users" : "Account"}</CardTitle>
              <Users className="w-4 h-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isAdmin ? "Admin Panel" : "Settings"}</div>
              <p className="text-xs opacity-90">{isAdmin ? "Manage user accounts & permissions" : "Configure your account"}</p>
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
              <Button className="w-full" variant="outline" onClick={() => navigate("/documents")} disabled={!hasApiSettings}>
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
              <Button className="w-full" onClick={() => navigate("/chat")} disabled={!hasApiSettings || fileCount === 0}>
                {hasApiSettings ? (fileCount > 0 ? "Start Chatting" : "Upload Docs First") : "Configure Settings First"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;