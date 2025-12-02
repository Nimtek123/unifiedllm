import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, MessageSquare, FileText, LogOut, FolderOpen } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [fileCount, setFileCount] = useState(0);
  const [hasWorkflow, setHasWorkflow] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await loadDashboardData(session.user.id);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadDashboardData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadDashboardData = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(profileData);

      // Fetch document count from Dify API via edge function
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.access_token) {
        const { data, error } = await supabase.functions.invoke('get-documents', {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });
        if (!error && data) {
          setFileCount(data.total || 0);
        }
      }

      const { data: workflow } = await supabase
        .from("workflows")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      setHasWorkflow(!!workflow);
    } catch (error: any) {
      console.error("Error loading dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
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
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h2 className="text-3xl font-bold mb-2">
            Welcome back, {profile?.full_name || "User"}!
          </h2>
          <p className="text-muted-foreground">Manage your knowledge base and chat with your AI assistant</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fileCount}</div>
              <p className="text-xs text-muted-foreground">Files in your knowledge base</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Workflow Status</CardTitle>
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{hasWorkflow ? "Active" : "Setup Required"}</div>
              <p className="text-xs text-muted-foreground">
                {hasWorkflow ? "Ready to chat" : "Configure your workflow"}
              </p>
            </CardContent>
          </Card>

          <Card className="gradient-primary text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              <Upload className="w-4 h-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Get Started</div>
              <p className="text-xs opacity-90">Upload files or start chatting</p>
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
              <CardDescription>
                Add PDFs, DOCX, or TXT files to your private knowledge base
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => navigate("/upload")}
              >
                Go to Upload
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                Manage Documents
              </CardTitle>
              <CardDescription>
                View, manage, and delete your uploaded documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                variant="outline"
                onClick={() => navigate("/documents")}
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
              <CardDescription>
                Query your documents using natural language
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                onClick={() => navigate("/chat")}
                disabled={fileCount === 0}
              >
                {fileCount > 0 ? "Start Chatting" : "Upload Docs First"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
