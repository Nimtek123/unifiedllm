import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Trash2, Edit2, Save, X, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PermissionType = "view" | "upload" | "delete" | "manage_users";

interface SubUser {
  id: string;
  parent_user_id: string;
  email: string;
  name: string | null;
  permissions: PermissionType[];
  is_active: boolean;
  created_at: string;
}

const PERMISSIONS: { value: PermissionType; label: string }[] = [
  { value: "view", label: "View Documents" },
  { value: "upload", label: "Upload Documents" },
  { value: "delete", label: "Delete Documents" },
  { value: "manage_users", label: "Manage Users" },
];

const SubUserManagement = () => {
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<{ email: string; name: string; permissions: PermissionType[] }>({ 
    email: "", name: "", permissions: ["view"] 
  });
  const [editForm, setEditForm] = useState<{ name: string; permissions: PermissionType[]; is_active: boolean }>({
    name: "",
    permissions: [],
    is_active: true,
  });

  useEffect(() => {
    loadSubUsers();
  }, []);

  const loadSubUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("sub_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSubUsers(data || []);
    } catch (error: any) {
      toast.error("Failed to load team members");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email) {
      toast.error("Email is required");
      return;
    }

    try {

      let uniqueID = ID.unique();
      const storedSession = localStorage.getItem("appwrite_session");
       // Create a new user
      await account.create(uniqueID, newUser.email, newUser.password, newUser.name);
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { error } = await appwriteDb.createDocument(DATABASE_ID, COLLECTIONS.USER_SETTINGS, ID.unique(), {
        parentUserId: userData.user.id
        userId: uniqueID,
        view: newUser.permissions["view"],
        upload: newUser.permissions["upload"],
        delete: newUser.permissions["delete"],
        manage_users: newUser.permissions["manage_users"],
        updatedAt: new Date().toISOString(),
      });
      
      
      if (error) throw error;
      toast.success("Team member added successfully");
      setShowAddForm(false);
      setNewUser({ email: "", name: "", permissions: ["view"] });
      loadSubUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to add team member");
    }
  };

  const handleEdit = (user: SubUser) => {
    setEditingId(user.id);
    setEditForm({
      name: user.name || "",
      permissions: user.permissions,
      is_active: user.is_active,
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const { error } = await supabase
        .from("sub_users")
        .update({
          name: editForm.name || null,
          permissions: editForm.permissions,
          is_active: editForm.is_active,
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Team member updated");
      setEditingId(null);
      loadSubUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to update team member");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;

    try {
      const { error } = await supabase.from("sub_users").delete().eq("id", id);
      if (error) throw error;
      toast.success("Team member removed");
      loadSubUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove team member");
    }
  };

  const togglePermission = (permission: PermissionType, current: PermissionType[], setter: (perms: PermissionType[]) => void) => {
    if (current.includes(permission)) {
      setter(current.filter((p) => p !== permission));
    } else {
      setter([...current, permission]);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage sub-users and their permissions</CardDescription>
            </div>
          </div>
          <Button onClick={() => setShowAddForm(true)} size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showAddForm && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium mb-4">Add New Team Member</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Email *"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
              <Input
                placeholder="Name (optional)"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Permissions</p>
              <div className="flex flex-wrap gap-4">
                {PERMISSIONS.map((perm) => (
                  <label key={perm.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newUser.permissions.includes(perm.value)}
                      onCheckedChange={() =>
                        togglePermission(perm.value, newUser.permissions, (perms) =>
                          setNewUser({ ...newUser, permissions: perms })
                        )
                      }
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleAddUser}>Add Member</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {subUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No team members yet</p>
            <p className="text-sm">Add sub-users to manage document access</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      {editingId === user.id ? (
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="h-8 w-32"
                        />
                      ) : (
                        user.name || "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === user.id ? (
                        <div className="flex flex-wrap gap-2">
                          {PERMISSIONS.map((perm) => (
                            <label key={perm.value} className="flex items-center gap-1 text-xs">
                              <Checkbox
                                checked={editForm.permissions.includes(perm.value)}
                                onCheckedChange={() =>
                                  togglePermission(perm.value, editForm.permissions, (perms) =>
                                    setEditForm({ ...editForm, permissions: perms })
                                  )
                                }
                              />
                              {perm.label}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.permissions.map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === user.id ? (
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={editForm.is_active}
                            onCheckedChange={(checked) =>
                              setEditForm({ ...editForm, is_active: checked as boolean })
                            }
                          />
                          Active
                        </label>
                      ) : (
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === user.id ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(user.id)}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(user)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => handleDelete(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubUserManagement;
