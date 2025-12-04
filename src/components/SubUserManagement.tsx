import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserPlus, Trash2, Edit2, Save, X, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { account, appwriteDb, DATABASE_ID, COLLECTIONS, ID } from "@/integrations/appwrite/client";

type PermissionType = "view" | "upload" | "delete" | "manage_users";

const PERMISSIONS: { value: PermissionType; label: string }[] = [
  { value: "view", label: "View Documents" },
  { value: "upload", label: "Upload Documents" },
  { value: "delete", label: "Delete Documents" },
  { value: "manage_users", label: "Manage Users" },
];

interface SubUser {
  $id: string;
  childUserId: string;
  parentUserId: string;
  permissions: PermissionType[];
  is_active: boolean;
  email?: string;
  name?: string;
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
    permissions: ["view"] as PermissionType[],
  });

  const [editForm, setEditForm] = useState({
    name: "",
    permissions: [] as PermissionType[],
    is_active: true,
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

  // Load Sub Users
  useEffect(() => {
    if (!currentUserId) return;
    loadSubUsers();
  }, [currentUserId]);

  const loadSubUsers = async () => {
    try {
      const res = await databases.listDocuments(DATABASE_ID, USER_LINKS, [Query.equal("parentUserId", currentUserId)]);

      setSubUsers(res.documents);
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

      // 2️⃣ Link parent → child
      await databases.createDocument(DATABASE_ID, USER_LINKS, ID.unique(), {
        parentUserId: currentUserId,
        userId: userId,
        permissions: newUser.permissions,
        is_active: true,
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
      permissions: user.permissions,
      is_active: user.is_active,
    });
  };

  // Save Edit
  const handleSaveEdit = async (id: string) => {
    try {
      await databases.updateDocument(DATABASE_ID, USER_LINKS, id, {
        permissions: editForm.permissions,
        is_active: editForm.is_active,
      });

      toast.success("Team member updated");
      setEditingId(null);
      loadSubUsers();
    } catch (error: any) {
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

  const togglePermission = (perm: PermissionType, list: PermissionType[], setter: (v: PermissionType[]) => void) => {
    setter(list.includes(perm) ? list.filter((p) => p !== perm) : [...list, perm]);
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
                  {PERMISSIONS.map((p) => (
                    <div key={p.value} className="flex items-center gap-2">
                      <Checkbox
                        checked={newUser.permissions.includes(p.value)}
                        onCheckedChange={() =>
                          togglePermission(p.value, newUser.permissions, (perms) =>
                            setNewUser((u) => ({ ...u, permissions: perms })),
                          )
                        }
                      />
                      {p.label}
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleAddUser}>Add User</Button>
            </div>
          </div>
        )}

        {/* Table */}
        <Button className="mb-4" onClick={() => setShowAddForm(!showAddForm)}>
          <UserPlus className="mr-2 h-4 w-4" /> Add Sub User
        </Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {subUsers.map((user) => (
              <TableRow key={user.$id}>
                <TableCell>{user.email}</TableCell>

                <TableCell>
                  {user.permissions.map((p) => (
                    <Badge key={p} className="mr-1">
                      {p}
                    </Badge>
                  ))}
                </TableCell>

                <TableCell>
                  {user.is_active ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="destructive">Disabled</Badge>
                  )}
                </TableCell>

                <TableCell className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleEdit(user)}>
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
