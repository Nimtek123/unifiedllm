import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Trash2, FileText, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FileRecord {
  id: string;
  filename: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string | null;
  dify_document_id: string | null;
  upload_status: string | null;
}

const ITEMS_PER_PAGE = 10;

const Documents = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [allFiles, setAllFiles] = useState<FileRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");

  // Get unique file types for filter dropdown
  const fileTypes = useMemo(() => {
    const types = new Set<string>();
    allFiles.forEach((file) => {
      if (file.file_type) types.add(file.file_type);
    });
    return Array.from(types).sort();
  }, [allFiles]);

  // Filter files based on search and file type
  const filteredFiles = useMemo(() => {
    return allFiles.filter((file) => {
      const matchesSearch = searchQuery === "" || 
        file.filename.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = fileTypeFilter === "all" || file.file_type === fileTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [allFiles, searchQuery, fileTypeFilter]);

  // Paginate filtered files
  const paginatedFiles = useMemo(() => {
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredFiles.slice(from, from + ITEMS_PER_PAGE);
  }, [filteredFiles, currentPage]);

  const totalPages = Math.ceil(filteredFiles.length / ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, fileTypeFilter]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      await loadFiles(session.user.id);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadFiles = async (userId: string) => {
    try {
      setIsLoading(true);

      const { data, error, count } = await supabase
        .from("files")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllFiles(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error("Error loading files:", error);
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (file: FileRecord) => {
    setDeletingId(file.id);
    
    try {
      // Delete from Dify if document ID exists
      if (file.dify_document_id) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.functions.invoke("delete-document", {
            body: { documentId: file.dify_document_id }
          });
        }
      }

      // Delete from database
      const { error } = await supabase
        .from("files")
        .delete()
        .eq("id", file.id);

      if (error) throw error;

      toast.success("Document deleted successfully");
      
      // Reload files
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await loadFiles(session.user.id);
      }
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFileTypeFilter("all");
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const hasActiveFilters = searchQuery !== "" || fileTypeFilter !== "all";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-subtle">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 animate-slide-up">
          <h2 className="text-3xl font-bold mb-2">Document Management</h2>
          <p className="text-muted-foreground">View and manage your uploaded documents</p>
        </div>

        <Card className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Your Documents ({totalCount})
            </CardTitle>
            <CardDescription>
              Manage files in your knowledge base
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalCount === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-1">No documents yet</p>
                <p className="text-sm mb-4">Upload documents to get started</p>
                <Button onClick={() => navigate("/upload")}>Upload Documents</Button>
              </div>
            ) : (
              <>
                {/* Search and Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by filename..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {fileTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                      <X className="w-4 h-4" />
                      Clear
                    </Button>
                  )}
                </div>

                {/* Results info */}
                {hasActiveFilters && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Showing {filteredFiles.length} of {totalCount} documents
                  </p>
                )}

                {paginatedFiles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-1">No matching documents</p>
                    <p className="text-sm mb-4">Try adjusting your search or filters</p>
                    <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Filename</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedFiles.map((file) => (
                          <TableRow key={file.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {file.filename}
                            </TableCell>
                            <TableCell>{file.file_type || "—"}</TableCell>
                            <TableCell>{formatFileSize(file.file_size)}</TableCell>
                            <TableCell>{formatDate(file.created_at)}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                file.upload_status === "completed" 
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : file.upload_status === "pending"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {file.upload_status || "unknown"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    disabled={deletingId === file.id}
                                  >
                                    {deletingId === file.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{file.filename}"? This will also remove it from your knowledge base and cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(file)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          Page {currentPage} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Next
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Documents;
