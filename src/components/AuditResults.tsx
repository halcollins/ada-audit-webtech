import { Suspense, lazy } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateRiskScore } from "@/utils/riskScore";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ExternalLink, 
  Mail,
  Calendar
} from "lucide-react";

const PdfDownload = lazy(() => import("@/components/pdf/PdfDownload"));

interface AuditResult {
  violations: any[];
  passes: any[];
  incomplete: any[];
  timestamp: string;
  url: string;
  userName: string;
}

interface AuditResultsProps {
  results: AuditResult;
}

const AuditResults = ({ results }: AuditResultsProps) => {
  const { violations, passes, incomplete, timestamp, url, userName } = results;

  const getSeverityColor = (impact: string) => {
    switch (impact) {
      case "critical":
        return "destructive";
      case "serious":
        return "destructive";
      case "moderate":
        return "default";
      case "minor":
        return "secondary";
      default:
        return "default";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const risk = calculateRiskScore(violations);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4" style={{ color: '#FFFFFF' }}>
            ADA Risk Screening Results for {userName}
          </h2>
          <p className="text-muted-foreground">
            Screening completed on {formatTimestamp(timestamp)} for{" "}
            <span className="text-primary font-medium">{url}</span>
          </p>
        </div>

        {/* Risk score */}
        <Card className="card-webtech mb-8">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="text-7xl md:text-8xl font-bold leading-none"
                style={{ color: risk.color }}
              >
                {risk.score}
              </div>
              <div className="text-2xl font-semibold" style={{ color: risk.color }}>
                {risk.band}
              </div>
              <p className="text-muted-foreground max-w-2xl">{risk.summary}</p>
              <Suspense
                fallback={
                  <Button className="btn-webtech-primary" disabled aria-disabled="true">
                    Preparing PDF…
                  </Button>
                }
              >
                <PdfDownload
                  url={url}
                  userName={userName}
                  timestamp={timestamp}
                  violations={violations}
                  passes={passes}
                />
              </Suspense>
            </div>
          </CardContent>
        </Card>

        {/* Scope disclaimer */}
        <Card className="card-webtech mb-8">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">About this report:</strong> This is an automated
              preliminary screen of the page's static HTML. It does not replace a full manual
              WCAG 2.1 AA audit. Checks that depend on rendered CSS and interaction — color
              contrast, focus visibility, keyboard order, and screen reader behavior — require a
              hands-on review.
            </p>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card className="card-webtech mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Screening Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="text-2xl font-bold text-destructive mb-2">
                  {violations.length}
                </div>
                <div className="text-sm text-muted-foreground">Violations Found</div>
              </div>
              <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="text-2xl font-bold text-primary mb-2">
                  {passes.length}
                </div>
                <div className="text-sm text-muted-foreground">Tests Passed</div>
              </div>
              <div className="text-center p-4 bg-secondary/10 rounded-lg border border-secondary/20">
                <div className="text-2xl font-bold text-secondary-foreground mb-2">
                  {incomplete.length}
                </div>
                <div className="text-sm text-muted-foreground">Needs Review</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Violations */}
        {violations.length > 0 && (
          <Card className="card-webtech mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                Accessibility Violations ({violations.length})
              </CardTitle>
              <CardDescription>
                Issues that need immediate attention to meet ADA compliance standards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {violations.slice(0, 10).map((violation, index) => (
                <div key={index} className="border border-border rounded-lg p-4 bg-card/50">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h4 className="font-semibold text-foreground">{violation.description}</h4>
                    <Badge variant={getSeverityColor(violation.impact)}>
                      {violation.impact || "unknown"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{violation.help}</p>
                  <div className="text-xs text-muted-foreground">
                    <strong>Elements affected:</strong> {violation.nodes?.length || 0}
                  </div>
                  {violation.helpUrl && (
                    <a
                      href={violation.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-sm mt-2"
                    >
                      Learn more <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
              {violations.length > 10 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Showing first 10 violations. Total violations: {violations.length}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Passes */}
        <Card className="card-webtech mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CheckCircle className="h-5 w-5" />
              Accessibility Tests Passed ({passes.length})
            </CardTitle>
            <CardDescription>
              Areas where your website meets accessibility standards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {passes.slice(0, 8).map((pass, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-primary/5 rounded border border-primary/10">
                  <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground">{pass.description}</span>
                </div>
              ))}
            </div>
            {passes.length > 8 && (
              <p className="text-sm text-muted-foreground mt-4">
                ... and {passes.length - 8} more tests passed
              </p>
            )}
          </CardContent>
        </Card>

        {/* Professional CTA */}
        <Card className="bg-gradient-accent text-primary-foreground border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Need Professional ADA Compliance?
            </CardTitle>
            <CardDescription className="text-center text-primary-foreground/80">
              This client-side audit provides a quick overview but may miss dynamic content and complex interactions.
              Get a comprehensive professional audit from WebTECH Consulting.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => window.open("mailto:hal@halcollins.com?subject=Professional ADA Audit Request&body=Hi Hal,%0A%0AI'm interested in a professional ADA accessibility audit for my website. I just completed the free audit tool and would like to discuss comprehensive accessibility solutions.%0A%0AWebsite: " + url + "%0A%0AThanks!")}
              >
                <Mail className="mr-2 h-4 w-4" />
                Email for Quote
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => window.open("mailto:hal@halcollins.com?subject=Professional ADA Audit - Consultation&body=Hi Hal,%0A%0AI'm interested in scheduling a consultation to discuss a professional ADA accessibility audit for my website. I just completed the free audit tool and would like to discuss comprehensive accessibility solutions.%0A%0AWebsite: " + url + "%0A%0AThanks!")}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Schedule Consultation
              </Button>
            </div>
            <p className="text-sm text-primary-foreground/70">
              Professional audits include manual testing, detailed remediation plans, and ongoing compliance support.
            </p>
          </CardContent>
        </Card>

        {/* Limitations Notice */}
        <Alert className="mt-8">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> This client-side audit may miss dynamic content, interactive elements, and server-side accessibility features. 
            For comprehensive ADA compliance, consider a professional audit that includes manual testing and detailed remediation guidance.
          </AlertDescription>
        </Alert>
      </div>
    </section>
  );
};

export default AuditResults;