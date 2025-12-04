import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { account, appwriteDb, DATABASE_ID, COLLECTIONS, ID } from "@/integrations/appwrite/client";
import { AlertTriangle, Eye, EyeOff, Save, ArrowLeft, Crown, Mail, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const pricingPlans = [
  { name: "Starter", price: "$25/mo", docs: 50, description: "For solo users and small teams" },
  { name: "Business", price: "$60/mo", docs: 200, description: "Private KB per user for SMEs" },
  { name: "Business+", price: "$150/mo", docs: 500, description: "Priority support & custom workflows" },
];

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [settingsDocId, setSettingsDocId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState("free");
  const [maxDocuments, setMaxDocuments] = useState(5);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuthAndLoadSettings();
  }, []);

  const checkAuthAndLoadSettings = async () => {
    try {
      const user = await account.get();
      setIsAdmin(user.labels?.includes("admin") || false);

      const response = await appwriteDb.listDocuments(DATABASE_ID, COLLECTIONS.USER_SETTINGS);
      const userSettings = response.documents.find((doc: any) => doc.userId === user.$id);

      if (userSettings) {
        setDatasetId(userSettings.datasetId || "");
        setApiKey(userSettings.apiKey || "");
        setSettingsDocId(userSettings.$id);
        setAccountType(userSettings.accountType || "free");
        setMaxDocuments(userSettings.maxDocuments || 5);
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

  const verifyCredentials = async (datasetId: string, apiKey: string): Promise<boolean> => {
    try {
      const response = await fetch(`https://dify.unified-bi.org/v1/datasets/${datasetId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    if (!datasetId.trim() || !apiKey.trim()) {
      toast.error("Please fill in both Dataset ID and API Key");
      return;
    }

    setSaving(true);
    try {
      // Verify credentials before saving
      const isValid = await verifyCredentials(datasetId.trim(), apiKey.trim());
      if (!isValid) {
        toast.error("Invalid credentials. Please check your Dataset ID and API Key.");
        setSaving(false);
        return;
      }

      const user = await account.get();

      const data = {
        userId: user.$id,
        datasetId: datasetId.trim(),
        apiKey: apiKey.trim(),
        accountType,
        maxDocuments,
        updatedAt: new Date().toISOString(),
      };

      if (settingsDocId) {
        await appwriteDb.updateDocument(DATABASE_ID, COLLECTIONS.USER_SETTINGS, settingsDocId, data);
      } else {
        const doc = await appwriteDb.createDocument(DATABASE_ID, COLLECTIONS.USER_SETTINGS, ID.unique(), data);
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
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="mb-8 animate-slide-up">
            <h2 className="text-3xl font-bold mb-2">Settings</h2>
            <p className="text-muted-foreground">Manage your account and API configuration.</p>
          </div>

          {/* Account Info Card */}
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {datasetId && apiKey ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Account Type</span>
                    <Badge variant={accountType === "free" ? "secondary" : "default"}>
                      {accountType.charAt(0).toUpperCase() + accountType.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Document Limit</span>
                    <span className="font-medium">{maxDocuments} documents</span>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">No API keys configured yet.</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const subject = encodeURIComponent("Request Free API Keys");
                      const body = encodeURIComponent(
                        "I would like to request free API keys for the Unified LLM Portal.\n\nPlease provide me with:\n- Dataset ID\n- API Key",
                      );
                      window.open(`mailto:info@unified-bi.org?subject=${subject}&body=${body}`);
                    }}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Request Free Keys
                  </Button>
                </div>
              )}
              {isAdmin && (
                <Button variant="outline" className="w-full" onClick={() => navigate("/admin")}>
                  <Shield className="h-4 w-4 mr-2" />
                  Admin Panel
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Upgrade Account Card */}
          <Card className="animate-slide-up" style={{ animationDelay: "0.05s" }}>
            <CardHeader>
              <CardTitle>Upgrade Account</CardTitle>
              <CardDescription>Request an upgrade to increase your document limit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <h4 className="font-medium">{plan.name}</h4>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                    <p className="text-sm text-muted-foreground">{plan.docs} documents</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{plan.price}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const subject = encodeURIComponent(`Upgrade Request: ${plan.name}`);
                        const body = encodeURIComponent(
                          `I would like to upgrade to ${plan.name} plan.\n\nDataset ID: ${datasetId || "Not set"}\nAPI Key: ${apiKey ? "****" + apiKey.slice(-4) : "Not set"}`,
                        );
                        window.open(`mailto:info@unified-bi.org?subject=${subject}&body=${body}`);
                      }}
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      Request
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* API Configuration Card - Available to all users */}
          <Card className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>Enter your Dataset ID and API Key from Dify to connect your knowledge base.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  Don't have API credentials? Use the "Request Free Keys" button above to get started.
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
