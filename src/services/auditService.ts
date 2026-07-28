import { supabase } from "@/integrations/supabase/client";

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://cors-proxy.htmldriven.com/?url='
];

export interface AuditResult {
  violations: any[];
  passes: any[];
  incomplete: any[];
  timestamp: string;
  url: string;
  userName: string;
  method?: 'client-side' | 'server-side';
}

export const tryServerSideAudit = async (data: { name: string; email: string; url: string }): Promise<AuditResult> => {
  const { data: result, error } = await supabase.functions.invoke('audit-website', {
    body: {
      url: data.url,
      name: data.name,
      email: data.email
    }
  });

  if (error) throw error;

  if (result.success) {
    return {
      violations: result.results.violations || [],
      passes: result.results.passes || [],
      incomplete: result.results.incomplete || [],
      timestamp: result.results.timestamp || new Date().toISOString(),
      url: result.url,
      userName: data.name,
      method: result.method || 'ai-powered'
    };
  } else {
    throw new Error(result.error || 'AI-powered audit failed');
  }
};

export const tryClientSideAudit = async (data: { name: string; email: string; url: string }): Promise<AuditResult> => {
  let testUrl = data.url;
  if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
    testUrl = 'https://' + testUrl;
  }

  let html = '';
  let lastError: Error | null = null;

  // Try multiple CORS proxies with timeout and retry logic
  for (const proxy of CORS_PROXIES) {
    try {
      console.log(`Trying CORS proxy: ${proxy}`);
      const proxyUrl = proxy + encodeURIComponent(testUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AccessibilityAuditor/1.0)',
        }
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        html = await response.text();
        console.log(`Successfully fetched via ${proxy}`);
        break;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.log(`CORS proxy ${proxy} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }

  if (!html) {
    throw new Error(`All CORS proxies failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  // Create iframe and run axe-core
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.srcdoc = html;
  
  document.body.appendChild(iframe);
  
  try {
    // Wait for iframe to load with better timeout handling
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Iframe loading timeout'));
      }, 5000);

      iframe.onload = () => {
        clearTimeout(timeout);
        resolve();
      };

      iframe.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Iframe loading error'));
      };
    });

    // Verify axe-core is available
    if (!window.axe) {
      throw new Error('Axe-core library not loaded');
    }

    const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDocument) {
      throw new Error('Unable to access iframe content - possible CORS restriction');
    }

    const results = await window.axe.run(iframeDocument);
    
    return {
      violations: results.violations || [],
      passes: results.passes || [],
      incomplete: results.incomplete || [],
      timestamp: new Date().toISOString(),
      url: testUrl,
      userName: data.name,
      method: 'client-side'
    };

  } finally {
    // Always clean up iframe
    try {
      document.body.removeChild(iframe);
    } catch (e) {
      console.warn('Failed to remove iframe:', e);
    }
  }
};

const saveSubmission = async (data: { name: string; email: string; url: string }, result: AuditResult) => {
  try {
    await supabase.from('audit_submissions').insert({
      name: data.name,
      email: data.email,
      url: result.url,
      audit_results: {
        violations: result.violations,
        passes: result.passes,
        incomplete: result.incomplete,
        timestamp: result.timestamp,
        method: result.method,
      } as any,
      violations_count: result.violations.length,
      passes_count: result.passes.length,
    });
  } catch (e) {
    console.warn('Failed to save audit submission:', e);
  }
};

export const runAuditWithFallback = async (data: { name: string; email: string; url: string }): Promise<AuditResult> => {
  // Try server-side first, then fall back to client-side
  try {
    console.log('Attempting server-side audit...');
    return await tryServerSideAudit(data);
  } catch (serverError) {
    console.log('Server-side audit failed, trying client-side:', serverError);
    
    try {
      const result = await tryClientSideAudit(data);
      // Server-side path saves via the edge function; save the fallback lead here
      await saveSubmission(data, result);
      return result;
    } catch (clientError) {
      console.error('Both audit methods failed:', { serverError, clientError });
      
      // Create a more descriptive error message
      let errorType = 'unknown';
      let errorMessage = 'Both server-side and client-side audits failed.';
      
      if (clientError instanceof Error) {
        if (clientError.message.includes('CORS proxies failed')) {
          errorType = 'cors_all_proxies_failed';
          errorMessage = 'Unable to access this website through any available proxy. The site may have strict CORS policies or be temporarily unavailable.';
        } else if (clientError.message.includes('iframe')) {
          errorType = 'iframe_access_failed';
          errorMessage = 'Unable to analyze website content. The site may have security restrictions that prevent analysis.';
        } else if (clientError.message.includes('Axe-core')) {
          errorType = 'axe_library_error';
          errorMessage = 'Accessibility testing library error. Please refresh the page and try again.';
        }
      }
      
      const error = new Error(errorMessage);
      (error as any).type = errorType;
      throw error;
    }
  }
};