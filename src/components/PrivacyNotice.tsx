import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Shield, Clock, Trash2, Mail, ChevronDown } from "lucide-react";
import { useState } from "react";

const PrivacyNotice = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="card-webtech mt-6">
      <CardContent className="p-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex items-start gap-3 w-full text-left hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors">
            <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                Your Privacy & Data Security
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </h3>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="animate-accordion-down">
            <div className="ml-8 mt-2 space-y-2 text-sm text-muted-foreground">
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
                      href="mailto:hal@halcollins.com?subject=Data%20Deletion%20Request" 
                      className="text-primary hover:text-primary/80 underline"
                    >
                      Email Support
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
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default PrivacyNotice;