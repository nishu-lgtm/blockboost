/**
 * ReportPDF — 8-page AI visibility PDF report built with @react-pdf/renderer.
 * This file runs server-side only (renderToBuffer). Never import in client components.
 */

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type {
  ReportData,
  ReportPlatformStat,
  ReportWin,
  ReportGap,
  ReportCompetitor,
  ReportActionItem,
} from "@/lib/report-compiler";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const INDIGO = "#4F46E5";
const INDIGO_DARK = "#3730A3";
const INDIGO_LIGHT = "#EEF2FF";
const INDIGO_MID = "#818CF8";
const GREEN = "#16A34A";
const GREEN_LIGHT = "#DCFCE7";
const RED = "#DC2626";
const RED_LIGHT = "#FEE2E2";
const YELLOW = "#D97706";
const YELLOW_LIGHT = "#FEF3C7";
const GRAY_50 = "#F8FAFC";
const GRAY_100 = "#F1F5F9";
const GRAY_200 = "#E2E8F0";
const GRAY_400 = "#94A3B8";
const GRAY_500 = "#64748B";
const GRAY_700 = "#334155";
const GRAY_900 = "#0F172A";
const WHITE = "#FFFFFF";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  // Pages
  page: {
    fontFamily: "Helvetica",
    backgroundColor: WHITE,
    paddingBottom: 48,
  },
  pageBody: {
    paddingHorizontal: 48,
    paddingTop: 40,
  },

  // Cover
  coverHeader: {
    height: 120,
    backgroundColor: INDIGO,
    paddingHorizontal: 48,
    paddingTop: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coverLogoText: { color: WHITE, fontSize: 22, fontFamily: "Helvetica-Bold" },
  coverHeaderRight: { color: "#C7D2FE", fontSize: 10 },
  coverBody: { paddingHorizontal: 48, paddingTop: 64, paddingBottom: 48 },
  coverBadge: {
    backgroundColor: INDIGO_LIGHT,
    color: INDIGO,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  coverTitle: {
    fontSize: 40,
    fontFamily: "Helvetica-Bold",
    color: GRAY_900,
    lineHeight: 1.2,
    marginBottom: 16,
  },
  coverBrand: {
    fontSize: 18,
    color: INDIGO,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  coverPeriod: { fontSize: 13, color: GRAY_500, marginBottom: 4 },
  coverGenerated: { fontSize: 11, color: GRAY_400 },
  coverDivider: {
    borderTopWidth: 1,
    borderTopColor: GRAY_200,
    marginTop: 40,
    marginBottom: 20,
  },
  coverFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverFooterLeft: { fontSize: 10, color: GRAY_400 },
  coverWatermark: {
    fontSize: 9,
    color: GRAY_400,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  coverMetricRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 40,
  },
  coverMetricCard: {
    flex: 1,
    backgroundColor: GRAY_50,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: GRAY_200,
  },
  coverMetricLabel: { fontSize: 9, color: GRAY_400, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  coverMetricValue: { fontSize: 28, fontFamily: "Helvetica-Bold", color: INDIGO },
  coverMetricSub: { fontSize: 10, color: GRAY_500, marginTop: 4 },

  // Shared layout
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: GRAY_400,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: GRAY_900,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: GRAY_500,
    lineHeight: 1.5,
    marginBottom: 24,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: GRAY_200,
    marginVertical: 20,
  },

  // Page header strip
  pageStrip: {
    height: 6,
    backgroundColor: INDIGO,
  },
  pageHeader: {
    paddingHorizontal: 48,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_200,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageHeaderTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: GRAY_700 },
  pageHeaderBrand: { fontSize: 10, color: GRAY_400 },

  // Page footer
  pageFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: GRAY_200,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageFooterText: { fontSize: 9, color: GRAY_400 },

  // Metric cards
  metricGrid: { flexDirection: "row", gap: 12, marginBottom: 24 },
  metricCard: {
    flex: 1,
    backgroundColor: GRAY_50,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: GRAY_200,
  },
  metricCardLabel: { fontSize: 9, color: GRAY_400, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  metricCardValue: { fontSize: 24, fontFamily: "Helvetica-Bold", color: INDIGO, marginBottom: 2 },
  metricCardSub: { fontSize: 10, color: GRAY_500 },
  metricCardBadge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 4,
  },

  // Narrative box
  narrativeBox: {
    backgroundColor: INDIGO_LIGHT,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  narrativeText: { fontSize: 11, color: GRAY_700, lineHeight: 1.6 },

  // Platform table
  table: { width: "100%" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: GRAY_100,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_100,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: GRAY_50,
  },
  tableCell: { fontSize: 10, color: GRAY_700 },
  tableCellBold: { fontSize: 10, fontFamily: "Helvetica-Bold", color: GRAY_900 },
  tableHeaderCell: { fontSize: 9, fontFamily: "Helvetica-Bold", color: GRAY_400, textTransform: "uppercase", letterSpacing: 0.7 },

  // Progress bar
  barBg: { backgroundColor: GRAY_200, borderRadius: 3, height: 6 },
  barFill: { backgroundColor: INDIGO, borderRadius: 3, height: 6 },

  // Wins / Gaps
  winCard: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: GREEN,
  },
  winTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: GRAY_900, marginBottom: 3 },
  winMeta: { fontSize: 9, color: GRAY_500 },
  gapCard: {
    backgroundColor: RED_LIGHT,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: RED,
  },
  gapTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: GRAY_900, marginBottom: 3 },
  gapMeta: { fontSize: 9, color: GRAY_500 },
  gapBadgeHigh: {
    backgroundColor: RED_LIGHT,
    color: RED,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  gapBadgeMed: {
    backgroundColor: YELLOW_LIGHT,
    color: YELLOW,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 4,
  },

  // Competitor
  competitorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_100,
  },
  competitorName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: GRAY_900, width: 120 },
  competitorBar: { flex: 1, paddingHorizontal: 12 },
  competitorRate: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INDIGO, width: 40, textAlign: "right" },
  competitorDiff: { fontSize: 10, width: 48, textAlign: "right" },

  // Action items
  actionCard: {
    backgroundColor: GRAY_50,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: GRAY_200,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  actionNumber: {
    width: 28,
    height: 28,
    backgroundColor: INDIGO,
    borderRadius: 14,
    color: WHITE,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: 28,
  },
  actionBody: { flex: 1 },
  actionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: GRAY_900, marginBottom: 4 },
  actionDetail: { fontSize: 10, color: GRAY_500, lineHeight: 1.5, marginBottom: 6 },
  actionBadgeRow: { flexDirection: "row", gap: 6 },
  impactBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },

  // Citation
  citationRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_100,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  citationUrl: { fontSize: 9, color: INDIGO, flex: 1 },
  citationCount: { fontSize: 9, fontFamily: "Helvetica-Bold", color: GRAY_700, width: 24, textAlign: "right" },

  // Two-col layout
  twoCol: { flexDirection: "row", gap: 20 },
  col: { flex: 1 },
  colHeader: { fontSize: 10, fontFamily: "Helvetica-Bold", color: GRAY_700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.7 },

  // Sentiment dots
  sentimentRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  sentDot: { width: 8, height: 8, borderRadius: 4 },
  sentLabel: { fontSize: 8, color: GRAY_500 },
});

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function PageStrip() {
  return <View style={S.pageStrip} />;
}

function PageHeader({ title, brand }: { title: string; brand: string }) {
  return (
    <View style={S.pageHeader}>
      <Text style={S.pageHeaderTitle}>{title}</Text>
      <Text style={S.pageHeaderBrand}>{brand} · AI Visibility Report</Text>
    </View>
  );
}

function PageFooter({ page, total, period }: { page: number; total: number; period: string }) {
  return (
    <View style={S.pageFooter} fixed>
      <Text style={S.pageFooterText}>BlockBoost · Confidential</Text>
      <Text style={S.pageFooterText}>{period}</Text>
      <Text style={S.pageFooterText}>
        {page} / {total}
      </Text>
    </View>
  );
}

function TrendBadge({ change }: { change: number }) {
  const isPos = change > 0;
  const isNeg = change < 0;
  const bg = isPos ? GREEN_LIGHT : isNeg ? RED_LIGHT : GRAY_100;
  const color = isPos ? GREEN : isNeg ? RED : GRAY_400;
  const label = change === 0 ? "→ No change" : `${isPos ? "↑ +" : "↓ "}${change}pp`;
  return (
    <Text style={[S.metricCardBadge, { backgroundColor: bg, color }]}>{label}</Text>
  );
}

function Bar({ pct, color = INDIGO }: { pct: number; color?: string }) {
  const w = Math.max(1, Math.min(100, pct));
  return (
    <View style={S.barBg}>
      <View style={[S.barFill, { width: `${w}%`, backgroundColor: color }]} />
    </View>
  );
}

function SectionHeader({ label, title, subtitle }: { label: string; title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={S.sectionLabel}>{label}</Text>
      <Text style={S.sectionTitle}>{title}</Text>
      {subtitle && <Text style={S.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function ImpactBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <Text style={[S.impactBadge, { color, backgroundColor: bg }]}>{label}</Text>;
}

// ---------------------------------------------------------------------------
// PAGE 1 — Cover
// ---------------------------------------------------------------------------

function CoverPage({ data }: { data: ReportData }) {
  const es = data.executiveSummary;
  return (
    <Page size="A4" style={S.page}>
      {/* Indigo header bar */}
      <View style={S.coverHeader}>
        <Text style={S.coverLogoText}>BlockBoost</Text>
        <Text style={S.coverHeaderRight}>AI Visibility Intelligence Platform</Text>
      </View>

      <View style={S.coverBody}>
        <Text style={S.coverBadge}>AI Visibility Report</Text>
        <Text style={S.coverTitle}>AI Visibility Report</Text>
        <Text style={S.coverBrand}>{data.project.brandName}</Text>
        <Text style={S.coverPeriod}>{data.period.label}</Text>
        <Text style={S.coverGenerated}>Generated {data.generatedAt}</Text>

        {/* Key metrics snapshot */}
        <View style={S.coverMetricRow}>
          <View style={S.coverMetricCard}>
            <Text style={S.coverMetricLabel}>Mention Rate</Text>
            <Text style={S.coverMetricValue}>{es.overallMentionRate}%</Text>
            <Text style={S.coverMetricSub}>
              {es.hasPriorPeriod
                ? `${es.mentionRateChange >= 0 ? "↑" : "↓"} ${Math.abs(es.mentionRateChange)}pp vs prior`
                : "Baseline"}
            </Text>
          </View>
          <View style={S.coverMetricCard}>
            <Text style={S.coverMetricLabel}>Share of Voice</Text>
            <Text style={S.coverMetricValue}>{es.shareOfVoice}%</Text>
            <Text style={S.coverMetricSub}>
              {es.hasPriorPeriod
                ? `${es.shareOfVoiceChange >= 0 ? "↑" : "↓"} ${Math.abs(es.shareOfVoiceChange)}pp vs prior`
                : "Baseline"}
            </Text>
          </View>
          <View style={S.coverMetricCard}>
            <Text style={S.coverMetricLabel}>Citations Found</Text>
            <Text style={S.coverMetricValue}>{es.totalCitationsFound}</Text>
            <Text style={S.coverMetricSub}>{es.ownedCitationRate}% owned pages</Text>
          </View>
          <View style={S.coverMetricCard}>
            <Text style={S.coverMetricLabel}>Prompts Tracked</Text>
            <Text style={S.coverMetricValue}>{es.totalPromptsTracked}</Text>
            <Text style={S.coverMetricSub}>{es.platformsTracked.length} platforms</Text>
          </View>
        </View>

        <View style={S.coverDivider} />
        <View style={S.coverFooter}>
          <Text style={S.coverFooterLeft}>{data.project.websiteUrl}</Text>
          <Text style={S.coverWatermark}>Powered by BlockBoost</Text>
        </View>
      </View>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// PAGE 2 — Executive Summary
// ---------------------------------------------------------------------------

function ExecutiveSummaryPage({ data }: { data: ReportData }) {
  const es = data.executiveSummary;
  return (
    <Page size="A4" style={S.page}>
      <PageStrip />
      <PageHeader title="Executive Summary" brand={data.project.brandName} />
      <View style={S.pageBody}>
        <SectionHeader
          label="Overview"
          title="How you performed this period"
          subtitle={`${data.period.label} · ${es.totalPromptsTracked} prompts across ${es.platformsTracked.length} platforms`}
        />

        {/* 2×2 metric grid */}
        <View style={S.metricGrid}>
          <View style={S.metricCard}>
            <Text style={S.metricCardLabel}>Overall Mention Rate</Text>
            <Text style={S.metricCardValue}>{es.overallMentionRate}%</Text>
            <TrendBadge change={es.mentionRateChange} />
          </View>
          <View style={S.metricCard}>
            <Text style={S.metricCardLabel}>Share of Voice</Text>
            <Text style={S.metricCardValue}>{es.shareOfVoice}%</Text>
            <TrendBadge change={es.shareOfVoiceChange} />
          </View>
        </View>
        <View style={S.metricGrid}>
          <View style={S.metricCard}>
            <Text style={S.metricCardLabel}>Best Platform</Text>
            <Text style={S.metricCardValue}>{es.topPlatform}</Text>
            <Text style={S.metricCardSub}>Highest mention rate</Text>
          </View>
          <View style={S.metricCard}>
            <Text style={S.metricCardLabel}>Citations Found</Text>
            <Text style={S.metricCardValue}>{es.totalCitationsFound}</Text>
            <Text style={S.metricCardSub}>{es.ownedCitationRate}% owned pages</Text>
          </View>
        </View>

        {/* Narrative */}
        <View style={S.narrativeBox}>
          <Text style={[S.sectionLabel, { color: INDIGO, marginBottom: 8 }]}>AI-Generated Insight</Text>
          <Text style={S.narrativeText}>{es.narrative}</Text>
        </View>

        {/* Audit score */}
        {data.auditScore !== null && (
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
            <View style={[S.metricCard, { flex: 0, minWidth: 120 }]}>
              <Text style={S.metricCardLabel}>AI Audit Score</Text>
              <Text style={S.metricCardValue}>{data.auditScore}/100</Text>
              {data.auditScoreChange !== null && <TrendBadge change={data.auditScoreChange} />}
            </View>
            <View style={[S.metricCard, { flex: 1 }]}>
              <Text style={S.metricCardLabel}>Content Briefs</Text>
              <Text style={S.metricCardValue}>{data.contentBriefsGenerated}</Text>
              <Text style={S.metricCardSub}>{data.contentBriefsPending} pending generation</Text>
            </View>
          </View>
        )}
      </View>
      <PageFooter page={2} total={8} period={data.period.label} />
    </Page>
  );
}

// ---------------------------------------------------------------------------
// PAGE 3 — Platform Performance
// ---------------------------------------------------------------------------

function PlatformPage({ data }: { data: ReportData }) {
  const platforms = data.platformBreakdown;
  return (
    <Page size="A4" style={S.page}>
      <PageStrip />
      <PageHeader title="Platform Performance" brand={data.project.brandName} />
      <View style={S.pageBody}>
        <SectionHeader
          label="Platform Breakdown"
          title="Mention rate by AI platform"
          subtitle="How often your brand appears when customers search on each platform"
        />

        {/* Table header */}
        <View style={S.tableHeader}>
          <Text style={[S.tableHeaderCell, { flex: 1.2 }]}>Platform</Text>
          <Text style={[S.tableHeaderCell, { flex: 2 }]}>Mention rate</Text>
          <Text style={[S.tableHeaderCell, { width: 48, textAlign: "right" }]}>Rate</Text>
          <Text style={[S.tableHeaderCell, { width: 52, textAlign: "right" }]}>Change</Text>
          <Text style={[S.tableHeaderCell, { width: 52, textAlign: "right" }]}>Citations</Text>
        </View>

        {platforms.map((p, i) => {
          const diff = p.mentionRateChange;
          const diffColor = diff > 0 ? GREEN : diff < 0 ? RED : GRAY_400;
          return (
            <View key={p.platform} style={[S.tableRow, i % 2 === 0 ? {} : S.tableRowAlt]}>
              <Text style={[S.tableCellBold, { flex: 1.2 }]}>{p.platform}</Text>
              <View style={[{ flex: 2 }]}>
                <Bar pct={p.mentionRate} />
              </View>
              <Text style={[S.tableCellBold, { width: 48, textAlign: "right", color: INDIGO }]}>{p.mentionRate}%</Text>
              <Text style={[S.tableCell, { width: 52, textAlign: "right", color: diffColor }]}>
                {diff === 0 ? "—" : diff > 0 ? `+${diff}pp` : `${diff}pp`}
              </Text>
              <Text style={[S.tableCell, { width: 52, textAlign: "right" }]}>{p.citationsFound}</Text>
            </View>
          );
        })}

        <View style={S.divider} />

        {/* Sentiment breakdown */}
        <Text style={[S.sectionLabel, { marginBottom: 12 }]}>Sentiment when mentioned</Text>
        {platforms
          .filter((p) => p.mentionRate > 0)
          .map((p) => {
            const total = p.sentiment.positive + p.sentiment.neutral + p.sentiment.negative;
            if (total === 0) return null;
            const posW = safePct(p.sentiment.positive, total);
            const neuW = safePct(p.sentiment.neutral, total);
            const negW = safePct(p.sentiment.negative, total);
            return (
              <View key={p.platform + "-s"} style={{ marginBottom: 12 }}>
                <Text style={[S.tableCell, { marginBottom: 4, fontFamily: "Helvetica-Bold" }]}>{p.platform}</Text>
                <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden" }}>
                  {posW > 0 && <View style={{ width: `${posW}%`, backgroundColor: GREEN }} />}
                  {neuW > 0 && <View style={{ width: `${neuW}%`, backgroundColor: GRAY_400 }} />}
                  {negW > 0 && <View style={{ width: `${negW}%`, backgroundColor: RED }} />}
                </View>
                <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
                  <Text style={[S.sentLabel, { color: GREEN }]}>Positive {posW}%</Text>
                  <Text style={[S.sentLabel, { color: GRAY_400 }]}>Neutral {neuW}%</Text>
                  <Text style={[S.sentLabel, { color: RED }]}>Negative {negW}%</Text>
                </View>
              </View>
            );
          })}
      </View>
      <PageFooter page={3} total={8} period={data.period.label} />
    </Page>
  );
}

function safePct(n: number, total: number) {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

// ---------------------------------------------------------------------------
// PAGE 4 — Wins & Gaps
// ---------------------------------------------------------------------------

function WinsGapsPage({ data }: { data: ReportData }) {
  const wins = data.topWins.slice(0, 5);
  const gaps = data.topGaps.slice(0, 5);
  return (
    <Page size="A4" style={S.page}>
      <PageStrip />
      <PageHeader title="Wins & Gaps" brand={data.project.brandName} />
      <View style={S.pageBody}>
        <SectionHeader
          label="Performance Analysis"
          title="Where you're winning — and where you're not"
          subtitle="Your top performing prompts vs. the highest-opportunity gaps"
        />

        <View style={S.twoCol}>
          {/* Wins column */}
          <View style={S.col}>
            <Text style={[S.colHeader, { color: GREEN }]}>✓ Top Wins</Text>
            {wins.length === 0 ? (
              <Text style={{ fontSize: 10, color: GRAY_400 }}>No wins recorded this period.</Text>
            ) : (
              wins.map((w, i) => (
                <View key={i} style={S.winCard}>
                  <Text style={S.winTitle}>{w.prompt}</Text>
                  <Text style={S.winMeta}>
                    {w.mentionRate}% mention rate · {w.platforms.join(", ")}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Gaps column */}
          <View style={S.col}>
            <Text style={[S.colHeader, { color: RED }]}>⚠ Top Gaps</Text>
            {gaps.length === 0 ? (
              <Text style={{ fontSize: 10, color: GRAY_400 }}>No gaps identified this period.</Text>
            ) : (
              gaps.map((g, i) => (
                <View key={i} style={S.gapCard}>
                  <Text style={g.priority === "high" ? S.gapBadgeHigh : S.gapBadgeMed}>
                    {g.priority === "high" ? "High Priority" : "Medium Priority"}
                  </Text>
                  <Text style={S.gapTitle}>{g.prompt}</Text>
                  <Text style={S.gapMeta}>
                    {g.competitorsAppearing.length > 0
                      ? `Competitors: ${g.competitorsAppearing.slice(0, 2).join(", ")}`
                      : "No brand mention detected"}
                    {g.gscImpressions ? ` · ${g.gscImpressions.toLocaleString()} impressions` : ""}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </View>
      <PageFooter page={4} total={8} period={data.period.label} />
    </Page>
  );
}

// ---------------------------------------------------------------------------
// PAGE 5 — Competitor Analysis
// ---------------------------------------------------------------------------

function CompetitorPage({ data }: { data: ReportData }) {
  const competitors = data.competitorComparison;
  const brandRate = data.executiveSummary.overallMentionRate;
  const maxRate = Math.max(brandRate, ...competitors.map((c) => c.mentionRate), 1);

  return (
    <Page size="A4" style={S.page}>
      <PageStrip />
      <PageHeader title="Competitor Analysis" brand={data.project.brandName} />
      <View style={S.pageBody}>
        <SectionHeader
          label="Competitive Landscape"
          title="How you compare to competitors"
          subtitle="AI mention rates across all tracked competitors this period"
        />

        {/* Brand row first */}
        <View style={[S.competitorRow, { backgroundColor: INDIGO_LIGHT, borderRadius: 8, paddingHorizontal: 10 }]}>
          <Text style={[S.competitorName, { color: INDIGO }]}>{data.project.brandName} (you)</Text>
          <View style={S.competitorBar}>
            <Bar pct={(brandRate / maxRate) * 100} color={INDIGO} />
          </View>
          <Text style={S.competitorRate}>{brandRate}%</Text>
          <Text style={[S.competitorDiff, { color: data.executiveSummary.mentionRateChange >= 0 ? GREEN : RED }]}>
            {data.executiveSummary.mentionRateChange >= 0 ? "+" : ""}{data.executiveSummary.mentionRateChange}pp
          </Text>
        </View>

        {competitors.length === 0 ? (
          <Text style={{ fontSize: 10, color: GRAY_400, marginTop: 20 }}>
            No competitor data available. Add competitors in your project settings to enable comparison.
          </Text>
        ) : (
          competitors.map((c, i) => {
            const diff = c.mentionRateChange;
            return (
              <View key={i} style={S.competitorRow}>
                <Text style={S.competitorName}>{c.brandName}</Text>
                <View style={S.competitorBar}>
                  <Bar pct={(c.mentionRate / maxRate) * 100} color={GRAY_400} />
                </View>
                <Text style={[S.competitorRate, { color: GRAY_700 }]}>{c.mentionRate}%</Text>
                <Text style={[S.competitorDiff, { color: diff > 0 ? RED : diff < 0 ? GREEN : GRAY_400 }]}>
                  {diff === 0 ? "—" : diff > 0 ? `+${diff}pp` : `${diff}pp`}
                </Text>
              </View>
            );
          })
        )}

        <View style={S.divider} />

        {/* Share of Voice summary */}
        <Text style={[S.sectionLabel, { marginBottom: 12 }]}>Share of Voice Breakdown</Text>
        <View style={S.metricGrid}>
          <View style={S.metricCard}>
            <Text style={S.metricCardLabel}>Your Share of Voice</Text>
            <Text style={S.metricCardValue}>{data.executiveSummary.shareOfVoice}%</Text>
            <TrendBadge change={data.executiveSummary.shareOfVoiceChange} />
          </View>
          <View style={S.metricCard}>
            <Text style={S.metricCardLabel}>Competitors tracked</Text>
            <Text style={S.metricCardValue}>{competitors.length}</Text>
            <Text style={S.metricCardSub}>across all platforms</Text>
          </View>
        </View>

        {/* Platform breakdown per competitor */}
        {competitors.length > 0 && (
          <>
            <Text style={[S.sectionLabel, { marginBottom: 8 }]}>Competitor Platform Presence</Text>
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderCell, { flex: 1.2 }]}>Competitor</Text>
              <Text style={[S.tableHeaderCell, { flex: 2 }]}>Top Platforms</Text>
            </View>
            {competitors.map((c, i) => (
              <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
                <Text style={[S.tableCellBold, { flex: 1.2 }]}>{c.brandName}</Text>
                <Text style={[S.tableCell, { flex: 2 }]}>{c.topPlatforms.join(", ") || "—"}</Text>
              </View>
            ))}
          </>
        )}
      </View>
      <PageFooter page={5} total={8} period={data.period.label} />
    </Page>
  );
}

// ---------------------------------------------------------------------------
// PAGE 6 — Action Roadmap
// ---------------------------------------------------------------------------

const IMPACT_STYLES: Record<string, { color: string; bg: string }> = {
  High: { color: RED, bg: RED_LIGHT },
  Medium: { color: YELLOW, bg: YELLOW_LIGHT },
  Low: { color: GREEN, bg: GREEN_LIGHT },
};
const EFFORT_STYLES: Record<string, { color: string; bg: string }> = {
  High: { color: GRAY_500, bg: GRAY_100 },
  Medium: { color: GRAY_500, bg: GRAY_100 },
  Low: { color: GREEN, bg: GREEN_LIGHT },
};

function ActionRoadmapPage({ data }: { data: ReportData }) {
  return (
    <Page size="A4" style={S.page}>
      <PageStrip />
      <PageHeader title="Action Roadmap" brand={data.project.brandName} />
      <View style={S.pageBody}>
        <SectionHeader
          label="Priority Actions"
          title="5 things to do this period"
          subtitle="AI-generated action plan based on your visibility data. Ordered by priority."
        />

        {data.actionRoadmap.map((item, i) => {
          const impact = IMPACT_STYLES[item.impact] ?? IMPACT_STYLES.Medium;
          const effort = EFFORT_STYLES[item.effort] ?? EFFORT_STYLES.Medium;
          return (
            <View key={i} style={S.actionCard}>
              <Text style={S.actionNumber}>{item.priority}</Text>
              <View style={S.actionBody}>
                <Text style={S.actionTitle}>{item.action}</Text>
                <Text style={S.actionDetail}>{item.detail}</Text>
                <View style={S.actionBadgeRow}>
                  <ImpactBadge label={`Impact: ${item.impact}`} color={impact.color} bg={impact.bg} />
                  <ImpactBadge label={`Effort: ${item.effort}`} color={effort.color} bg={effort.bg} />
                </View>
              </View>
            </View>
          );
        })}

        {data.actionRoadmap.length === 0 && (
          <Text style={{ fontSize: 11, color: GRAY_400 }}>
            Run a full scan to generate your personalized action roadmap.
          </Text>
        )}
      </View>
      <PageFooter page={6} total={8} period={data.period.label} />
    </Page>
  );
}

// ---------------------------------------------------------------------------
// PAGE 7 — Citation Analysis
// ---------------------------------------------------------------------------

function CitationPage({ data }: { data: ReportData }) {
  const ca = data.citationAnalysis;
  return (
    <Page size="A4" style={S.page}>
      <PageStrip />
      <PageHeader title="Citation Analysis" brand={data.project.brandName} />
      <View style={S.pageBody}>
        <SectionHeader
          label="Citations"
          title="Which pages AI cites for your brand"
          subtitle="AI platforms cite sources when they mention you. Here's what they're linking to."
        />

        {/* Summary metrics */}
        <View style={S.metricGrid}>
          <View style={S.metricCard}>
            <Text style={S.metricCardLabel}>New Citations</Text>
            <Text style={S.metricCardValue}>{ca.newCitationsThisPeriod}</Text>
            <Text style={S.metricCardSub}>
              {data.executiveSummary.hasPriorPeriod ? "vs prior period" : "in this period"}
            </Text>
          </View>
          <View style={S.metricCard}>
            <Text style={S.metricCardLabel}>Lost Citations</Text>
            <Text style={S.metricCardValue}>{ca.lostCitationsThisPeriod}</Text>
            <Text style={S.metricCardSub}>
              {data.executiveSummary.hasPriorPeriod ? "vs prior period" : "(needs prior period)"}
            </Text>
          </View>
          <View style={S.metricCard}>
            <Text style={S.metricCardLabel}>Owned Citation Rate</Text>
            <Text style={S.metricCardValue}>{data.executiveSummary.ownedCitationRate}%</Text>
            <Text style={S.metricCardSub}>your pages cited</Text>
          </View>
        </View>

        <View style={S.twoCol}>
          {/* Owned pages */}
          <View style={S.col}>
            <Text style={S.colHeader}>Your Pages Being Cited</Text>
            {ca.topOwnedPages.length === 0 ? (
              <Text style={{ fontSize: 10, color: GRAY_400 }}>
                No owned pages cited yet. Publishing optimized content will help.
              </Text>
            ) : (
              ca.topOwnedPages.slice(0, 8).map((p, i) => (
                <View key={i} style={S.citationRow}>
                  <Text style={S.citationUrl}>
                    {p.url.replace(/^https?:\/\//, "").slice(0, 38)}…
                  </Text>
                  <Text style={S.citationCount}>{p.citationCount}×</Text>
                </View>
              ))
            )}
          </View>

          {/* Third-party sources */}
          <View style={S.col}>
            <Text style={S.colHeader}>Top Third-Party Sources</Text>
            {ca.topThirdPartySources.length === 0 ? (
              <Text style={{ fontSize: 10, color: GRAY_400 }}>
                No third-party sources yet.
              </Text>
            ) : (
              ca.topThirdPartySources.slice(0, 8).map((s, i) => (
                <View key={i} style={S.citationRow}>
                  <Text style={[S.tableCell, { flex: 1 }]}>{s.domain}</Text>
                  <Text style={S.citationCount}>{s.citationCount}×</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Recommendations */}
        <View style={S.divider} />
        <Text style={[S.sectionLabel, { marginBottom: 10 }]}>Citation Recommendations</Text>
        {ca.topOwnedPages.length < 3 && (
          <View style={S.narrativeBox}>
            <Text style={S.narrativeText}>
              Your owned pages are under-represented in AI citations. Publish optimized content
              targeting your top-performing prompt categories to increase how often AI platforms
              link to your website directly.
            </Text>
          </View>
        )}
        {ca.lostCitationsThisPeriod > ca.newCitationsThisPeriod && (
          <View style={[S.narrativeBox, { backgroundColor: RED_LIGHT }]}>
            <Text style={[S.narrativeText, { color: GRAY_700 }]}>
              ⚠ You lost more citations ({ca.lostCitationsThisPeriod}) than you gained ({ca.newCitationsThisPeriod})
              this period. Review pages that were recently changed or removed.
            </Text>
          </View>
        )}
      </View>
      <PageFooter page={7} total={8} period={data.period.label} />
    </Page>
  );
}

// ---------------------------------------------------------------------------
// PAGE 8 — Next Steps & Branding
// ---------------------------------------------------------------------------

interface BrandingOptions {
  logoUrl?: string | null;
  primaryColor?: string;
  companyName?: string;
  tagline?: string;
  showWatermark?: boolean;
}

function NextStepsPage({
  data,
  branding,
}: {
  data: ReportData;
  branding: BrandingOptions;
}) {
  const company = branding.companyName ?? "BlockBoost";
  const tagline = branding.tagline ?? "AI Visibility Intelligence";
  const color = branding.primaryColor ?? INDIGO;
  const showWatermark = branding.showWatermark ?? true;

  return (
    <Page size="A4" style={S.page}>
      {/* Brand-colored header bar */}
      <View style={[S.pageStrip, { backgroundColor: color, height: 8 }]} />
      <PageHeader title="Next Steps" brand={data.project.brandName} />
      <View style={S.pageBody}>
        <SectionHeader
          label="Recommended Next Steps"
          title="Keep building your AI visibility"
          subtitle="Consistency is the key to AI search. Here's what to focus on next."
        />

        {/* Top priority action */}
        {data.actionRoadmap[0] && (
          <View style={[S.narrativeBox, { backgroundColor: INDIGO_LIGHT, marginBottom: 20 }]}>
            <Text style={[S.sectionLabel, { color: INDIGO, marginBottom: 6 }]}>
              #1 Priority This Period
            </Text>
            <Text style={[S.narrativeText, { fontSize: 13, fontFamily: "Helvetica-Bold", color: GRAY_900 }]}>
              {data.actionRoadmap[0].action}
            </Text>
            <Text style={[S.narrativeText, { marginTop: 6 }]}>{data.actionRoadmap[0].detail}</Text>
          </View>
        )}

        {/* Quick wins checklist */}
        <Text style={[S.sectionLabel, { marginBottom: 10 }]}>Quick Wins Checklist</Text>
        {[
          "Schedule your next scan in 7 days to track progress",
          "Share this report with your marketing team or agency",
          "Act on the #1 priority action above within 48 hours",
          data.topGaps[0]
            ? `Create content targeting: "${data.topGaps[0].prompt.slice(0, 60)}…"`
            : "Set up Content Briefs to target your highest-opportunity gaps",
          "Set up email alerts for any mention rate drops",
        ].map((item, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 3,
                borderWidth: 1.5,
                borderColor: color,
                marginTop: 1,
              }}
            />
            <Text style={{ fontSize: 11, color: GRAY_700, flex: 1, lineHeight: 1.5 }}>{item}</Text>
          </View>
        ))}

        <View style={S.divider} />

        {/* Report period summary */}
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={S.sectionLabel}>Report Period</Text>
            <Text style={{ fontSize: 11, color: GRAY_700 }}>{data.period.label}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.sectionLabel}>Generated</Text>
            <Text style={{ fontSize: 11, color: GRAY_700 }}>{data.generatedAt}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.sectionLabel}>Project</Text>
            <Text style={{ fontSize: 11, color: GRAY_700 }}>{data.project.name}</Text>
          </View>
        </View>

        <View style={S.divider} />

        {/* Branding footer */}
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: GRAY_900, marginBottom: 4 }}>
            {company}
          </Text>
          <Text style={{ fontSize: 11, color: GRAY_500 }}>{tagline}</Text>
          {showWatermark && (
            <Text style={{ fontSize: 9, color: GRAY_400, marginTop: 8 }}>
              Powered by BlockBoost · blockboost.co
            </Text>
          )}
        </View>
      </View>
      <PageFooter page={8} total={8} period={data.period.label} />
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Root document
// ---------------------------------------------------------------------------

interface ReportPDFProps {
  data: ReportData;
  branding?: BrandingOptions;
}

export function ReportPDF({ data, branding = {} }: ReportPDFProps) {
  return (
    <Document
      title={`AI Visibility Report — ${data.project.brandName} — ${data.period.label}`}
      author="BlockBoost"
      subject="AI Visibility Report"
      creator="BlockBoost Platform"
      producer="@react-pdf/renderer"
    >
      <CoverPage data={data} />
      <ExecutiveSummaryPage data={data} />
      <PlatformPage data={data} />
      <WinsGapsPage data={data} />
      <CompetitorPage data={data} />
      <ActionRoadmapPage data={data} />
      <CitationPage data={data} />
      <NextStepsPage data={data} branding={branding} />
    </Document>
  );
}
