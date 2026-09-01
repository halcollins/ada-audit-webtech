import { supabase } from "@/integrations/supabase/client";

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
];

export const AUDIT_TIMEOUT_MS = 45000;

export interface AuditResult {
  violations: any[];
  passes: any[];
  incomplete: any[];
  timestamp: string;
  url: string;
  userName: string;
  method?: 'client-side' | 'server-side' | 'ai-powered';
}

export const tryServerSideAudit = async (data: { name: string; email: string; url: string }): Promise<AuditResult> => {
  const { data: result, error } = await supabase.functions.invoke('audit-website', {
    body: {
      url: data.url,
      name: data.name,
      email: data.email
    }
  });

  if (error) {
    // functions.invoke discards the response body on non-2xx - recover it
    const body = await (error as any).context?.json?.().catch(() => null);
    const status = (error as any).context?.status;
    const err = new Error(body?.error || error.message);
    (err as any).status = status;
    (err as any).final = status === 429 || body?.validation === true;
    throw err;
  }

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
    const err = new Error(result.error || 'AI-powered audit failed');
    (err as any).final = result.validation === true || /rate limit/i.test(result.error || '');
    throw err;
  }
};

const AXE_CDN_URL = 'https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js';
let axeLoadPromise: Promise<void> | null = null;

const loadAxeCore = (): Promise<void> => {
  if ((window as any).axe) return Promise.resolve();
  if (axeLoadPromise) return axeLoadPromise;

  axeLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = AXE_CDN_URL;
    script.async = true;
    script.onload = () => {
      if ((window as any).axe) resolve();
      else reject(new Error('Axe-core library not loaded'));
    };
    script.onerror = () => reject(new Error('Axe-core library not loaded'));
    document.head.appendChild(script);
  }).catch((e) => {
    axeLoadPromise = null;
    throw e;
  });

  return axeLoadPromise;
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
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 second timeout
      
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

    // Load axe-core on demand (pinned version)
    await loadAxeCore();
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
    // Do not fall back on rate limits or validation errors - surface them
    if ((serverError as any)?.final) {
      const error = new Error((serverError as Error).message);
      (error as any).type = 'server_rejected';
      throw error;
    }

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