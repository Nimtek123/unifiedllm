import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload as UploadIcon, File, Loader2, AlertCircle, X, Database } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { account, appwriteDb, DATABASE_ID, COLLECTIONS, Query } from "@/integrations/appwrite/client";

const Upload = () => {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [indexingTechnique, setIndexingTechnique] = useState("high_quality");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [maxDocuments, setMaxDocuments] = useState(5);
  const [userPermissions, setUserPermissions] = useState({
    can_view: true,
    can_upload: false,
    can_delete: false,
    can_manage_users: false,
  });
  const [subUser, setSubUser] = useState(false);
  const [datasetList, setDatasetList] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");

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
        maxDocuments: doc.maxDocuments || 5,
      }));

      setDatasetList(datasets);

      if (datasets.length > 0) {
        const firstDataset = datasets[0];
        setSelectedDataset(firstDataset.datasetId);
        setUserSettings(firstDataset);
        setMaxDocuments(firstDataset.maxDocuments || 5);
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
      setMaxDocuments(dataset.maxDocuments || 5);
      setIsLoading(true);
      await loadDocuments(dataset.datasetId, dataset.apiKey);
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
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // setSelectedFiles(Array.from(files));
      setSelectedFiles((prev) => {
        const newFiles = Array.from(files);
        const map = new Map<string, File>();

        [...prev, ...newFiles].forEach((file) => {
          map.set(file.name + file.size, file);
        });

        return Array.from(map.values());
      });
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const validFiles = Array.from(files).filter(
        (file) =>
          file.name.endsWith(".csv") ||
          file.name.endsWith(".xlsx") ||
          file.name.endsWith(".pdf") ||
          file.name.endsWith(".docx") ||
          file.name.endsWith(".txt"),
      );
      if (validFiles.length > 0) {
        // setSelectedFiles(validFiles);
        setSelectedFiles((prev) => {
          const newFiles = Array.from(validFiles);
          const map = new Map<string, File>();

          [...prev, ...newFiles].forEach((file) => {
            map.set(file.name + file.size, file);
          });

          return Array.from(map.values());
        });
      } else {
        toast.error("Please drop PDF, DOCX, XLSX, CSV or TXT files only");
      }
    }
  }, []);

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !userSettings) {
      toast.error("Please select files to upload");
      return;
    }

    setIsUploading(true);
    let successCount = 0;

    try {
      for (const file of selectedFiles) {
        // 1️⃣ Upload to your server
        const documentUrl = await uploadToServer(file, userSettings.datasetId);

        // 2️⃣ Upload to Dify
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "data",
          JSON.stringify({
            indexing_technique: indexingTechnique,
            process_rule: { mode: "automatic" },
          }),
        );

        const response = await fetch(
          `https://dify.unified-bi.org/v1/datasets/${userSettings.datasetId}/document/create_by_file`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${userSettings.apiKey}`,
            },
            body: formData,
          },
        );

        if (!response.ok) throw new Error("Dify upload failed");

        const difyData = await response.json();
        const documentId = difyData.document.id;

        // 3️⃣ Attach metadata
        await attachDocumentMetadata(userSettings.datasetId, userSettings.apiKey, documentId, documentUrl);

        successCount++;
        setUploadProgress(Math.round((successCount / selectedFiles.length) * 100));
      }

      toast.success(`${successCount} document(s) uploaded successfully`);
      await loadDocuments(userSettings.datasetId, userSettings.apiKey);
      setSelectedFiles([]);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  async function uploadToServer(file: File, datasetId: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`https://llmapi.unified-bi.org/upload?datasetId=${encodeURIComponent(datasetId)}`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Server upload failed");

    const data = await res.json();
    return data.url;
  }

  async function attachDocumentMetadata(datasetId: string, apiKey: string, documentId: string, documentUrl: string) {
    const res = await fetch(`https://dify.unified-bi.org/v1/datasets/${datasetId}/documents/metadata`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation_data: [
          {
            document_id: documentId,
            metadata_list: [
              {
                id: "675a0bc9-b35b-4114-8a30-a8ffd2413b2f",
                name: "document_url",
                value: documentUrl,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Metadata update failed: ${err}`);
    }
  }

  const remainingUploads = maxDocuments - documents.length;
  const canUpload = remainingUploads > 0;

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
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-3xl font-bold mb-2">Upload Documents</h2>
              <p className="text-muted-foreground">Add files to your private knowledge base</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
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
                          {dataset.name || dataset.datasetId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Badge variant={canUpload ? "default" : "destructive"}>
                  {documents.length} / {maxDocuments} documents
                </Badge>
                {!canUpload && (
                  <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
                    Upgrade Account
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {!userSettings ? (
          <Card className="max-w-lg mx-auto animate-slide-up">
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-1">API Settings Required</p>
              <p className="text-sm text-muted-foreground mb-4">Configure your API settings to upload documents</p>
              <Button onClick={() => navigate("/settings")}>Go to Settings</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
              <CardHeader>
                <CardTitle>Upload New Files</CardTitle>
                <CardDescription>
                  Supported formats: PDF, DOCX, TXT (Max 20MB) •{" "}
                  {remainingUploads > 0 ? `${remainingUploads} uploads remaining` : "Upload limit reached"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!canUpload || (subUser && !userPermissions.can_upload) ? (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center border-destructive/50 bg-destructive/5">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
                    {/* Case 1 — User has NO upload permissions */}
                    {subUser && !userPermissions.can_upload ? (
                      <>
                        <p className="text-sm font-medium mb-1 text-destructive">No permissions to upload</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          Your administrator has disabled uploads for your account.
                        </p>
                      </>
                    ) : (
                      <>
                        {/* Case 2 — User CAN upload but reached limit */}
                        {!canUpload && (
                          <>
                            <p className="text-sm font-medium mb-1 text-destructive">Upload Limit Reached</p>

                            <p className="text-xs text-muted-foreground mb-4">
                              You've reached your document limit of {maxDocuments} files.
                            </p>

                            <Button variant="outline" onClick={() => navigate("/settings")}>
                              Upgrade Account
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary"
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById("file-upload")?.click()}
                    >
                      <UploadIcon
                        className={`w-12 h-12 mx-auto mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <div className="space-y-4">
                        <p className="text-sm font-medium mb-1">Drop your files here or click to browse</p>
                        <p className="text-xs text-muted-foreground">
                          Files will be processed and added to your knowledge base
                        </p>
                        <input
                          type="file"
                          id="file-upload"
                          className="hidden"
                          accept=".pdf,.docx,.txt"
                          multiple
                          onChange={handleFileSelect}
                          disabled={isUploading}
                        />
                        {/* <label htmlFor="file-upload"> */}
                        <Button asChild variant="outline" disabled={isUploading}>
                          <span>Select Files</span>
                        </Button>
                        {/* </label> */}
                      </div>
                    </div>

                    {selectedFiles.length > 0 && (
                      <div className="space-y-2 p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Selected files:</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => setSelectedFiles([])}
                          >
                            Clear all
                          </Button>
                        </div>
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              • {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 hover:text-destructive"
                              onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {selectedFiles.length > remainingUploads && (
                          <p className="text-xs text-destructive">
                            Warning: You've selected more files than your remaining upload limit ({remainingUploads})
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Indexing Technique</label>
                      <Select value={indexingTechnique} onValueChange={setIndexingTechnique}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high_quality">High Quality</SelectItem>
                          <SelectItem value="economy">Economy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {uploadProgress > 0 && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress} />
                        <p className="text-xs text-center text-muted-foreground">{uploadProgress}%</p>
                      </div>
                    )}

                    <Button
                      className="w-full"
                      onClick={handleUpload}
                      disabled={isUploading || selectedFiles.length === 0}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        "Upload All Files"
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <CardHeader>
                <CardTitle>Your Files</CardTitle>
                <CardDescription>
                  {documents.length} {documents.length === 1 ? "file" : "files"} in your knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <File className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No files uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <File className="w-5 h-5 text-primary flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{doc.indexing_status || "completed"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Upload;
