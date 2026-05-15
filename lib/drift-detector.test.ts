/**
 * Tests for lib/drift-detector.ts — Sprint 11.
 * Rule 9: tests encode WHY. Drift powers the "what changed" card on the
 * Overview dashboard; false positives erode trust faster than misses.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDrift, type MentionLite, type Sentiment } from "./drift-detector";

function m(
  promptId: string,
  brandMentioned: boolean,
  opts: {
    promptText?: string;
    competitorsMentioned?: string[];
    sentiment?: Sentiment;
  } = {}
): MentionLite {
  return {
    promptId,
    promptText: opts.promptText ?? `Prompt ${promptId}`,
    brandMentioned,
    competitorsMentioned: opts.competitorsMentioned ?? [],
    sentiment: opts.sentiment ?? (brandMentioned ? "POSITIVE" : "NOT_MENTIONED"),
    createdAt: new Date(),
  };
}

test("detectDrift: empty windows → no changes (no crash, no phantom events)", () => {
  const report = detectDrift([], [], 7);
  assert.equal(report.totalChanges, 0);
  assert.equal(report.windowDays, 7);
});

test("detectDrift: new citation surfaced only when prompt existed in both windows", () => {
  // INTENT: a prompt that only appears in 'current' isn't a "new citation" —
  // it might just be a newly tracked query. Drift = change for the same prompt.
  const current = [m("p1", true), m("p2", true)];
  const previous = [m("p1", false)]; // p2 didn't exist last week
  const report = detectDrift(current, previous, 7);
  assert.equal(report.newCitations.length, 1);
  assert.equal(report.newCitations[0].promptId, "p1");
});

test("detectDrift: lost citation when previously cited, no longer cited", () => {
  // INTENT: this is the headline "you lost a citation" event marketers care about.
  const current = [m("p1", false)];
  const previous = [m("p1", true)];
  const report = detectDrift(current, previous, 7);
  assert.equal(report.lostCitations.length, 1);
  assert.equal(report.lostCitations[0].promptId, "p1");
});

test("detectDrift: new competitor entrant on a tracked prompt", () => {
  // INTENT: PR teams need to know when a competitor newly enters an AI answer.
  const current = [m("p1", true, { competitorsMentioned: ["Acme", "Beta"] })];
  const previous = [m("p1", true, { competitorsMentioned: ["Acme"] })];
  const report = detectDrift(current, previous, 7);
  assert.equal(report.newCompetitors.length, 1);
  assert.ok(report.newCompetitors[0].detail.includes("Beta"));
  assert.ok(!report.newCompetitors[0].detail.includes("Acme"));
});

test("detectDrift: returning competitor (unchanged set) does NOT trigger newCompetitor", () => {
  // INTENT: prevent false-positive "Acme entered" when Acme has been there all along.
  const current = [m("p1", true, { competitorsMentioned: ["Acme"] })];
  const previous = [m("p1", true, { competitorsMentioned: ["Acme"] })];
  const report = detectDrift(current, previous, 7);
  assert.equal(report.newCompetitors.length, 0);
});

test("detectDrift: sentiment regression flagged with direction='regressed'", () => {
  // INTENT: a POSITIVE → NEUTRAL flip is meaningful even if mention rate is flat.
  const current = [m("p1", true, { sentiment: "NEUTRAL" })];
  const previous = [m("p1", true, { sentiment: "POSITIVE" })];
  const report = detectDrift(current, previous, 7);
  assert.equal(report.sentimentShifts.length, 1);
  assert.equal(report.sentimentShifts[0].direction, "regressed");
  assert.equal(report.sentimentShifts[0].from, "POSITIVE");
  assert.equal(report.sentimentShifts[0].to, "NEUTRAL");
});

test("detectDrift: sentiment improvement flagged with direction='improved'", () => {
  const current = [m("p1", true, { sentiment: "POSITIVE" })];
  const previous = [m("p1", true, { sentiment: "NEUTRAL" })];
  const report = detectDrift(current, previous, 7);
  assert.equal(report.sentimentShifts.length, 1);
  assert.equal(report.sentimentShifts[0].direction, "improved");
});

test("detectDrift: sentiment shift NOT reported when brand wasn't cited in both windows", () => {
  // INTENT: if you weren't cited, sentiment defaulting to NOT_MENTIONED is already
  // covered by lostCitations / newCitations. Double-reporting is noise.
  const current = [m("p1", false, { sentiment: "NOT_MENTIONED" })];
  const previous = [m("p1", true, { sentiment: "POSITIVE" })];
  const report = detectDrift(current, previous, 7);
  assert.equal(report.lostCitations.length, 1);
  assert.equal(report.sentimentShifts.length, 0);
});

test("detectDrift: multiple runs in one window aggregated correctly", () => {
  // INTENT: daily scans produce multiple Mention rows per prompt per week.
  // Any successful run within the window counts the prompt as 'cited'.
  const current = [
    m("p1", false), // run 1: missed
    m("p1", true),  // run 2: hit
    m("p1", false), // run 3: missed
  ];
  const previous = [m("p1", false), m("p1", false)];
  const report = detectDrift(current, previous, 7);
  assert.equal(report.newCitations.length, 1, "≥1 cited run = 'cited' for the window");
});

test("detectDrift: totalChanges sums all categories", () => {
  const current = [
    m("p1", true), // new citation
    m("p2", true, { competitorsMentioned: ["X"], sentiment: "NEGATIVE" }), // new comp + sentiment regression
  ];
  const previous = [
    m("p1", false),
    m("p2", true, { competitorsMentioned: [], sentiment: "POSITIVE" }),
  ];
  const report = detectDrift(current, previous, 7);
  assert.equal(
    report.totalChanges,
    report.newCitations.length +
      report.lostCitations.length +
      report.newCompetitors.length +
      report.sentimentShifts.length
  );
  assert.ok(report.totalChanges >= 3);
});
