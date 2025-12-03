import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { account, databases, DATABASE_ID, COLLECTIONS, ID } from "@/integrations/appwrite/client";
import { AlertTriangle, Eye, EyeOff, Save, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [settingsDocId, setSettingsDocId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoadSettings();
  }, []);

  const checkAuthAndLoadSettings = async () => {
    try {
      const user = await account.get();
      const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_SETTINGS);
      const userSettings = response.documents.find((doc: any) => doc.userId === user.$id);
      
      if (userSettings) {
        setDatasetId(userSettings.datasetId || "");
        setApiKey(userSettings.apiKey || "");
        setSettingsDocId(userSettings.$id);
      }
    } catch (error: any) {
      if (error.code === 401) {
        navigate("/auth");
      }
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!datasetId.trim() || !apiKey.trim()) {
      toast.error("Please fill in both Dataset ID and API Key");
      return;
    }

    setSaving(true);
    try {
      const user = await account.get();
      
      const data = {
        userId: user.$id,
        datasetId: datasetId.trim(),
        apiKey: apiKey.trim(),
        updatedAt: new Date().toISOString(),
      };

      if (settingsDocId) {
        await databases.updateDocument(DATABASE_ID, COLLECTIONS.USER_SETTINGS, settingsDocId, data);
      } else {
        const doc = await databases.createDocument(DATABASE_ID, COLLECTIONS.USER_SETTINGS, ID.unique(), data);
        setSettingsDocId(doc.$id);
      }

      toast.success("Settings saved successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-subtle">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 animate-slide-up">
            <h2 className="text-3xl font-bold mb-2">API Settings</h2>
            <p className="text-muted-foreground">Configure your Dify API credentials to connect your knowledge base.</p>
          </div>

          <Card className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <CardTitle>Dify Configuration</CardTitle>
              <CardDescription>Enter your Dataset ID and API Key from Dify.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  To prevent API abuse, protect your API Key. Avoid using it as plain text in front-end code. :)
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="datasetId">Dataset ID</Label>
                <Input
                  id="datasetId"
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  placeholder="e.g., d0351bfd-defa-443f-8d77-c5d5b5eff704"
                />
                <p className="text-sm text-muted-foreground">Your unique dataset identifier from Dify.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="e.g., dataset-IqgHiXUlyi1giWH3hCZvvdT7"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Your API key is stored securely.</p>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
