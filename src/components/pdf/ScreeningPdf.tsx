import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { calculateRiskScore, CHECKED_NOW, NEEDS_HUMAN, SCOPE_NOTE } from "@/utils/riskScore";

export interface ScreeningPdfProps {
  url: string;
  userName: string;
  timestamp: string;
  violations: any[];
  passes: any[];
}

const BRAND_START = "#FA9C05";
const BRAND_END = "#FF910A";

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 64,
    paddingHorizontal: 0,
    fontSize: 10,
    color: "#000000",
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  body: { paddingHorizontal: 36, paddingTop: 18 },
  headerBand: { height: 84, position: "relative", marginBottom: 4 },
  gradientStrip: { position: "absolute", top: 0, bottom: 0, width: "3%" },
  headerContent: { padding: 20 },
  brand: { color: "#FFFFFF", fontSize: 18, fontFamily: "Helvetica-Bold" },
  headerTitle: { color: "#FFFFFF", fontSize: 13, marginTop: 6 },
  metaRow: { marginBottom: 4, fontSize: 10, color: "#333333" },
  metaLabel: { fontFamily: "Helvetica-Bold" },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: BRAND_START,
    marginTop: 18,
    marginBottom: 8,
  },
  scoreBox: {
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 6,
    alignItems: "center",
  },
  scoreNumber: { fontSize: 54, fontFamily: "Helvetica-Bold" },
  scoreBand: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
  scoreSummary: { fontSize: 10, marginTop: 8, textAlign: "center", color: "#333333" },
  twoCol: { flexDirection: "row", gap: 18 },
  col: { flex: 1 },
  colTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  bullet: { fontSize: 9, marginBottom: 2, color: "#333333" },
  note: { fontSize: 9, marginTop: 8, color: "#555555" },
  impactHeading: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4 },
  violation: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#DDDDDD",
  },
  violationTitle: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  violationText: { fontSize: 9, color: "#333333", marginTop: 2 },
  passItem: { fontSize: 9, color: "#22C55E", marginBottom: 2 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    paddingTop: 6,
  },
  footerText: { fontSize: 8, color: "#555555" },
  footerCta: { fontSize: 8, color: BRAND_START, marginTop: 2, fontFamily: "Helvetica-Bold" },
});

const hexToRgb = (hex: string) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const gradientStrips = (count: number) => {
  const from = hexToRgb(BRAND_START);
  const to = hexToRgb(BRAND_END);
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const [r, g, b] = from.map((c, idx) => Math.round(c + (to[idx] - c) * t));
    return `rgb(${r}, ${g}, ${b})`;
  });
};

const STRIPS = gradientStrips(40);

const IMPACT_ORDER: { key: string; label: string; color: string }[] = [
  { key: "critical", label: "Critical", color: "#D20000" },
  { key: "serious", label: "Serious", color: "#FF910A" },
  { key: "moderate", label: "Moderate", color: "#FA9C05" },
  { key: "minor", label: "Minor", color: "#555555" },
];

const Footer = () => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>
      {"{web}TECH Consulting | Tulsa, OK | webtech.consulting"}
    </Text>
    <Text style={styles.footerCta}>
      Ready for a full WCAG 2.1 AA audit? Reply to this report or visit webtech.consulting
    </Text>
  </View>
);

const ScreeningPdf = ({ url, userName, timestamp, violations, passes }: ScreeningPdfProps) => {
  const risk = calculateRiskScore(violations);
  const grouped = IMPACT_ORDER.map((impact) => ({
    ...impact,
    items: violations.filter(
      (v) => String(v?.impact || "moderate").toLowerCase() === impact.key
    ),
  })).filter((g) => g.items.length > 0);

  const other = violations.filter(
    (v) => !IMPACT_ORDER.some((i) => i.key === String(v?.impact || "moderate").toLowerCase())
  );

  return (
    <Document title={`ADA Risk Screening - ${url}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBand} fixed={false}>
          {STRIPS.map((color, i) => (
            <View
              key={i}
              style={[styles.gradientStrip, { left: `${(i * 100) / STRIPS.length}%`, backgroundColor: color }]}
            />
          ))}
          <View style={styles.headerContent}>
            <Text style={styles.brand}>{"{web}TECH"}</Text>
            <Text style={styles.headerTitle}>ADA Risk Screening Report</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.metaRow}>
            <Text style={styles.metaLabel}>Scanned URL: </Text>
            {url}
          </Text>
          <Text style={styles.metaRow}>
            <Text style={styles.metaLabel}>Prepared for: </Text>
            {userName}
          </Text>
          <Text style={styles.metaRow}>
            <Text style={styles.metaLabel}>Scan date: </Text>
            {new Date(timestamp).toLocaleString()}
          </Text>

          <View style={styles.scoreBox}>
            <Text style={[styles.scoreNumber, { color: risk.color }]}>{risk.score}</Text>
            <Text style={[styles.scoreBand, { color: risk.color }]}>{risk.band}</Text>
            <Text style={styles.scoreSummary}>{risk.summary}</Text>
            <Text style={styles.scoreSummary}>
              {violations.length} issues found | {passes.length} checks passed
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Scope of this screening</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.colTitle}>What we check now</Text>
              {CHECKED_NOW.map((item) => (
                <Text key={item} style={styles.bullet}>{`- ${item}`}</Text>
              ))}
            </View>
            <View style={styles.col}>
              <Text style={styles.colTitle}>What needs a human review</Text>
              {NEEDS_HUMAN.map((item) => (
                <Text key={item} style={styles.bullet}>{`- ${item}`}</Text>
              ))}
            </View>
          </View>
          <Text style={styles.note}>{SCOPE_NOTE}</Text>

          <Text style={styles.sectionTitle}>Issues found ({violations.length})</Text>
          {violations.length === 0 && (
            <Text style={styles.violationText}>
              No code-level issues were detected in the checks above.
            </Text>
          )}
          {grouped.map((group) => (
            <View key={group.key}>
              <Text style={[styles.impactHeading, { color: group.color }]}>
                {group.label} ({group.items.length})
              </Text>
              {group.items.map((v, i) => (
                <View key={i} style={[styles.violation, { borderLeftColor: group.color }]} wrap={false}>
                  <Text style={styles.violationTitle}>{v.id || v.help || "Accessibility issue"}</Text>
                  <Text style={styles.violationText}>{v.description || v.help || ""}</Text>
                  <Text style={styles.violationText}>
                    {`Where it was found: ${
                      v.nodes?.[0]?.html ||
                      v.nodes?.[0]?.target?.join(", ") ||
                      `${v.nodes?.length || 0} element(s) on the page`
                    }`.slice(0, 300)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
          {other.length > 0 && (
            <View>
              <Text style={[styles.impactHeading, { color: "#555555" }]}>
                Other ({other.length})
              </Text>
              {other.map((v, i) => (
                <View key={i} style={styles.violation} wrap={false}>
                  <Text style={styles.violationTitle}>{v.id || v.help || "Accessibility issue"}</Text>
                  <Text style={styles.violationText}>{v.description || v.help || ""}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Passed checks ({passes.length})</Text>
          {passes.map((p, i) => (
            <Text key={i} style={styles.passItem}>
              {`- ${p.description || p.help || p.id || "Check passed"}`}
            </Text>
          ))}
        </View>

        <Footer />
      </Page>
    </Document>
  );
};

export default ScreeningPdf;
