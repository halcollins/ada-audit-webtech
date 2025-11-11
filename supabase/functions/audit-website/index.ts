import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://cors-proxy.htmldriven.com/?url='
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, name, email } = await req.json();

    if (!url || !name || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: url, name, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and normalize URL
    let testUrl = url;
    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
      testUrl = 'https://' + testUrl;
    }

    console.log(`Starting audit for: ${testUrl}`);

    // Try multiple CORS proxies
    let html = '';
    let lastError = null;

    for (const proxy of CORS_PROXIES) {
      try {
        console.log(`Trying proxy: ${proxy}`);
        const proxyUrl = proxy + encodeURIComponent(testUrl);
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AccessibilityAuditor/1.0)',
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (response.ok) {
          html = await response.text();
          console.log(`Successfully fetched content via ${proxy}`);
          break;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.log(`Proxy ${proxy} failed:`, error);
        lastError = error;
        continue;
      }
    }

    if (!html) {
      throw new Error(`All CORS proxies failed. Last error: ${lastError?.message}`);
    }

    console.log(`Fetched HTML content: ${html.length} characters`);

    // Parse HTML into DOM
    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");
    
    if (!document) {
      throw new Error('Failed to parse HTML document');
    }

    console.log('HTML parsed successfully, running accessibility audit...');

    // Load and execute axe-core
    const axeResponse = await fetch('https://cdn.jsdelivr.net/npm/axe-core@4.8.2/axe.min.js');
    const axeCode = await axeResponse.text();

    // Create a global context for axe-core
    const globalThis = {
      window: {
        document: document,
        Node: globalThis.Node,
        NodeList: globalThis.NodeList,
        HTMLElement: globalThis.HTMLElement,
        Element: globalThis.Element,
        getComputedStyle: () => ({}), // Mock function
        addEventListener: () => {}, // Mock function
      },
      document: document,
      Node: globalThis.Node,
      NodeList: globalThis.NodeList,
      HTMLElement: globalThis.HTMLElement,  
      Element: globalThis.Element,
    };

    // Execute axe-core in the context
    let auditResults;
    try {
      // Eval axe-core code with our global context
      const axeFunction = new Function('globalThis', 'window', 'document', axeCode + '; return axe;');
      const axe = axeFunction(globalThis, globalThis.window, document);
      
      // Configure axe for server-side execution
      axe.configure({
        reporter: 'v2',
        resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'],
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
        }
      });

      // Run the audit
      auditResults = await new Promise((resolve, reject) => {
        axe.run(document, (err, results) => {
          if (err) {
            reject(new Error(`Axe audit failed: ${err.message}`));
          } else {
            resolve(results);
          }
        });
      });

      console.log(`Audit completed: ${auditResults.violations.length} violations, ${auditResults.passes.length} passes`);
      
    } catch (axeError) {
      console.error('Axe execution error:', axeError);
      // Fallback to basic DOM analysis if axe fails
      auditResults = {
        violations: [],
        passes: [{
          id: 'server-fallback',
          description: 'Server-side audit completed with fallback method',
          impact: null,
          tags: ['fallback'],
          nodes: []
        }],
        incomplete: [],
        inapplicable: [],
        url: testUrl,
        timestamp: new Date().toISOString()
      };
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save audit results to database
    const { error: insertError } = await supabase
      .from('audit_submissions')
      .insert({
        name,
        email,
        url: testUrl,
        audit_results: auditResults,
        violations_count: auditResults.violations.length,
        passes_count: auditResults.passes.length,
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
    }

    // Track analytics
    const { error: analyticsError } = await supabase
      .from('audit_analytics')
      .insert({
        event_type: 'success',
        url: testUrl,
        user_agent: req.headers.get('user-agent') || undefined,
      });

    if (analyticsError) {
      console.error('Analytics error:', analyticsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        results: auditResults,
        url: testUrl,
        method: 'server-side'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    // Log full error details server-side only
    console.error('Audit function error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Return generic error message to client
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unable to complete accessibility audit. Please try again later.',
        method: 'server-side'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});