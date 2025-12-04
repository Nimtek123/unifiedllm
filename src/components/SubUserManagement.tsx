import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserPlus, Trash2, Edit2, Save, X, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Query, account, databases, appwriteDb, DATABASE_ID, COLLECTIONS, ID } from "@/integrations/appwrite/client";

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
  permissions: {
    can_view: boolean;
    can_upload: boolean;
    can_delete: boolean;
    can_manage_users: boolean;
  };
  email?: string;
  name?: string;
  password?: string;
}

const USER_LINKS = "team_members";

const SubUserManagement = () => {
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
  });

  const [editForm, setEditForm] = useState({
    name: "",
    password: "",
    email: "",
    name: "",
    permissions: {
      can_view: true,
      can_upload: false,
      can_delete: false,
      can_manage_users: false,
    },
  });

  const togglePermission = (key: keyof typeof newUser.permissions, isEdit = false) => {
    if (isEdit) {
      setEditForm((f) => ({
        ...f,
        permissions: {
          ...f.permissions,
          [key]: !f.permissions[key],
        },
      }));
    } else {
      setNewUser((u) => ({
        ...u,
        permissions: {
          ...u.permissions,
          [key]: !u.permissions[key],
        },
      }));
    }
  };

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

  // Load Sub Users
  useEffect(() => {
    if (!currentUserId) return;
    loadSubUsers();
  }, [currentUserId]);

  const loadSubUsers = async () => {
    try {
      const members = await databases.listDocuments(DATABASE_ID, USER_LINKS, [
        Query.equal("parentUserId", currentUserId),
      ]);

      setSubUsers(members.documents);
    } catch (error: any) {
      toast.error("Failed to load team members");
      console.error(error);
    } finally {
      setLoading(false);
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

        // Boolean permission fields
        can_view: canView,
        can_upload: canUpload,
        can_delete: canDelete,
        can_manage_users: canManageUsers,
      });

      toast.success("Team member added successfully");
      setShowAddForm(false);
      setNewUser({ email: "", name: "", password: "", permissions: ["view"] });

      loadSubUsers();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to add sub user");
    }
  };

  // Edit
  const handleEdit = (user: SubUser) => {
    setEditingId(user.$id);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      permissions: {
        can_view: user.can_view || false,
        can_upload: user.can_upload || false,
        can_delete: user.can_delete || false,
        can_manage_users: user.can_manage_users || false,
      },
      password: "", // Leave blank; only update if changed
    });
  };

  // Save Edit
  const handleSaveEdit = async (id: string) => {
    try {
      // Get the linked sub-user record (to know authUserId)
      const link = await databases.getDocument(DATABASE_ID, USER_LINKS, id);

      const authUserId = link.authUserId;
      if (!authUserId) {
        throw new Error("authUserId not found for this sub-user");
      }

      // 1️⃣ Update USER_LINKS (permissions + is_active)
      await databases.updateDocument(DATABASE_ID, USER_LINKS, id, {
        permissions: editForm.permissions,
        email: editForm.email,
        name: editForm.name,
      });

      // 2️⃣ Update Auth user if password or name is changed
      if (editForm.password || editForm.name) {
        const payload: any = {};

        if (editForm.password && editForm.password.trim() !== "") {
          payload.password = editForm.password;
        }

        if (editForm.name && editForm.name.trim() !== "") {
          payload.name = editForm.name;
        }

        if (Object.keys(payload).length > 0) {
          // Uses Admin SDK to update any user
          await users.update(authUserId, payload);
        }
      }

      toast.success("Team member updated");

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
      // Editing existing user
      setEditingId(user.$id);
      setEditForm({
        email: user.email || "",
        name: user.name || "",
        password: "", // Leave blank; only update if user sets new password
        permissions: {
          can_view: user.can_view || false,
          can_upload: user.can_upload || false,
          can_delete: user.can_delete || false,
          can_manage_users: user.can_manage_users || false,
        },
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
      });
    }

    setShowAddForm(true);
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
            <h3 className="font-medium mb-2">Add Team Member</h3>
            <div className="grid gap-3">
              <Input
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
              <Input
                placeholder="Name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
              <Input
                placeholder="Password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />

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

              <Button onClick={handleAddUser}>Add User</Button>
            </div>
          </div>
        )}

        {/* Table */}
        <Button className="mb-4" onClick={() => openForm()}>
          <UserPlus className="mr-2 h-4 w-4" /> Add Sub User
        </Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {subUsers.map((user) => (
              <TableRow key={user.$id}>
                <TableCell>{user.email}</TableCell>

                <TableCell>
                  {user.can_view && <Badge className="mr-1">View</Badge>}
                  {user.can_upload && <Badge className="mr-1">Upload</Badge>}
                  {user.can_delete && <Badge className="mr-1">Delete</Badge>}
                  {user.can_manage_users && <Badge className="mr-1">Manage Users</Badge>}
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default SubUserManagement;
