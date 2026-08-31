import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { trackAuditAttempt, trackAuditSuccess, trackAuditFailure } from "@/utils/analytics";
import { runAuditWithFallback, AUDIT_TIMEOUT_MS, type AuditResult } from "@/services/auditService";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import AuditForm from "@/components/AuditForm";
import AuditResults from "@/components/AuditResults";
import Footer from "@/components/Footer";

// Declare axe for TypeScript
declare global {
  interface Window {
    axe: any;
  }
}

const Index = () => {
  const [auditResults, setAuditResults] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const runAccessibilityAudit = async (data: { name: string; email: string; url: string }) => {
    setIsLoading(true);
    
    try {
      // Validate URL format
      let testUrl = data.url;
      if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
        testUrl = 'https://' + testUrl;
      }

      // Track audit attempt
      trackAuditAttempt(testUrl);

      toast({
        title: "Starting audit...",
        description: `Analyzing ${testUrl} for accessibility compliance using improved reliability system`,
      });

      // Use the audit service with fallback logic, capped at 45 seconds total
      const auditResult = await Promise.race([
        runAuditWithFallback(data),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            const err = new Error(
              "The audit took longer than 45 seconds and was stopped. The site may be slow or blocking automated requests \u2014 please try again or use a different URL."
            );
            (err as any).type = "timeout";
            reject(err);
          }, AUDIT_TIMEOUT_MS)
        ),
      ]);
      
      setAuditResults(auditResult);
      
      // Note: Database save is handled by the edge function for server-side audits
      
      // Track successful audit
      trackAuditSuccess(auditResult.url, auditResult.violations.length, auditResult.passes.length);
      
      const methodText =
        auditResult.method === 'ai-powered'
          ? 'AI-powered server analysis'
          : auditResult.method === 'server-side'
            ? 'server-side processing'
            : 'client-side processing';
      
      toast({
        title: "Audit complete!",
        description: `Found ${auditResult.violations.length} violations and ${auditResult.passes.length} passed tests (via ${methodText})`,
      });

      // Scroll to results
      setTimeout(() => {
        const resultsSection = document.getElementById('audit-results');
        if (resultsSection) {
          resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
    } catch (error) {
      console.error('Audit failed:', error);
      
      let errorMessage = "Unable to analyze this website. Please try a different URL or check if the site is publicly accessible.";
      let errorType = "unknown";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorType = (error as any).type || "unknown";
        
        // Override with user-friendly messages based on error type
        switch (errorType) {
          case 'cors_all_proxies_failed':
            errorMessage = "This website cannot be accessed due to security restrictions. Try a different URL or contact the site owner.";
            break;
          case 'iframe_access_failed':
            errorMessage = "Website security settings prevent analysis. This is common with banking sites and secure applications.";
            break;
          case 'axe_library_error':
            errorMessage = "Testing tools unavailable. Please refresh the page and try again.";
            break;
          case 'server_rejected':
          case 'timeout':
            // Use the message as-is
            break;
        }
      }
      
      // Track failed audit
      trackAuditFailure(data.url.startsWith('http') ? data.url : `https://${data.url}`, errorType);
      
      toast({
        title: "Audit failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <Hero />
      <AuditForm onSubmit={runAccessibilityAudit} isLoading={isLoading} />
      
      {auditResults && (
        <div id="audit-results">
          <AuditResults results={auditResults} />
        </div>
      )}
      
      <Footer />
    </main>
  );
};

export default Index;
