export interface RiskScore {
  score: number;
  band: string;
  color: string;
  summary: string;
}

const IMPACT_WEIGHTS: Record<string, number> = {
  critical: 15,
  serious: 8,
  moderate: 4,
  minor: 1,
};

export const calculateRiskScore = (violations: any[] = []): RiskScore => {
  const penalty = violations.reduce((total, v) => {
    const impact = String(v?.impact || "moderate").toLowerCase();
    return total + (IMPACT_WEIGHTS[impact] ?? 4);
  }, 0);

  const score = Math.max(0, Math.round(100 - penalty));

  if (score >= 80) {
    return {
      score,
      band: "Low risk",
      color: "#22C55E",
      summary:
        "Your page code shows few accessibility problems, so a full WCAG 2.1 AA audit would mostly confirm and fine-tune what you already have.",
    };
  }
  if (score >= 60) {
    return {
      score,
      band: "Moderate risk",
      color: "#FA9C05",
      summary:
        "We found a meaningful number of code-level accessibility issues that real users would notice and that a full audit should resolve.",
    };
  }
  if (score >= 40) {
    return {
      score,
      band: "Elevated risk",
      color: "#FF910A",
      summary:
        "Your page has significant accessibility gaps in its markup, which commonly translate into real barriers and legal exposure.",
    };
  }
  return {
    score,
    band: "High risk",
    color: "#D20000",
    summary:
      "Your page shows serious, widespread accessibility problems in its code and should be reviewed by a specialist as a priority.",
  };
};

export const CHECKED_NOW = [
  "Image alt text",
  "Form labels and inputs",
  "Heading structure",
  "ARIA landmarks and roles",
  "Link and button text",
  "Page language and document structure",
];

export const NEEDS_HUMAN = [
  "Color contrast ratios",
  "Keyboard navigation and focus order",
  "Screen reader behavior",
  "Video captions and audio descriptions",
  "Dynamic content and interactive widgets",
];

export const SCOPE_NOTE =
  "This screening reads your page's code. A full WCAG 2.1 AA audit tests your site the way a real user with a disability would experience it.";
