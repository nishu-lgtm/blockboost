// Shared client-safe types for the Content Briefs feature.

export interface BriefFaq {
  question: string;
  answer: string;
}

export interface BriefContent {
  contentType: string;               // e.g. "FAQ page", "Blog post", "Landing page"
  directAnswer: string;              // ≤50 words, starts with direct answer
  headings: string[];                // 5-7 question-format H2s
  faqs: BriefFaq[];                  // 8-10 Q&A pairs
  schemaType: string;                // e.g. "FAQPage", "Article"
  targetWordCount: number;
  keywords: string[];
  eeatRecommendations: string[];     // E-E-A-T signals to include
  internalLinkingSuggestions: string[];
  competitorGaps: string[];          // What competitors cover that you should too
}

export interface BriefQualityScore {
  total: number;           // 0-100
  breakdown: {
    directAnswer: number;  // Is direct answer ≤50w and question-starting?
    headings: number;      // Are headings question-phrased?
    faqCoverage: number;   // Enough Q&A pairs?
    keywords: number;      // Keywords provided?
    eeat: number;          // E-E-A-T recommendations present?
  };
}

export interface BriefRow {
  id: string;
  projectId: string;
  promptText: string;
  topic: string;
  status: "PENDING" | "GENERATED" | "PUBLISHED";
  briefContent: BriefContent | null;
  schemaMarkup: string | null;
  qualityScore: BriefQualityScore | null;
  createdAt: string;
  wordCountEstimate: number | null;
}

// Prompt gap = prompt where you don't appear but competitors do
export interface PromptGapRow {
  promptId: string;
  promptText: string;
  category: string;
  platformsMissing: string[];        // platforms where brand not mentioned
  competitorsAppearing: string[];    // competitor names that appeared
  priorityScore: number;             // higher = more urgent
  hasBrief: boolean;
  briefId: string | null;
}
