import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, FileText, Upload, AlertCircle } from "lucide-react";
import { account, difyApi } from "@/integrations/appwrite/client";

const Chat = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [hasSettings, setHasSettings] = useState(false);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const user = await account.get();
      await checkDocuments(user.$id);
    } catch (error) {
      navigate("/auth");
    }
  };

  const checkDocuments = async (userId: string) => {
    try {
      const result = await difyApi.checkDocuments(userId);
      setHasDocuments(result.hasDocuments);
      setHasSettings(true);
    } catch (error: any) {
      if (error.message?.includes('not configured')) {
        setHasSettings(false);
      } else {
        console.error("Error checking documents:", error);
      }
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
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1 flex flex-col">
        {!hasSettings ? (
          <Card className="max-w-lg mx-auto animate-slide-up">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle>API Settings Required</CardTitle>
              <CardDescription>Configure your API settings to use the chat feature.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate("/settings")}>Go to Settings</Button>
            </CardContent>
          </Card>
        ) : !hasDocuments ? (
          <Card className="max-w-lg mx-auto animate-slide-up">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle>No Documents Found</CardTitle>
              <CardDescription>You need to upload at least one document before you can chat with the AI assistant.</CardDescription>
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
                  src="https://dify.unified-bi.org/chat/LejUgszGK0FV7PVK"
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
