import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { account, appwriteDb, DATABASE_ID, COLLECTIONS, ID, Query } from "@/integrations/appwrite/client";
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
  const [isSubUser, setIsSubUser] = useState(false);

  useEffect(() => {
    checkAuthAndLoadSettings();
  }, []);

  const checkAuthAndLoadSettings = async () => {
    try {
      const user = await account.get();
      setIsAdmin(user.labels?.includes("admin") || false);

      let userIdToUse = user.$id;

      // Check if this user is a sub-user
      const teamRes = await appwriteDb.listDocuments(DATABASE_ID, "team_members", [Query.equal("userId", user.$id)]);

      if (teamRes.documents.length > 0) {
        // Use the parent user's ID for settings
        userIdToUse = teamRes.documents[0].parentUserId;
        setIsSubUser(true);
      }

      // Load settings using the resolved userId
      const settingsRes = await appwriteDb.listDocuments(DATABASE_ID, COLLECTIONS.USER_SETTINGS, [
        Query.equal("userId", userIdToUse),
      ]);

      if (settingsRes.documents.length > 0) {
        const userSettings = settingsRes.documents[0];
        setDatasetId(userSettings.datasetId || "");
        setApiKey(userSettings.apiKey || "");
        setSettingsDocId(userSettings.$id);
        setAccountType(userSettings.accountType || "free");
        setMaxDocuments(userSettings.maxDocuments || 5);
      } else {
        // No settings found
        setDatasetId("");
        setApiKey("");
        setSettingsDocId("");
        setAccountType("free");
        setMaxDocuments(5);
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
          {!isSubUser && !isAdmin && (
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
          )}
        </div>
      </main>
    </div>
  );
};

export default Settings;
