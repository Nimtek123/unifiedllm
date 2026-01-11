import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  account,
  appwriteDb,
  DATABASE_ID,
  COLLECTIONS,
  ID,
  listAppwriteUsers,
  difyApi,
} from "@/integrations/appwrite/client";
import { ArrowLeft, Users, Search, Trash2, Edit2, Save, X, UserPlus, Bot, Plus, Database } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserSettings {
  $id: string;
  userId: string;
  datasetId: string;
  apiKey: string;
  accountType: string | null;
  maxDocuments: number | null;
  updatedAt: string;
}

interface LLMItem {
  $id: string;
  userId: string;
  llmId: string;
  llm_name: string;
  createdAt: string;
}

interface AppwriteUser {
  $id: string;
  email: string;
  name: string;
  labels: string[];
}

interface DifyDataset {
  id: string;
  name: string;
  document_count: number;
  created_at: number;
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
    name: "",
    apiKey: "",
    accountType: "free",
    maxDocuments: 5,
  });

  // Appwrite users and Dify datasets
  const [appwriteUsers, setAppwriteUsers] = useState<AppwriteUser[]>([]);
  const [difyDatasets, setDifyDatasets] = useState<DifyDataset[]>([]);

  // LLM Management State
  const [llmList, setLlmList] = useState<LLMItem[]>([]);
  const [llmSearchTerm, setLlmSearchTerm] = useState("");
  const [showLlmModal, setShowLlmModal] = useState(false);
  const [newLlmForm, setNewLlmForm] = useState({
    userId: "",
    llmId: "",
    llmName: "",
  });
  const [editingLlmId, setEditingLlmId] = useState<string | null>(null);
  const [editLlmForm, setEditLlmForm] = useState<Partial<LLMItem>>({});

  // Knowledge Base state
  const [kbSearchTerm, setKbSearchTerm] = useState("");
  const [showCreateKbModal, setShowCreateKbModal] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [creatingKb, setCreatingKb] = useState(false);

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
      await Promise.all([loadUserSettings(), loadLlmList(), loadAppwriteUsers(), loadDifyDatasets()]);
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

  const loadLlmList = async () => {
    try {
      const response = await appwriteDb.listDocuments(DATABASE_ID, COLLECTIONS.LLM_LIST);
      setLlmList(response.documents as unknown as LLMItem[]);
    } catch (error: any) {
      toast.error("Failed to load LLM list");
      console.error(error);
    }
  };

  const loadAppwriteUsers = async () => {
    try {
      const response = await listAppwriteUsers();
      setAppwriteUsers(response.users || []);
    } catch (error: any) {
      console.error("Failed to load Appwrite users:", error);
    }
  };

  const loadDifyDatasets = async () => {
    try {
      const response = await difyApi.listDatasets();
      setDifyDatasets(response.data || []);
    } catch (error: any) {
      console.error("Failed to load Dify datasets:", error);
    }
  };

  const handleEdit = (settings: UserSettings) => {
    setEditingId(settings.$id);
    setEditForm({
      datasetId: settings.datasetId,
      name: settings.name,
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
        name: newSettingsForm.name,
        apiKey: newSettingsForm.apiKey,
        accountType: newSettingsForm.accountType,
        maxDocuments: newSettingsForm.maxDocuments,
        updatedAt: new Date().toISOString(),
      });
      toast.success("User settings created successfully");
      setShowCreateModal(false);
      setNewSettingsForm({ userId: "", datasetId: "", name: "", apiKey: "", accountType: "free", maxDocuments: 5 });
      await loadUserSettings();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user settings");
    }
  };

  // LLM Management Functions - using appwriteDb for single row updates
  const handleCreateLlm = async () => {
    if (!newLlmForm.userId || !newLlmForm.llmId || !newLlmForm.llmName) {
      toast.error("All fields are required");
      return;
    }

    try {
      await appwriteDb.createDocument(DATABASE_ID, COLLECTIONS.LLM_LIST, ID.unique(), {
        userId: newLlmForm.userId,
        llmId: newLlmForm.llmId,
        llm_name: newLlmForm.llmName,
        createdAt: new Date().toISOString(),
      });

      toast.success("LLM assignment created successfully");
      setShowLlmModal(false);
      setNewLlmForm({ userId: "", llmId: "", llmName: "" });
      await loadLlmList();
    } catch (error: any) {
      toast.error(error.message || "Failed to create LLM assignment");
    }
  };

  const handleEditLlm = (llm: LLMItem) => {
    setEditingLlmId(llm.$id);
    setEditLlmForm({
      llmId: llm.llmId,
      llm_name: llm.llm_name,
    });
  };

  const handleSaveLlmEdit = async (docId: string) => {
    try {
      await appwriteDb.updateDocument(DATABASE_ID, COLLECTIONS.LLM_LIST, docId, {
        llmId: editLlmForm.llmId,
        llm_name: editLlmForm.llm_name,
      });

      toast.success("LLM updated successfully");
      setEditingLlmId(null);
      setEditLlmForm({});
      await loadLlmList();
    } catch (error: any) {
      toast.error(error.message || "Failed to update LLM");
    }
  };

  const handleDeleteLlm = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this LLM assignment?")) return;

    try {
      await appwriteDb.deleteDocument(DATABASE_ID, COLLECTIONS.LLM_LIST, docId);
      toast.success("LLM assignment deleted successfully");
      await loadLlmList();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete LLM assignment");
    }
  };

  // Knowledge Base functions
  const handleCreateKnowledgeBase = async () => {
    if (!newKbName.trim()) {
      toast.error("Knowledge base name is required");
      return;
    }

    setCreatingKb(true);
    try {
      await difyApi.createDataset(newKbName.trim());
      toast.success("Knowledge base created successfully");
      setShowCreateKbModal(false);
      setNewKbName("");
      await loadDifyDatasets();
    } catch (error: any) {
      toast.error(error.message || "Failed to create knowledge base");
    } finally {
      setCreatingKb(false);
    }
  };

  const filteredSettings = userSettings.filter(
    (settings) =>
      settings.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      settings.datasetId?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredLlmList = llmList.filter(
    (llm) =>
      llm.userId?.toLowerCase().includes(llmSearchTerm.toLowerCase()) ||
      llm.llm_name?.toLowerCase().includes(llmSearchTerm.toLowerCase()) ||
      llm.llmId?.toLowerCase().includes(llmSearchTerm.toLowerCase()),
  );

  const filteredDatasets = difyDatasets.filter(
    (ds) =>
      ds.name?.toLowerCase().includes(kbSearchTerm.toLowerCase()) ||
      ds.id?.toLowerCase().includes(kbSearchTerm.toLowerCase()),
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

  const getUserDisplayName = (userId: string) => {
    const user = appwriteUsers.find((u) => u.$id === userId);
    if (user) {
      return user.email || user.name || userId.substring(0, 12) + "...";
    }
    return userId.substring(0, 12) + "...";
  };

  const getDatasetDisplayName = (datasetId: string) => {
    const dataset = difyDatasets.find((d) => d.id === datasetId);
    if (dataset) {
      return dataset.name;
    }
    return datasetId ? datasetId.substring(0, 12) + "..." : "-";
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
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-3xl font-bold">Admin Panel</h2>
              <p className="text-muted-foreground">Manage users, settings, LLM assignments, and knowledge bases.</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="users" className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <TabsList className="mb-4">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              User Settings
            </TabsTrigger>
            <TabsTrigger value="llm" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              LLM Assignments
            </TabsTrigger>
            <TabsTrigger value="kb" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Knowledge Bases
            </TabsTrigger>
          </TabsList>

          {/* User Settings Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>User Settings</CardTitle>
                  <CardDescription>View and edit user configurations.</CardDescription>
                </div>
                <Button onClick={() => setShowCreateModal(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add User Settings
                </Button>
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
                        <TableHead>User</TableHead>
                        <TableHead>Dataset</TableHead>
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
                            <TableCell className="font-mono text-xs">{getUserDisplayName(settings.userId)}</TableCell>
                            <TableCell>
                              {editingId === settings.$id ? (
                                <Select
                                  value={editForm.datasetId || ""}
                                  onValueChange={(value) => {
                                    const selectedDataset = difyDatasets.find((ds) => ds.id === value);
                                    setEditForm({
                                      ...editForm,
                                      datasetId: value,
                                      name: selectedDataset?.name || "",
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-8 w-48">
                                    <SelectValue placeholder="Select dataset" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {difyDatasets.map((ds) => (
                                      <SelectItem key={ds.id} value={ds.id}>
                                        {ds.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs">{getDatasetDisplayName(settings.datasetId)}</span>
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

                <p className="text-sm text-muted-foreground mt-4">Total users: {filteredSettings.length}</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LLM Assignments Tab */}
          <TabsContent value="llm">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>LLM Assignments</CardTitle>
                  <CardDescription>Assign LLM IDs to users and team members (one row at a time).</CardDescription>
                </div>
                <Button onClick={() => setShowLlmModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add LLM Assignment
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by User ID, LLM ID, or LLM Name..."
                      value={llmSearchTerm}
                      onChange={(e) => setLlmSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>LLM ID</TableHead>
                        <TableHead>LLM Name</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLlmList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No LLM assignments found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLlmList.map((llm) => (
                          <TableRow key={llm.$id}>
                            <TableCell className="font-mono text-xs">{getUserDisplayName(llm.userId)}</TableCell>
                            <TableCell>
                              {editingLlmId === llm.$id ? (
                                <Input
                                  value={editLlmForm.llmId || ""}
                                  onChange={(e) => setEditLlmForm({ ...editLlmForm, llmId: e.target.value })}
                                  className="h-8"
                                />
                              ) : (
                                <span className="font-mono text-xs">{llm.llmId}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingLlmId === llm.$id ? (
                                <Input
                                  value={editLlmForm.llm_name || ""}
                                  onChange={(e) => setEditLlmForm({ ...editLlmForm, llm_name: e.target.value })}
                                  className="h-8"
                                />
                              ) : (
                                llm.llm_name
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {llm.createdAt ? new Date(llm.createdAt).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {editingLlmId === llm.$id ? (
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="ghost" onClick={() => handleSaveLlmEdit(llm.$id)}>
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingLlmId(null);
                                      setEditLlmForm({});
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="ghost" onClick={() => handleEditLlm(llm)}>
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => handleDeleteLlm(llm.$id)}
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

                <p className="text-sm text-muted-foreground mt-4">Total LLM assignments: {filteredLlmList.length}</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Bases Tab */}
          <TabsContent value="kb">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Knowledge Bases</CardTitle>
                  <CardDescription>View and create Dify knowledge bases (datasets).</CardDescription>
                </div>
                <Button onClick={() => setShowCreateKbModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Knowledge Base
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or ID..."
                      value={kbSearchTerm}
                      onChange={(e) => setKbSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Documents</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDatasets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No knowledge bases found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredDatasets.map((ds) => (
                          <TableRow key={ds.id}>
                            <TableCell className="font-medium">{ds.name}</TableCell>
                            <TableCell className="font-mono text-xs">{ds.id}</TableCell>
                            <TableCell>{ds.document_count || 0}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {ds.created_at ? new Date(ds.created_at * 1000).toLocaleDateString() : "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <p className="text-sm text-muted-foreground mt-4">Total knowledge bases: {filteredDatasets.length}</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Create User Settings Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create User Settings</CardTitle>
              <CardDescription>Add settings for a new or existing user</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">User *</label>
                <Select
                  value={newSettingsForm.userId}
                  onValueChange={(value) => setNewSettingsForm({ ...newSettingsForm, userId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {appwriteUsers.map((user) => (
                      <SelectItem key={user.$id} value={user.$id}>
                        {user.email || user.name || user.$id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dataset</label>
                <Select
                  value={newSettingsForm.datasetId}
                  onValueChange={(value) => {
                    const selectedDataset = difyDatasets.find((ds) => ds.id === value);
                    setNewSettingsForm({
                      ...newSettingsForm,
                      datasetId: value,
                      name: selectedDataset?.name || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select dataset" />
                  </SelectTrigger>
                  <SelectContent>
                    {difyDatasets.map((ds) => (
                      <SelectItem key={ds.id} value={ds.id}>
                        {ds.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      {/* Create LLM Assignment Modal */}
      {showLlmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add LLM Assignment</CardTitle>
              <CardDescription>Assign an LLM to a user or team member</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">User *</label>
                <Select
                  value={newLlmForm.userId}
                  onValueChange={(value) => setNewLlmForm({ ...newLlmForm, userId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {appwriteUsers.map((user) => (
                      <SelectItem key={user.$id} value={user.$id}>
                        {user.email || user.name || user.$id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">LLM ID *</label>
                <Input
                  value={newLlmForm.llmId}
                  onChange={(e) => setNewLlmForm({ ...newLlmForm, llmId: e.target.value })}
                  placeholder="Enter Dify LLM/Chat ID"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">LLM Name *</label>
                <Input
                  value={newLlmForm.llmName}
                  onChange={(e) => setNewLlmForm({ ...newLlmForm, llmName: e.target.value })}
                  placeholder="Enter a display name"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowLlmModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleCreateLlm}>
                  Add Assignment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Knowledge Base Modal */}
      {showCreateKbModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create Knowledge Base</CardTitle>
              <CardDescription>Create a new Dify knowledge base (dataset)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  placeholder="Enter knowledge base name"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateKbModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleCreateKnowledgeBase} disabled={creatingKb}>
                  {creatingKb ? "Creating..." : "Create"}
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
