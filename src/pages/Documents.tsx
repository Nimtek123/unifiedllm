import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Trash2, FileText, ChevronLeft, ChevronRight, Search, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { account, databases, DATABASE_ID, COLLECTIONS } from "@/lib/appwrite";
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

const ITEMS_PER_PAGE = 10;

interface DifyDocument {
  id: string;
  name: string;
  data_source_type: string;
  indexing_status: string;
  word_count: number | null;
  created_at: number;
  enabled: boolean;
}

const Documents = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<DifyDocument[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userSettings, setUserSettings] = useState<any>(null);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => 
      searchQuery === "" || doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

  const paginatedDocuments = useMemo(() => {
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDocuments.slice(from, from + ITEMS_PER_PAGE);
  }, [filteredDocuments, currentPage]);

  const totalPages = Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const user = await account.get();
      await loadUserSettings(user.$id);
    } catch (error) {
      navigate("/auth");
    }
  };

  const loadUserSettings = async (userId: string) => {
    try {
      const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_SETTINGS);
      const settings = response.documents.find((doc: any) => doc.userId === userId);
      
      if (settings?.datasetId && settings?.apiKey) {
        setUserSettings(settings);
        await loadDocuments(settings.datasetId, settings.apiKey);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      setIsLoading(false);
    }
  };

  const loadDocuments = async (datasetId: string, apiKey: string) => {
    try {
      const response = await fetch(
        `https://dify.unified-bi.org/v1/datasets/${datasetId}/documents?page=1&limit=100`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.data || []);
      }
    } catch (error: any) {
      console.error("Error loading documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (doc: DifyDocument) => {
    if (!userSettings) return;
    setDeletingId(doc.id);
    
    try {
      const response = await fetch(
        `https://dify.unified-bi.org/v1/datasets/${userSettings.datasetId}/documents/${doc.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${userSettings.apiKey}` },
        }
      );

      if (response.ok) {
        toast.success("Document deleted successfully");
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
      } else {
        const error = await response.json();
        toast.error(`Failed to delete: ${error.message || "Unknown error"}`);
      }
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  const clearFilters = () => setSearchQuery("");

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "—";
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

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
        <div className="container mx-auto px-4 py-4">
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
              Your Documents ({documents.length})
            </CardTitle>
            <CardDescription>Manage files in your knowledge base</CardDescription>
          </CardHeader>
          <CardContent>
            {!userSettings ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-1">API Settings Required</p>
                <p className="text-sm text-muted-foreground mb-4">Configure your API settings to view documents</p>
                <Button onClick={() => navigate("/settings")}>Go to Settings</Button>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-1">No documents yet</p>
                <p className="text-sm mb-4">Upload documents to get started</p>
                <Button onClick={() => navigate("/upload")}>Upload Documents</Button>
              </div>
            ) : (
              <>
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
                  {searchQuery && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                      <X className="w-4 h-4" />
                      Clear
                    </Button>
                  )}
                </div>

                {searchQuery && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Showing {filteredDocuments.length} of {documents.length} documents
                  </p>
                )}

                {paginatedDocuments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-1">No matching documents</p>
                    <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Filename</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Words</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedDocuments.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">{doc.name}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                doc.indexing_status === "completed" 
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : doc.indexing_status === "indexing" || doc.indexing_status === "parsing"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {doc.indexing_status}
                              </span>
                            </TableCell>
                            <TableCell>{doc.word_count || "—"}</TableCell>
                            <TableCell>{formatDate(doc.created_at)}</TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={deletingId === doc.id}>
                                    {deletingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{doc.name}"? This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(doc)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                        <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft className="w-4 h-4" /> Previous
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            Next <ChevronRight className="w-4 h-4" />
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
