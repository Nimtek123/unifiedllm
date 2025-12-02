import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, FileText, Upload } from "lucide-react";

const Chat = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasDocuments, setHasDocuments] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      await checkDocuments(session.user.id);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkDocuments = async (userId: string) => {
    try {
      const { count } = await supabase
        .from("files")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      
      setHasDocuments((count || 0) > 0);
    } catch (error) {
      console.error("Error checking documents:", error);
    } finally {
      setIsLoading(false);
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
    <div className="min-h-screen gradient-subtle flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1 flex flex-col">
        {!hasDocuments ? (
          <Card className="max-w-lg mx-auto animate-slide-up">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle>No Documents Found</CardTitle>
              <CardDescription>
                You need to upload at least one document before you can chat with the AI assistant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate("/upload")}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Documents
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex-1 flex flex-col animate-slide-up">
            <div className="mb-4">
              <h2 className="text-2xl font-bold">Chat with Your AI</h2>
              <p className="text-muted-foreground">Ask questions about your uploaded documents</p>
            </div>
            <Card className="flex-1 overflow-hidden">
              <CardContent className="p-0 h-full">
                <iframe
                  src="http://dify.unified-bi.org:8088/chatbot/LejUgszGK0FV7PVK"
                  style={{ width: "100%", height: "100%", minHeight: "700px" }}
                  frameBorder="0"
                  allow="microphone"
                  title="AI Chat"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Chat;
