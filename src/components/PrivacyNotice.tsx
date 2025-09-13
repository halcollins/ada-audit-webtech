import { Card, CardContent } from "@/components/ui/card";
import { Shield, Clock, Trash2, Mail } from "lucide-react";

const PrivacyNotice = () => {
  return (
    <Card className="card-webtech mt-6">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              Your Privacy & Data Security
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p>
                  <span className="font-medium text-foreground">Data Retention:</span> Your submission data is automatically deleted after 30 days.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p>
                  <span className="font-medium text-foreground">Data Use:</span> We collect your contact information solely to provide audit results and follow up with ADA compliance services.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Trash2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p>
                  <span className="font-medium text-foreground">Data Deletion:</span> Contact us anytime to request immediate data deletion:{" "}
                  <a 
                    href="mailto:support@webtechconsulting.com?subject=Data%20Deletion%20Request" 
                    className="text-primary hover:text-primary/80 underline"
                  >
                    support@webtechconsulting.com
                  </a>
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p>
                  <span className="font-medium text-foreground">No Sharing:</span> Your information is never shared with third parties or used for marketing without consent.
                </p>
              </div>
            </div>
            <p className="text-xs mt-3 pt-2 border-t border-border">
              By submitting this form, you consent to the collection and processing of your data as described above.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrivacyNotice;