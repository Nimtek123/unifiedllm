import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { account, appwriteDb, DATABASE_ID, COLLECTIONS, ID } from "@/integrations/appwrite/client";
import { ArrowLeft, Users, Search, Trash2, Edit2, Save, X, UserPlus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface UserSettings {
  $id: string;
  userId: string;
  datasetId: string;
  apiKey: string;
  accountType: string | null;
  maxDocuments: number | null;
  updatedAt: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserSettings>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSettingsForm, setNewSettingsForm] = useState({
    userId: "",
    datasetId: "",
    apiKey: "",
    accountType: "free",
    maxDocuments: 5,
  });

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const user = await account.get();
      const labels = user.labels || [];
      
      if (!labels.includes("admin")) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }
      
      setIsAdmin(true);
      await loadUserSettings();
    } catch (error: any) {
      if (error.code === 401) {
        navigate("/auth");
      } else {
        toast.error("Failed to verify admin access");
        navigate("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUserSettings = async () => {
    try {
      const response = await appwriteDb.listDocuments(DATABASE_ID, COLLECTIONS.USER_SETTINGS);
      setUserSettings(response.documents as unknown as UserSettings[]);
    } catch (error: any) {
      toast.error("Failed to load user settings");
      console.error(error);
    }
  };

  const handleEdit = (settings: UserSettings) => {
    setEditingId(settings.$id);
    setEditForm({
      datasetId: settings.datasetId,
      apiKey: settings.apiKey,
      accountType: settings.accountType || "free",
      maxDocuments: settings.maxDocuments || 5,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async (docId: string, userId: string) => {
    try {
      await appwriteDb.updateDocument(DATABASE_ID, COLLECTIONS.USER_SETTINGS, docId, {
        ...editForm,
        userId,
        updatedAt: new Date().toISOString(),
      });
      toast.success("User settings updated successfully");
      setEditingId(null);
      setEditForm({});
      await loadUserSettings();
    } catch (error: any) {
      toast.error(error.message || "Failed to update user settings");
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this user's settings?")) return;
    
    try {
      await appwriteDb.deleteDocument(DATABASE_ID, COLLECTIONS.USER_SETTINGS, docId);
      toast.success("User settings deleted successfully");
      await loadUserSettings();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user settings");
    }
  };

  const handleCreateSettings = async () => {
    if (!newSettingsForm.userId) {
      toast.error("User ID is required");
      return;
    }

    try {
      await appwriteDb.createDocument(DATABASE_ID, COLLECTIONS.USER_SETTINGS, ID.unique(), {
        userId: newSettingsForm.userId,
        datasetId: newSettingsForm.datasetId,
        apiKey: newSettingsForm.apiKey,
        accountType: newSettingsForm.accountType,
        maxDocuments: newSettingsForm.maxDocuments,
        updatedAt: new Date().toISOString(),
      });
      toast.success("User settings created successfully");
      setShowCreateModal(false);
      setNewSettingsForm({ userId: "", datasetId: "", apiKey: "", accountType: "free", maxDocuments: 5 });
      await loadUserSettings();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user settings");
    }
  };

  const filteredSettings = userSettings.filter(
    (settings) =>
      settings.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      settings.datasetId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAccountBadge = (accountType: string | null) => {
    switch (accountType) {
      case "paid":
        return <Badge className="bg-green-500">Paid</Badge>;
      case "trial":
        return <Badge className="bg-blue-500">Trial</Badge>;
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen gradient-subtle">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <Badge variant="destructive">Admin Panel</Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-3xl font-bold">User Management</h2>
                <p className="text-muted-foreground">Manage user settings and account types.</p>
              </div>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User Settings
            </Button>
          </div>
        </div>

        <Card className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <CardHeader>
            <CardTitle>User Settings</CardTitle>
            <CardDescription>View and edit user configurations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by User ID or Dataset ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Dataset ID</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Account Type</TableHead>
                    <TableHead>Max Documents</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSettings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No user settings found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSettings.map((settings) => (
                      <TableRow key={settings.$id}>
                        <TableCell className="font-mono text-xs">
                          {settings.userId?.substring(0, 12)}...
                        </TableCell>
                        <TableCell>
                          {editingId === settings.$id ? (
                            <Input
                              value={editForm.datasetId || ""}
                              onChange={(e) => setEditForm({ ...editForm, datasetId: e.target.value })}
                              className="h-8"
                            />
                          ) : (
                            <span className="font-mono text-xs">
                              {settings.datasetId ? `${settings.datasetId.substring(0, 12)}...` : "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === settings.$id ? (
                            <Input
                              value={editForm.apiKey || ""}
                              onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
                              className="h-8"
                            />
                          ) : (
                            <span className="font-mono text-xs">
                              {settings.apiKey ? `****${settings.apiKey.slice(-4)}` : "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === settings.$id ? (
                            <Select
                              value={editForm.accountType || "free"}
                              onValueChange={(value) => setEditForm({ ...editForm, accountType: value })}
                            >
                              <SelectTrigger className="h-8 w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="trial">Trial</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            getAccountBadge(settings.accountType)
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === settings.$id ? (
                            <Input
                              type="number"
                              value={editForm.maxDocuments || 5}
                              onChange={(e) => setEditForm({ ...editForm, maxDocuments: parseInt(e.target.value) })}
                              className="h-8 w-20"
                            />
                          ) : (
                            settings.maxDocuments || 5
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(settings.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingId === settings.$id ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSaveEdit(settings.$id, settings.userId)}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(settings)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => handleDelete(settings.$id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Total users: {filteredSettings.length}
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Create Settings Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create User Settings</CardTitle>
              <CardDescription>Add settings for a new or existing user</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">User ID *</label>
                <Input
                  value={newSettingsForm.userId}
                  onChange={(e) => setNewSettingsForm({ ...newSettingsForm, userId: e.target.value })}
                  placeholder="Enter Appwrite user ID"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dataset ID</label>
                <Input
                  value={newSettingsForm.datasetId}
                  onChange={(e) => setNewSettingsForm({ ...newSettingsForm, datasetId: e.target.value })}
                  placeholder="Enter dataset ID"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key</label>
                <Input
                  value={newSettingsForm.apiKey}
                  onChange={(e) => setNewSettingsForm({ ...newSettingsForm, apiKey: e.target.value })}
                  placeholder="Enter API key"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Account Type</label>
                <Select
                  value={newSettingsForm.accountType}
                  onValueChange={(value) => setNewSettingsForm({ ...newSettingsForm, accountType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Documents</label>
                <Input
                  type="number"
                  value={newSettingsForm.maxDocuments}
                  onChange={(e) => setNewSettingsForm({ ...newSettingsForm, maxDocuments: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleCreateSettings}>
                  Create Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Admin;