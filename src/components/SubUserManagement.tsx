import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserPlus, Trash2, Edit2, Save, X, Users, Bot } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Query, account, databases, DATABASE_ID, ID } from "@/integrations/appwrite/client";

type PermissionType = "view" | "upload" | "delete" | "manage_users";

const PERMISSIONS: { value: PermissionType; label: string }[] = [
  { value: "view", label: "View Documents" },
  { value: "upload", label: "Upload Documents" },
  { value: "delete", label: "Delete Documents" },
  { value: "manage_users", label: "Manage Users" },
];

interface SubUser {
  $id: string;
  userId: string;
  parentUserId: string;
  can_view: boolean;
  can_upload: boolean;
  can_delete: boolean;
  can_manage_users: boolean;
  email?: string;
  name?: string;
}

interface LLMOption {
  $id: string;
  llmId: string;
  llmName: string;
}

const USER_LINKS = "team_members";
const LLM_LIST_COLLECTION = "llm_list";

const SubUserManagement = () => {
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [availableLLMs, setAvailableLLMs] = useState<LLMOption[]>([]);
  const [userLLMAssignments, setUserLLMAssignments] = useState<Record<string, string[]>>({});

  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "",
    permissions: {
      can_view: true,
      can_upload: false,
      can_delete: false,
      can_manage_users: false,
    },
    assignedLLMs: [] as string[],
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load current user
  useEffect(() => {
    (async () => {
      try {
        const user = await account.get();
        setCurrentUserId(user.$id);
      } catch {
        toast.error("Not authenticated");
      }
    })();
  }, []);

  // Load available LLMs from Appwrite
  useEffect(() => {
    if (!currentUserId) return;
    loadAvailableLLMs();
  }, [currentUserId]);

  const loadAvailableLLMs = async () => {
    try {
      const llms = await databases.listDocuments(DATABASE_ID, LLM_LIST_COLLECTION, [
        Query.equal("userId", currentUserId),
      ]);
      setAvailableLLMs(
        llms.documents.map((doc: any) => ({
          $id: doc.$id,
          llmId: doc.llmId,
          llmName: doc.llm_name,
        })),
      );
    } catch (error: any) {
      console.error("Failed to load LLMs:", error);
    }
  };

  // Load Sub Users and their LLM assignments
  useEffect(() => {
    if (!currentUserId) return;
    loadSubUsers();
  }, [currentUserId]);

  const loadSubUsers = async () => {
    try {
      // 1. Load all sub-users linked to the parent
      const members = await databases.listDocuments(DATABASE_ID, USER_LINKS, [
        Query.equal("parentUserId", currentUserId),
      ]);

      const users = members.documents as unknown as SubUser[];
      setSubUsers(users);

      // 2. Load LLM assignments for each sub-user (Appwrite version)
      const assignments: Record<string, string[]> = {};

      for (const user of users) {
        const { documents } = await databases.listDocuments(DATABASE_ID, "llm_list", [
          Query.equal("userId", user.userId),
        ]);

        if (documents.length > 0) {
          assignments[user.userId] = documents.map((d: any) => d.llmId);
        }
      }

      setUserLLMAssignments(assignments);
    } catch (error: any) {
      toast.error("Failed to load team members");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Save LLM assignments
  const saveLLMAssignments = async (userId: string, llmIds: string[]) => {
    try {
      // 1. Delete old assignments
      const existing = await databases.listDocuments(DATABASE_ID, "llm_list", [Query.equal("userId", userId)]);

      for (const doc of existing.documents) {
        await databases.deleteDocument(DATABASE_ID, "llm_list", doc.$id);
      }

      // 2. Insert new LLM assignments
      for (const llmId of llmIds) {
        const llm = availableLLMs.find((l) => l.llmId === llmId);

        await databases.createDocument(DATABASE_ID, "llm_list", ID.unique(), {
          userId,
          llmId,
          llm_name: llm?.llmName || llmId,
        });
      }
    } catch (error: any) {
      console.error("Failed to save LLM assignments:", error);
      throw error;
    }
  };

  // Add Sub User
  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast.error("Email & password required");
      return;
    }

    try {
      // 1️⃣ Create sub-user auth account
      const userId = ID.unique();
      await account.create(userId, newUser.email, newUser.password, newUser.name);

      const canView = newUser.permissions.can_view;
      const canUpload = newUser.permissions.can_upload;
      const canDelete = newUser.permissions.can_delete;
      const canManageUsers = newUser.permissions.can_manage_users;

      // 2️⃣ Link parent → child
      await databases.createDocument(DATABASE_ID, USER_LINKS, ID.unique(), {
        parentUserId: currentUserId,
        userId: userId,
        email: newUser.email,
        name: newUser.name,
        can_view: canView,
        can_upload: canUpload,
        can_delete: canDelete,
        can_manage_users: canManageUsers,
      });

      // 3️⃣ Save LLM assignments
      if (newUser.assignedLLMs.length > 0) {
        await saveLLMAssignments(userId, newUser.assignedLLMs);
      }

      toast.success("Team member added successfully");
      setShowAddForm(false);
      setNewUser({
        email: "",
        name: "",
        password: "",
        permissions: {
          can_view: true,
          can_upload: false,
          can_delete: false,
          can_manage_users: false,
        },
        assignedLLMs: [],
      });

      loadSubUsers();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to add sub user");
    }
  };

  // Save Edit
  const handleSaveEdit = async (id: string) => {
    try {
      // Get the linked sub-user record (to know userId)
      const link = await databases.getDocument(DATABASE_ID, USER_LINKS, id);

      const authUserId = link.userId;
      if (!authUserId) {
        throw new Error("authUserId not found for this sub-user");
      }

      const canView = newUser.permissions.can_view;
      const canUpload = newUser.permissions.can_upload;
      const canDelete = newUser.permissions.can_delete;
      const canManageUsers = newUser.permissions.can_manage_users;

      // Update USER_LINKS (permissions)
      await databases.updateDocument(DATABASE_ID, USER_LINKS, id, {
        can_view: canView,
        can_upload: canUpload,
        can_delete: canDelete,
        can_manage_users: canManageUsers,
        email: newUser.email,
        name: newUser.name,
      });

      // Update LLM assignments
      await saveLLMAssignments(authUserId, newUser.assignedLLMs);

      toast.success("Team member updated");
      setShowAddForm(false);
      setNewUser({
        email: "",
        name: "",
        password: "",
        permissions: {
          can_view: true,
          can_upload: false,
          can_delete: false,
          can_manage_users: false,
        },
        assignedLLMs: [],
      });

      setEditingId(null);
      loadSubUsers();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to update user");
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Remove this team member?")) return;

    try {
      await databases.deleteDocument(DATABASE_ID, USER_LINKS, id);
      toast.success("Deleted");
      loadSubUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete");
    }
  };

  // Open form for adding or editing
  const openForm = (user?: SubUser) => {
    if (user) {
      // Editing existing user - load their LLM assignments
      const userLLMs = userLLMAssignments[user.userId] || [];
      setEditingId(user.$id);
      setNewUser({
        email: user.email || "",
        name: user.name || "",
        password: "",
        permissions: {
          can_view: user.can_view || false,
          can_upload: user.can_upload || false,
          can_delete: user.can_delete || false,
          can_manage_users: user.can_manage_users || false,
        },
        assignedLLMs: userLLMs,
      });
    } else {
      // Adding new user
      setEditingId(null);
      setNewUser({
        email: "",
        name: "",
        password: "",
        permissions: {
          can_view: true,
          can_upload: false,
          can_delete: false,
          can_manage_users: false,
        },
        assignedLLMs: [],
      });
    }

    setShowAddForm(true);
  };

  const toggleLLMAssignment = (llmId: string) => {
    setNewUser((u) => {
      const isAssigned = u.assignedLLMs.includes(llmId);
      return {
        ...u,
        assignedLLMs: isAssigned ? u.assignedLLMs.filter((id) => id !== llmId) : [...u.assignedLLMs, llmId],
      };
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Users className="inline w-5 h-5 mr-2" /> Team Members
        </CardTitle>
        <CardDescription>Manage sub-user access and permissions</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Add User Form */}
        {showAddForm && (
          <div className="mb-6 p-4 border rounded-xl bg-muted/20">
            <h3 className="font-medium mb-2">{editingId ? "Edit Team Member" : "Add Team Member"}</h3>
            <div className="grid gap-3">
              <Input
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                readOnly={!!editingId}
                disabled={!!editingId}
              />
              <Input
                placeholder="Name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
              {!editingId && (
                <Input
                  placeholder="Password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              )}

              <div>
                <label className="font-medium">Permissions:</label>
                <div className="flex gap-3 mt-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newUser.permissions.can_view}
                      onCheckedChange={(checked) =>
                        setNewUser((u) => ({
                          ...u,
                          permissions: { ...u.permissions, can_view: Boolean(checked) },
                        }))
                      }
                    />
                    View Documents
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newUser.permissions.can_upload}
                      onCheckedChange={(checked) =>
                        setNewUser((u) => ({
                          ...u,
                          permissions: { ...u.permissions, can_upload: Boolean(checked) },
                        }))
                      }
                    />
                    Upload Documents
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newUser.permissions.can_delete}
                      onCheckedChange={(checked) =>
                        setNewUser((u) => ({
                          ...u,
                          permissions: { ...u.permissions, can_delete: Boolean(checked) },
                        }))
                      }
                    />
                    Delete Documents
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newUser.permissions.can_manage_users}
                      onCheckedChange={(checked) =>
                        setNewUser((u) => ({
                          ...u,
                          permissions: { ...u.permissions, can_manage_users: Boolean(checked) },
                        }))
                      }
                    />
                    Manage Users
                  </div>
                </div>
              </div>

              {/* LLM Assignment Multi-Select */}
              <div>
                <label className="font-medium flex items-center gap-2">
                  <Bot className="w-4 h-4" /> Assign LLMs:
                </label>
                {availableLLMs.length > 0 ? (
                  <div className="flex gap-3 mt-2 flex-wrap">
                    {availableLLMs.map((llm) => (
                      <div key={llm.$id} className="flex items-center gap-2">
                        <Checkbox
                          checked={newUser.assignedLLMs.includes(llm.llmId)}
                          onCheckedChange={() => toggleLLMAssignment(llm.llmId)}
                        />
                        <span className="text-sm">{llm.llmName}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    No LLMs available. Add LLMs in the Admin panel first.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (editingId) {
                      await handleSaveEdit(editingId);
                    } else {
                      await handleAddUser();
                    }
                  }}
                >
                  {editingId ? (
                    <>
                      <Save className="mr-2 h-4 w-4" /> Save Changes
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" /> Add User
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {!showAddForm && (
          <Button className="mb-4" onClick={() => openForm()}>
            <UserPlus className="mr-2 h-4 w-4" /> Add Sub User
          </Button>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Assigned LLMs</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {subUsers.map((user) => {
              const assignedLLMIds = userLLMAssignments[user.userId] || [];
              const assignedLLMNames = assignedLLMIds
                .map((id) => availableLLMs.find((l) => l.llmId === id)?.llmName || id)
                .join(", ");

              return (
                <TableRow key={user.$id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>

                  <TableCell>
                    {user.can_view && <Badge className="mr-1">View</Badge>}
                    {user.can_upload && <Badge className="mr-1">Upload</Badge>}
                    {user.can_delete && <Badge className="mr-1">Delete</Badge>}
                    {user.can_manage_users && <Badge className="mr-1">Manage Users</Badge>}
                  </TableCell>

                  <TableCell>
                    {assignedLLMNames ? (
                      <span className="text-sm">{assignedLLMNames}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">None</span>
                    )}
                  </TableCell>

                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openForm(user)}>
                      <Edit2 size={14} />
                    </Button>

                    <Button size="sm" variant="destructive" onClick={() => handleDelete(user.$id)}>
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default SubUserManagement;
