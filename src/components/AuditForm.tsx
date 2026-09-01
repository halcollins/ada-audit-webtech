import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import PrivacyNotice from "@/components/PrivacyNotice";

interface AuditFormProps {
  onSubmit: (data: { name: string; email: string; url: string }) => void;
  isLoading: boolean;
}

const AuditForm = ({ onSubmit, isLoading }: AuditFormProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    url: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const started = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Full name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.url.trim()) {
      newErrors.url = "Website URL is required";
    } else if (!/^https?:\/\/.+\..+/.test(formData.url)) {
      newErrors.url = "Please enter a valid URL (include http:// or https://)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const isFormValid = formData.name.trim() && 
                     formData.email.trim() && 
                     formData.url.trim() && 
                     /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
                     /^https?:\/\/.+\..+/.test(formData.url);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card className="card-webtech">
          <CardHeader>
            <CardTitle className="text-2xl text-center" style={{ color: '#FFFFFF' }}>
              Start Your Free ADA Risk Screening
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              All fields are required to generate your accessibility report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground font-medium">
                  Full Name *
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={`input-webtech ${errors.name ? "border-destructive" : ""}`}
                  placeholder="Enter your full name"
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={`input-webtech ${errors.email ? "border-destructive" : ""}`}
                  placeholder="Enter your email address"
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="url" className="text-foreground font-medium">
                  Website URL *
                </Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => handleInputChange("url", e.target.value)}
                  className={`input-webtech ${errors.url ? "border-destructive" : ""}`}
                  placeholder="https://example.com"
                  disabled={isLoading}
                />
                {errors.url && (
                  <p className="text-sm text-destructive">{errors.url}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={!isFormValid || isLoading}
                className="w-full btn-webtech-primary h-12 text-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Running ADA Audit... {elapsed}s
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-5 w-5" />
                    Run ADA Audit
                  </>
                )}
              </Button>
            </form>

            {isLoading && (
              <div className="mt-4 space-y-2" aria-live="polite">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-1000 ease-linear"
                    style={{ width: `${Math.min((elapsed / 45) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  {elapsed < 10
                    ? "Fetching your page HTML..."
                    : elapsed < 30
                      ? "Analyzing markup against WCAG 2.1 AA criteria..."
                      : "Finishing up \u2014 this can take up to 45 seconds."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <PrivacyNotice />
      </div>
    </section>
  );
};

export default AuditForm;