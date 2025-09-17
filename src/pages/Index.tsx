import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackAuditAttempt, trackAuditSuccess, trackAuditFailure } from "@/utils/analytics";
import { runAuditWithFallback, type AuditResult } from "@/services/auditService";
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

      // Use the new audit service with fallback logic
      const auditResult = await runAuditWithFallback(data);
      
      setAuditResults(auditResult);
      
      // Save audit results to database
      const { error: resultsError } = await supabase
        .from('audit_submissions')
        .insert({
          name: data.name,
          email: data.email,
          url: auditResult.url,
          audit_results: {
            violations: auditResult.violations,
            passes: auditResult.passes,
            incomplete: auditResult.incomplete
          },
          violations_count: auditResult.violations.length,
          passes_count: auditResult.passes.length,
        });

      if (resultsError) {
        console.error('Error saving audit results:', resultsError);
      }
      
      // Track successful audit
      trackAuditSuccess(auditResult.url, auditResult.violations.length, auditResult.passes.length);
      
      const methodText = auditResult.method === 'server-side' ? 'server-side processing' : 'client-side processing';
      
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
