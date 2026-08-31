import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Single backup proxy used only if the direct fetch fails
const BACKUP_PROXY = 'https://api.allorigins.win/raw?url=';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Expected, user-facing failures -> HTTP 200 with { success: false }
class UserFacingError extends Error {
  userFacing = true;
}

// Rate limiting: max requests per IP per hour
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Input validation helpers
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function validateName(name: string): boolean {
  return typeof name === 'string' && name.trim().length >= 1 && name.length <= 100;
}

function isBlockedIPv4(a: number, b: number): string | null {
  if (a === 10) return 'Private IP addresses are not allowed';
  if (a === 172 && b >= 16 && b <= 31) return 'Private IP addresses are not allowed';
  if (a === 192 && b === 168) return 'Private IP addresses are not allowed';
  if (a === 169 && b === 254) return 'Link-local addresses are not allowed';
  if (a === 127) return 'Loopback addresses are not allowed';
  if (a === 0) return 'Invalid IP address';
  if (a === 100 && b >= 64 && b <= 127) return 'Carrier-grade NAT addresses are not allowed';
  if (a === 192 && b === 0) return 'Reserved IP addresses are not allowed';
  if (a >= 224) return 'Multicast/reserved IP addresses are not allowed';
  return null;
}

// Detect decimal / octal / hex encoded IPv4 (e.g. 2130706433, 0177.0.0.1, 0x7f.1)
function decodeNumericHost(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length > 4 || parts.length === 0) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!p.length) return null;
    let n: number;
    if (/^0[xX][0-9a-fA-F]+$/.test(p)) n = parseInt(p, 16);
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8);
    else if (/^\d+$/.test(p)) n = parseInt(p, 10);
    else return null;
    if (!Number.isFinite(n)) return null;
    nums.push(n);
  }
  // Expand to 4 octets
  if (nums.length === 4) return nums;
  const last = nums.pop()!;
  const bytes: number[] = [...nums];
  const remaining = 4 - bytes.length;
  for (let i = remaining - 1; i >= 0; i--) {
    bytes.push((last >>> (i * 8)) & 0xff);
  }
  return bytes.length === 4 ? bytes : null;
}

function isBlockedIPv6(host: string): string | null {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase().split('%')[0];
  if (!h.includes(':')) return null;
  if (h === '::1' || h === '::') return 'Internal addresses are not allowed';
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return 'Private IPv6 addresses are not allowed';
  if (/^fe[89ab][0-9a-f]:/.test(h)) return 'Link-local IPv6 addresses are not allowed';
  // IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1
  const mapped = h.match(/::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (mapped) {
    const blocked = isBlockedIPv4(Number(mapped[1]), Number(mapped[2]));
    if (blocked) return blocked;
  }
  return null;
}

function validateUrl(url: string): { valid: boolean; normalized?: string; error?: string } {
  if (typeof url !== 'string' || url.length > 2048) {
    return { valid: false, error: 'URL must be a string with max 2048 characters' };
  }

  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  try {
    const parsed = new URL(normalized);

    // Only allow http/https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Port restrictions: allow default, 80, 443, or any port >= 1024
    if (parsed.port) {
      const port = Number(parsed.port);
      if (!Number.isInteger(port) || port <= 0) {
        return { valid: false, error: 'Invalid port' };
      }
      if (port < 1024 && port !== 80 && port !== 443) {
        return { valid: false, error: 'This port is not allowed' };
      }
    }

    // Block localhost variants
    if (
      hostname === 'localhost' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.localhost')
    ) {
      return { valid: false, error: 'Internal addresses are not allowed' };
    }

    // IPv6 checks (bracketed or bare)
    const ipv6Blocked = isBlockedIPv6(hostname);
    if (ipv6Blocked) return { valid: false, error: ipv6Blocked };

    // IPv4, including decimal/octal/hex encodings
    if (/^[0-9a-fA-FxX.]+$/.test(hostname) && !hostname.includes(':')) {
      const octets = decodeNumericHost(hostname);
      if (octets) {
        const blocked = isBlockedIPv4(octets[0], octets[1]);
        if (blocked) return { valid: false, error: blocked };
      }
    }

    return { valid: true, normalized };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// Get client IP from request
function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') ||
         'unknown';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client early for rate limiting
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const clientIP = getClientIP(req);
  console.log(`Request from IP: ${clientIP}`);

  try {
    // Rate limiting check - gracefully handle if ip_address column doesn't exist
    try {
      const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
      
      const { count, error: countError } = await supabase
        .from('audit_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', clientIP)
        .gte('created_at', windowStart);

      if (countError) {
        // Log but continue - rate limiting is optional
        console.log('Rate limit check skipped (column may not exist):', countError.message);
      } else if (count !== null && count >= RATE_LIMIT_MAX) {
        console.log(`Rate limit exceeded for IP: ${clientIP} (${count} requests)`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Rate limit exceeded. Please try again later.' 
          }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': '3600'
            } 
          }
        );
      }
    } catch (rateLimitError) {
      console.log('Rate limiting unavailable, continuing:', rateLimitError);
    }

    // Parse and validate input
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url, name, email } = body;

    // Validate required fields
    if (!url || !name || !email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: url, name, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate name
    if (!validateName(name)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Name must be 1-100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email
    if (!validateEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format or too long (max 255 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL with SSRF protection (200 so the client can read the message)
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: urlValidation.error, validation: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const testUrl = urlValidation.normalized!;
    const sanitizedName = name.trim().substring(0, 100);
    const sanitizedEmail = email.trim().toLowerCase().substring(0, 255);

    console.log(`Starting AI-powered audit for: ${testUrl}`);

    // Fetch HTML content directly (server-side, no CORS restriction)
    let html = '';
    let lastError: unknown = null;

    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(12000),
      });

      // Re-validate the final URL after redirects (SSRF redirect protection)
      const finalUrl = response.url || testUrl;
      const finalCheck = validateUrl(finalUrl);
      if (!finalCheck.valid) {
        throw new UserFacingError(`Redirect blocked: ${finalCheck.error}`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      html = await response.text();
      console.log(`Direct fetch succeeded (${html.length} chars)`);
    } catch (error) {
      if (error instanceof UserFacingError) throw error;
      console.log('Direct fetch failed, trying backup proxy:', error);
      lastError = error;
    }

    if (!html) {
      try {
        const response = await fetch(BACKUP_PROXY + encodeURIComponent(testUrl), {
          method: 'GET',
          headers: { 'User-Agent': BROWSER_UA },
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        html = await response.text();
        console.log(`Backup proxy fetch succeeded (${html.length} chars)`);
      } catch (error) {
        console.log('Backup proxy failed:', error);
        lastError = error;
      }
    }

    if (!html) {
      throw new UserFacingError(
        'Unable to fetch website content. Please verify the URL is publicly accessible.'
      );
    }

    // Strip scripts, styles and comments so more real markup fits the budget
    const cleanedHtml = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\n{3,}/g, '\n\n');

    const maxHtmlLength = 120000;
    const truncatedHtml = cleanedHtml.length > maxHtmlLength
      ? cleanedHtml.substring(0, maxHtmlLength) + '\n<!-- HTML truncated for analysis -->'
      : cleanedHtml;

    // Call Lovable AI for accessibility analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('AI service not configured');
    }

    console.log('Calling AI for accessibility analysis...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert web accessibility auditor. Analyze HTML for WCAG 2.1 AA compliance issues.

Your task is to identify accessibility violations, passes, and items needing manual review.

For VIOLATIONS, check for:
- Missing or empty alt attributes on images
- Missing form labels or aria-label
- Color contrast issues (infer from inline styles/classes)
- Missing document language (lang attribute)
- Empty links or buttons
- Missing heading hierarchy (skipped levels)
- Tables without proper headers
- Missing ARIA landmarks
- Keyboard accessibility issues
- Missing skip links
- Auto-playing media
- Missing focus indicators (infer from styles)

For PASSES, note elements that correctly implement:
- Proper alt text on images
- Labeled form controls
- Correct heading hierarchy
- Proper ARIA usage
- Semantic HTML usage

Be thorough and specific. Reference actual elements from the HTML when possible.`
          },
          {
            role: 'user',
            content: `Analyze this HTML for accessibility issues:\n\n${truncatedHtml}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'report_accessibility_audit',
              description: 'Report the accessibility audit findings',
              parameters: {
                type: 'object',
                properties: {
                  violations: {
                    type: 'array',
                    description: 'Accessibility violations found',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Unique identifier like "image-alt", "label", "color-contrast"' },
                        description: { type: 'string', description: 'Description of the violation' },
                        impact: { type: 'string', enum: ['critical', 'serious', 'moderate', 'minor'] },
                        help: { type: 'string', description: 'How to fix this issue' },
                        helpUrl: { type: 'string', description: 'WCAG reference URL' },
                        nodes: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              html: { type: 'string', description: 'The problematic HTML snippet' },
                              failureSummary: { type: 'string', description: 'Why this element fails' }
                            },
                            required: ['html', 'failureSummary']
                          }
                        }
                      },
                      required: ['id', 'description', 'impact', 'help', 'nodes']
                    }
                  },
                  passes: {
                    type: 'array',
                    description: 'Accessibility checks that passed',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        description: { type: 'string' }
                      },
                      required: ['id', 'description']
                    }
                  },
                  incomplete: {
                    type: 'array',
                    description: 'Items needing manual review',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        description: { type: 'string' },
                        help: { type: 'string' }
                      },
                      required: ['id', 'description']
                    }
                  }
                },
                required: ['violations', 'passes', 'incomplete']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'report_accessibility_audit' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Service temporarily busy. Please try again in a moment.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Service quota exceeded. Please try again later.');
      }
      throw new Error('AI analysis failed');
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract the tool call results
    let auditResults = {
      violations: [],
      passes: [],
      incomplete: [],
      url: testUrl,
      timestamp: new Date().toISOString()
    };

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        auditResults.violations = parsed.violations || [];
        auditResults.passes = parsed.passes || [];
        auditResults.incomplete = parsed.incomplete || [];
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
      }
    }

    console.log(`AI audit completed: ${auditResults.violations.length} violations, ${auditResults.passes.length} passes`);

    // Save results with sanitized inputs
    const { error: insertError } = await supabase
      .from('audit_submissions')
      .insert({
        name: sanitizedName,
        email: sanitizedEmail,
        url: testUrl,
        audit_results: auditResults,
        violations_count: auditResults.violations.length,
        passes_count: auditResults.passes.length,
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
    }

    // Track analytics with IP address for rate limiting
    try {
      const { error: analyticsError } = await supabase
        .from('audit_analytics')
        .insert({
          event_type: 'success',
          url: testUrl,
          user_agent: req.headers.get('user-agent')?.substring(0, 500) || undefined,
          ip_address: clientIP,
        });

      if (analyticsError) {
        console.error('Analytics insert error:', analyticsError.message);
      }
    } catch (analyticsErr) {
      console.error('Analytics tracking error:', analyticsErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        results: auditResults,
        url: testUrl,
        method: 'ai-powered'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Audit function error:', {
      message: error.message,
      name: error.name
    });

    // Track failed request with IP for rate limiting
    try {
      await supabase
        .from('audit_analytics')
        .insert({
          event_type: 'error',
          ip_address: clientIP,
        });
    } catch {
      // Ignore analytics errors
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unable to complete accessibility audit. Please try again later.',
        method: 'ai-powered'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
