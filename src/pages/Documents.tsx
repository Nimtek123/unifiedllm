import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertCircle,
  Database,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { account, appwriteDb, DATABASE_ID, COLLECTIONS, Query, difyApi } from "@/integrations/appwrite/client";
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
  doc_metadata?: { id: string; name: string; value: string }[];
}

interface DatasetItem {
  $id: string;
  datasetId: string;
  name?: string;
}

const Documents = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<DifyDocument[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userSettings, setUserSettings] = useState<any>(null);
  const [userPermissions, setUserPermissions] = useState({
    can_view: true,
    can_upload: false,
    can_delete: false,
    can_manage_users: false,
  });
  const [subUser, setSubUser] = useState(false);
  const [datasetList, setDatasetList] = useState<DatasetItem[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => searchQuery === "" || doc.name.toLowerCase().includes(searchQuery.toLowerCase()));
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
      let effectiveUserId = userId;

      // Check if logged-in user is a sub-user
      const teamRes = await appwriteDb.listDocuments(DATABASE_ID, "team_members", [Query.equal("userId", userId)]);

      if (teamRes.documents.length > 0) {
        const subUserDoc = teamRes.documents[0];
        effectiveUserId = teamRes.documents[0].parentUserId;
        setSubUser(true);
        setUserPermissions({
          can_view: subUserDoc.can_view,
          can_upload: subUserDoc.can_upload,
          can_delete: subUserDoc.can_delete,
          can_manage_users: subUserDoc.can_manage_users,
        });
      }

      // Load all datasets for the effective user
      const response = await appwriteDb.listDocuments(DATABASE_ID, COLLECTIONS.USER_SETTINGS, [
        Query.equal("userId", effectiveUserId),
      ]);

      const datasets = response.documents.map((doc: any) => ({
        $id: doc.$id,
        datasetId: doc.datasetId,
        name: doc.name || doc.datasetId,
        apiKey: doc.apiKey,
      }));

      setDatasetList(datasets);

      if (datasets.length > 0) {
        const firstDataset = datasets[0];
        setSelectedDataset(firstDataset.datasetId);
        setUserSettings(firstDataset);
        await loadDocuments(firstDataset.datasetId, firstDataset.apiKey);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      setIsLoading(false);
    }
  };

  const handleDatasetChange = async (datasetId: string) => {
    setSelectedDataset(datasetId);
    const dataset = datasetList.find((d: any) => d.datasetId === datasetId);
    if (dataset) {
      setUserSettings(dataset);
      setIsLoading(true);
      await loadDocuments(dataset.datasetId, (dataset as any).apiKey);
    }
  };

  const loadDocuments = async (datasetId: string, apiKey: string) => {
    try {
      const response = await fetch(`https://dify.unified-bi.org/v1/datasets/${datasetId}/documents?page=1&limit=100`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
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
      // 1️⃣ Find document_url metadata
      const documentUrlMeta = doc.doc_metadata?.find((m) => m.name === "document_url");

      if (!documentUrlMeta) {
        throw new Error("Document URL not found");
      }

      const filename = getFilenameFromUrl(documentUrlMeta.value);

      // 2️⃣ Delete file from file server
      const fileDeleteRes = await fetch(
        `https://llmapi.unified-bi.org/file?datasetId=${userSettings.datasetId}&filename=${filename}`,
        {
          method: "DELETE",
          // headers: {
          //   "x-api-key": FILE_API_KEY, // optional
          // },
        },
      );

      if (!fileDeleteRes.ok) {
        throw new Error("Failed to delete file from server");
      }

      // 3️⃣ Delete from Dify
      const response = await fetch(
        `https://dify.unified-bi.org/v1/datasets/${userSettings.datasetId}/documents/${doc.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${userSettings.apiKey}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete document from Dify");
      }

      toast.success("Document deleted successfully");
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  function getFilenameFromUrl(url: string) {
    return url.split("/").pop();
  }

  const clearFilters = () => setSearchQuery("");

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "—";
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
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
        <div className="mb-6 animate-slide-up flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">Document Management</h2>
            <p className="text-muted-foreground">View and manage your uploaded documents</p>
          </div>
          {datasetList.length > 1 && (
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Dataset:</span>
              <Select value={selectedDataset} onValueChange={handleDatasetChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasetList.map((dataset: any) => (
                    <SelectItem key={dataset.$id} value={dataset.datasetId}>
                      {dataset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
                    <Button variant="outline" onClick={clearFilters}>
                      Clear Filters
                    </Button>
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
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  doc.indexing_status === "completed"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : doc.indexing_status === "indexing" || doc.indexing_status === "parsing"
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {doc.indexing_status}
                              </span>
                            </TableCell>
                            <TableCell>{doc.word_count || "—"}</TableCell>
                            <TableCell>{formatDate(doc.created_at)}</TableCell>
                            <TableCell className="text-right">
                              {(userPermissions.can_delete || !subUser) && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      disabled={deletingId === doc.id}
                                    >
                                      {deletingId === doc.id ? (
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
                                        Are you sure you want to delete "{doc.name}"? This cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(doc)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                          {Math.min(currentPage * ITEMS_PER_PAGE, filteredDocuments.length)} of{" "}
                          {filteredDocuments.length}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4" />
                            <ChevronLeft className="w-4 h-4 -ml-2" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                className="w-8 h-8 p-0"
                                onClick={() => setCurrentPage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                          >
                            <ChevronRight className="w-4 h-4" />
                            <ChevronRight className="w-4 h-4 -ml-2" />
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
