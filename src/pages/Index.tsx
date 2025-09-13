import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackAuditAttempt, trackAuditSuccess, trackAuditFailure } from "@/utils/analytics";
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

interface AuditResult {
  violations: any[];
  passes: any[];
  incomplete: any[];
  timestamp: string;
  url: string;
  userName: string;
}

const Index = () => {
  const [auditResults, setAuditResults] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const runAccessibilityAudit = async (data: { name: string; email: string; url: string }) => {
    setIsLoading(true);
    let submissionId: string | null = null;
    
    try {
      // Validate URL format
      let testUrl = data.url;
      if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
        testUrl = 'https://' + testUrl;
      }

      // Track audit attempt
      trackAuditAttempt(testUrl);

      // Save initial submission to Supabase
      const { data: submission, error: insertError } = await supabase
        .from('audit_submissions')
        .insert({
          name: data.name,
          email: data.email,
          url: testUrl,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error saving submission:', insertError);
        // Continue with audit even if database save fails
      } else {
        submissionId = submission.id;
      }

      toast({
        title: "Starting audit...",
        description: `Analyzing ${testUrl} for accessibility compliance`,
      });

      // Fetch the website content through CORS proxy
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(testUrl)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Create a hidden iframe and inject the HTML
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.srcdoc = html;
      
      document.body.appendChild(iframe);
      
      // Wait for iframe to load
      await new Promise((resolve) => {
        iframe.onload = resolve;
        setTimeout(resolve, 3000); // Fallback timeout
      });

      // Run axe-core on the iframe content
      if (!window.axe) {
        throw new Error('Axe-core library not loaded');
      }

      const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDocument) {
        throw new Error('Unable to access iframe content');
      }

      const results = await window.axe.run(iframeDocument);
      
      // Clean up
      document.body.removeChild(iframe);
      
      // Process and store results
      const auditResult: AuditResult = {
        violations: results.violations || [],
        passes: results.passes || [],
        incomplete: results.incomplete || [],
        timestamp: new Date().toISOString(),
        url: testUrl,
        userName: data.name,
      };
      
      setAuditResults(auditResult);
      
      // Update submission with audit results if we saved it successfully
      if (submissionId) {
        const { error: updateError } = await supabase
          .from('audit_submissions')
          .update({
            audit_results: results,
            violations_count: results.violations.length,
            passes_count: results.passes.length,
          })
          .eq('id', submissionId);

        if (updateError) {
          console.error('Error updating submission with results:', updateError);
        }
      }
      
      // Track successful audit
      trackAuditSuccess(testUrl, results.violations.length, results.passes.length);
      
      toast({
        title: "Audit complete!",
        description: `Found ${results.violations.length} violations and ${results.passes.length} passed tests`,
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
      
      let errorMessage = "This URL fetch failed – Please make sure the website is accessible to the public or try another URL";
      let errorType = "unknown";
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = "Unable to access this website. It may be protected by CORS policies or unavailable.";
          errorType = "cors_or_network";
        } else if (error.message.includes('Axe-core')) {
          errorMessage = "Accessibility testing library not available. Please refresh the page and try again.";
          errorType = "axe_library_missing";
        } else if (error.message.includes('iframe')) {
          errorType = "iframe_access";
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
