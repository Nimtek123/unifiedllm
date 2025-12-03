import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload as UploadIcon, File, Loader2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { account, databases, DATABASE_ID, COLLECTIONS } from "@/integrations/appwrite/client";

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
        setMaxDocuments(settings.maxDocuments || 5);
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
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
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
      const validFiles = Array.from(files).filter(file => 
        file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.txt')
      );
      if (validFiles.length > 0) {
        setSelectedFiles(validFiles);
      } else {
        toast.error("Please drop PDF, DOCX, or TXT files only");
      }
    }
  }, []);

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !userSettings) {
      toast.error("Please select files to upload");
      return;
    }

    // Check document limit
    const totalAfterUpload = documents.length + selectedFiles.length;
    if (totalAfterUpload > maxDocuments) {
      const remaining = maxDocuments - documents.length;
      toast.error(
        `Document limit exceeded! You can upload ${remaining > 0 ? remaining : 0} more file(s). ` +
        `Current: ${documents.length}/${maxDocuments}. Please upgrade your account for more uploads.`
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    let successCount = 0;

    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("data", JSON.stringify({
          indexing_technique: indexingTechnique,
          process_rule: { mode: "automatic" }
        }));

        const response = await fetch(
          `https://dify.unified-bi.org/v1/datasets/${userSettings.datasetId}/document/create_by_file`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${userSettings.apiKey}` },
            body: formData,
          }
        );

        if (response.ok) {
          successCount++;
        }
        setUploadProgress(Math.round((successCount / selectedFiles.length) * 100));
      }

      if (successCount > 0) {
        toast.success(`Success! ${successCount} of ${selectedFiles.length} files uploaded.`);
        await loadDocuments(userSettings.datasetId, userSettings.apiKey);
        setSelectedFiles([]);
      } else {
        toast.error("No files were uploaded successfully");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 3000);
    }
  };

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
                  Supported formats: PDF, DOCX, TXT (Max 20MB) • {remainingUploads > 0 ? `${remainingUploads} uploads remaining` : "Upload limit reached"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!canUpload ? (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center border-destructive/50 bg-destructive/5">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
                    <p className="text-sm font-medium mb-1 text-destructive">Upload Limit Reached</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      You've reached your document limit of {maxDocuments} files.
                    </p>
                    <Button variant="outline" onClick={() => navigate("/settings")}>
                      Upgrade Account
                    </Button>
                  </div>
                ) : (
                  <>
                    <div 
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                        isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <UploadIcon className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="space-y-4">
                        <p className="text-sm font-medium mb-1">Drop your files here or click to browse</p>
                        <p className="text-xs text-muted-foreground">Files will be processed and added to your knowledge base</p>
                        <input type="file" id="file-upload" className="hidden" accept=".pdf,.docx,.txt" multiple onChange={handleFileSelect} disabled={isUploading} />
                        <label htmlFor="file-upload">
                          <Button asChild variant="outline" disabled={isUploading}>
                            <span>Select Files</span>
                          </Button>
                        </label>
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
                            <span>• {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 hover:text-destructive"
                              onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
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

                    <Button className="w-full" onClick={handleUpload} disabled={isUploading || selectedFiles.length === 0}>
                      {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : "Upload All Files"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <CardHeader>
                <CardTitle>Your Files</CardTitle>
                <CardDescription>{documents.length} {documents.length === 1 ? "file" : "files"} in your knowledge base</CardDescription>
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
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
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