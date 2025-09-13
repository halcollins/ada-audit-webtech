import { supabase } from "@/integrations/supabase/client";

export interface AnalyticsEvent {
  event_type: 'attempt' | 'success' | 'failure';
  url?: string;
  error_type?: string;
  user_agent?: string;
  referrer?: string;
}

export const trackAuditEvent = async (event: AnalyticsEvent) => {
  try {
    // Get user agent and referrer from browser
    const eventData = {
      ...event,
      user_agent: event.user_agent || navigator.userAgent,
      referrer: event.referrer || document.referrer || undefined,
    };

    const { error } = await supabase
      .from('audit_analytics')
      .insert(eventData);

    if (error) {
      console.warn('Failed to track analytics event:', error);
    }
  } catch (error) {
    console.warn('Analytics tracking error:', error);
  }
};

// Helper functions for common events
export const trackAuditAttempt = (url: string) => {
  trackAuditEvent({
    event_type: 'attempt',
    url: url,
  });
};

export const trackAuditSuccess = (url: string, violationsCount: number, passesCount: number) => {
  trackAuditEvent({
    event_type: 'success',
    url: url,
  });
};

export const trackAuditFailure = (url: string, errorType: string) => {
  trackAuditEvent({
    event_type: 'failure',
    url: url,
    error_type: errorType,
  });
};