import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, FileText, MessageSquare, Shield, Zap, CheckCircle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-subtle">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white font-bold shadow-glow">
              UL
            </div>
            <h1 className="text-xl font-bold">Unified LLM Portal</h1>
          </div>
          <Button onClick={() => navigate("/auth")}>
            Get Started
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <section className="py-20 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-primary text-white mb-6 shadow-glow">
            <Brain className="w-10 h-10" />
          </div>
          <h1 className="text-5xl font-bold mb-6 max-w-3xl mx-auto">
            Your Private AI Knowledge Assistant
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload your documents and chat with a powerful LLM that understands your business context. 
            Secure, private, and built for B2B.
          </p>
          <Button size="lg" className="text-lg px-8" onClick={() => navigate("/auth")}>
            Start Your Free Account
          </Button>
        </section>

        <section className="py-16 grid md:grid-cols-3 gap-8 animate-slide-up">
          <div className="text-center p-6 rounded-xl bg-card border shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg gradient-primary text-white flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload Documents</h3>
            <p className="text-muted-foreground">
              Add PDFs, DOCX, and TXT files to build your private knowledge base
            </p>
          </div>

          <div className="text-center p-6 rounded-xl bg-card border shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg gradient-primary text-white flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Chat with AI</h3>
            <p className="text-muted-foreground">
              Ask natural language questions and get intelligent answers from your documents
            </p>
          </div>

          <div className="text-center p-6 rounded-xl bg-card border shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg gradient-primary text-white flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
            <p className="text-muted-foreground">
              Multi-tenant isolation ensures your data stays completely private
            </p>
          </div>
        </section>

        <section className="py-16 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="max-w-3xl mx-auto bg-card border rounded-2xl p-8 shadow-lg">
            <h2 className="text-3xl font-bold mb-6 text-center">Why Choose Unified LLM Portal?</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">Private Dataset Per User</h4>
                  <p className="text-muted-foreground">Each user gets their own isolated knowledge base</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">Powered by Dify AI</h4>
                  <p className="text-muted-foreground">Industry-leading LLM technology for accurate responses</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">Easy Document Management</h4>
                  <p className="text-muted-foreground">Upload, organize, and manage your files effortlessly</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">Instant Setup</h4>
                  <p className="text-muted-foreground">Get started in minutes with automatic workflow creation</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 text-center animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Workflow?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join businesses using AI to unlock insights from their documents
          </p>
          <Button size="lg" className="text-lg px-8" onClick={() => navigate("/auth")}>
            Create Your Account
          </Button>
        </section>
      </main>

      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 Unified LLM Portal. Powered by Dify AI.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
