import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, UserSearch } from "lucide-react";
import { CHECKED_NOW, NEEDS_HUMAN, SCOPE_NOTE } from "@/utils/riskScore";

const ScopeChecklist = () => {
  return (
    <section className="pt-12" aria-labelledby="what-this-checks">
      <div className="container mx-auto px-4 max-w-4xl">
        <h2 id="what-this-checks" className="sr-only">
          What this screening checks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="card-webtech">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                <Check className="h-5 w-5 text-primary" aria-hidden="true" />
                What we check now
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {CHECKED_NOW.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="card-webtech">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                <UserSearch className="h-5 w-5 text-primary" aria-hidden="true" />
                What needs a human review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {NEEDS_HUMAN.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <UserSearch className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <p className="mt-4 text-sm text-muted-foreground text-center">{SCOPE_NOTE}</p>
      </div>
    </section>
  );
};

export default ScopeChecklist;
