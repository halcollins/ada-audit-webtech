import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
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

    console.log(`Starting AI-powered audit for: ${testUrl}`);

    // Fetch HTML content
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
          signal: AbortSignal.timeout(15000),
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
      throw new Error(`Unable to fetch website content. Please verify the URL is accessible.`);
    }

    console.log(`Fetched HTML content: ${html.length} characters`);

    // Truncate HTML if too long (to fit AI context)
    const maxHtmlLength = 50000;
    const truncatedHtml = html.length > maxHtmlLength 
      ? html.substring(0, maxHtmlLength) + '\n<!-- HTML truncated for analysis -->'
      : html;

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

    // Initialize Supabase client and save results
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
        method: 'ai-powered'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Audit function error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
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
