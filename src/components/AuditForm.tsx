import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";

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
              Start Your Free ADA Audit
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
                    Running ADA Audit...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-5 w-5" />
                    Run ADA Audit
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default AuditForm;