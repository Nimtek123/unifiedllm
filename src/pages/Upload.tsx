import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload as UploadIcon, File, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Upload = () => {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
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
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      console.error("Error loading files:", error);
      toast.error("Failed to load files");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const file of Array.from(selectedFiles)) {
        try {
          const formData = new FormData();
          formData.append("file", file);

          const { data, error } = await supabase.functions.invoke("upload-document", {
            body: formData,
          });

          if (error) throw error;
          successCount++;
        } catch (error: any) {
          console.error(`Upload error for ${file.name}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} file(s) uploaded successfully!`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} file(s) failed to upload`);
      }
      await loadFiles(user.id);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from("files")
        .delete()
        .eq("id", fileId);

      if (error) throw error;

      toast.success("File deleted successfully");
      await loadFiles(user.id);
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

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
        <div className="mb-8 animate-slide-up">
          <h2 className="text-3xl font-bold mb-2">Upload Documents</h2>
          <p className="text-muted-foreground">Add files to your private knowledge base</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <CardTitle>Upload New File</CardTitle>
              <CardDescription>
                Supported formats: PDF, DOCX, TXT (Max 20MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
                <UploadIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Drop your file here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Files will be processed and added to your knowledge base
                    </p>
                  </div>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".pdf,.docx,.txt"
                    multiple
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <label htmlFor="file-upload">
                    <Button asChild disabled={isUploading}>
                      <span>
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          "Select File"
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <CardHeader>
              <CardTitle>Your Files</CardTitle>
              <CardDescription>
                {files.length} {files.length === 1 ? "file" : "files"} in your knowledge base
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <File className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No files uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className="w-5 h-5 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{file.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.file_size)} • {file.upload_status}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFile(file.id)}
                        className="flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Upload;
