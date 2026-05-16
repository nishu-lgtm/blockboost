-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('CHATGPT', 'PERPLEXITY', 'GEMINI', 'COPILOT', 'GROK', 'GOOGLE_AI_OVERVIEWS');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NOT_MENTIONED');

-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('PENDING', 'GENERATED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('MENTION_RATE_DROP', 'NEW_CITATION', 'COMPETITOR_SURGE', 'HALLUCINATION_DETECTED', 'SCAN_COMPLETE');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WEEKLY', 'MONTHLY', 'CUSTOM', 'ONDEMAND');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('NONE', 'VIEWER', 'SUPPORT', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('REDDIT', 'QUORA', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "SocialOpportunityStatus" AS ENUM ('NEW', 'VIEWED', 'REPLIED', 'DISMISSED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "SocialReplyTone" AS ENUM ('HELPFUL', 'PROFESSIONAL', 'CASUAL');

-- CreateEnum
CREATE TYPE "QueryIntent" AS ENUM ('DISCOVERY', 'COMPARISON', 'COMMERCIAL', 'PROBLEM', 'RECOMMENDATION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gscAccessToken" TEXT,
    "gscRefreshToken" TEXT,
    "gscTokenExpiry" TIMESTAMP(3),
    "gscConnected" BOOLEAN NOT NULL DEFAULT false,
    "gscProperty" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "slackWebhookUrl" TEXT,
    "slackConnected" BOOLEAN NOT NULL DEFAULT false,
    "emailPrefWeeklyReport" BOOLEAN NOT NULL DEFAULT true,
    "emailPrefMonthlySummary" BOOLEAN NOT NULL DEFAULT true,
    "emailPrefFeatureNews" BOOLEAN NOT NULL DEFAULT true,
    "emailPrefAlerts" BOOLEAN NOT NULL DEFAULT true,
    "emailPrefTips" BOOLEAN NOT NULL DEFAULT true,
    "adminRole" "AdminRole" NOT NULL DEFAULT 'NONE',
    "adminBanned" BOOLEAN NOT NULL DEFAULT false,
    "adminBanReason" TEXT,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pauseUntil" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessCategory" TEXT,
    "city" TEXT,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intent" "QueryIntent",
    "gscImpressions" INTEGER,
    "gscClicks" INTEGER,
    "gscPosition" DOUBLE PRECISION,
    "gscLastSync" TIMESTAMP(3),

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "brandMentioned" BOOLEAN NOT NULL DEFAULT false,
    "competitorsMentioned" TEXT[],
    "sentiment" "Sentiment" NOT NULL DEFAULT 'NOT_MENTIONED',
    "responseText" TEXT NOT NULL,
    "mentionRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runCount" INTEGER,
    "consensusRate" DOUBLE PRECISION,
    "confidence" TEXT,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "mentionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "isOwned" BOOLEAN NOT NULL DEFAULT false,
    "platform" "Platform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "crawlabilityScore" INTEGER NOT NULL,
    "schemaScore" INTEGER NOT NULL,
    "contentScore" INTEGER NOT NULL,
    "authorityScore" INTEGER NOT NULL,
    "robotsTxtBlocking" BOOLEAN NOT NULL DEFAULT false,
    "schemaTypesFound" TEXT[],
    "recommendations" JSONB NOT NULL,
    "rawData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBrief" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" "BriefStatus" NOT NULL DEFAULT 'PENDING',
    "briefContent" JSONB,
    "schemaMarkup" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopilotSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stripeEventId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiBotVisit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "botName" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ipHash" TEXT,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT NOT NULL,

    CONSTRAINT "AiBotVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalChunk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetrievalChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityNode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityEdge" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL DEFAULT 'ONDEMAND',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "shareToken" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportBranding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#4F46E5',
    "companyName" TEXT NOT NULL DEFAULT 'VisibilityIQ',
    "tagline" TEXT NOT NULL DEFAULT 'AI Visibility Intelligence',
    "showWatermark" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReportBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppBanner" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'everyone',
    "dismissable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "AppBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminEmail" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "sentTo" INTEGER NOT NULL DEFAULT 0,
    "htmlBody" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentBy" TEXT NOT NULL,

    CONSTRAINT "AdminEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "otherText" TEXT,
    "offerShown" TEXT,
    "offerAccepted" BOOLEAN NOT NULL DEFAULT false,
    "featureRequested" TEXT,
    "competitorNamed" TEXT,
    "pauseDuration" INTEGER,
    "wantNotified" BOOLEAN NOT NULL DEFAULT false,
    "wantWinback" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "winback30SentAt" TIMESTAMP(3),
    "winback90SentAt" TIMESTAMP(3),

    CONSTRAINT "CancellationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequence" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "resendMessageId" TEXT,
    "trackingId" TEXT,

    CONSTRAINT "EmailSent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivationState" (
    "userId" TEXT NOT NULL,
    "signedUp" TIMESTAMP(3),
    "ranFirstScan" TIMESTAMP(3),
    "addedCompetitor" TIMESTAMP(3),
    "generatedBrief" TIMESTAMP(3),
    "connectedGSC" TIMESTAMP(3),
    "convertedToPaid" TIMESTAMP(3),
    "generatedReport" TIMESTAMP(3),

    CONSTRAINT "UserActivationState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ScheduledEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequence" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "durationMs" INTEGER,
    "error" TEXT,
    "metadata" JSONB,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialOpportunity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "subreddit" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "aiCitationProbability" INTEGER NOT NULL DEFAULT 0,
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "keywords" TEXT[],
    "status" "SocialOpportunityStatus" NOT NULL DEFAULT 'NEW',
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repliedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "externalId" TEXT,

    CONSTRAINT "SocialOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialReply" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "draftText" TEXT NOT NULL,
    "finalText" TEXT,
    "tone" "SocialReplyTone" NOT NULL DEFAULT 'HELPFUL',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "postUrl" TEXT,
    "upvotesReceived" INTEGER,
    "aiCited" BOOLEAN NOT NULL DEFAULT false,
    "aiCitedBy" TEXT[],
    "aiCitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialSettings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "redditEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quoraEnabled" BOOLEAN NOT NULL DEFAULT false,
    "linkedinEnabled" BOOLEAN NOT NULL DEFAULT false,
    "monitorKeywords" TEXT[],
    "excludeKeywords" TEXT[],
    "targetSubreddits" TEXT[],
    "minimumUpvotes" INTEGER NOT NULL DEFAULT 5,
    "minimumAICitationScore" INTEGER NOT NULL DEFAULT 40,
    "notifyOnNew" BOOLEAN NOT NULL DEFAULT true,
    "guidelinesAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Prompt_projectId_intent_idx" ON "Prompt"("projectId", "intent");

-- CreateIndex
CREATE INDEX "Citation_projectId_idx" ON "Citation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Citation_mentionId_url_key" ON "Citation"("mentionId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEvent_stripeEventId_key" ON "SubscriptionEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "AiBotVisit_projectId_visitedAt_idx" ON "AiBotVisit"("projectId", "visitedAt");

-- CreateIndex
CREATE INDEX "AiBotVisit_projectId_botName_visitedAt_idx" ON "AiBotVisit"("projectId", "botName", "visitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiBotVisit_dedupeKey_key" ON "AiBotVisit"("dedupeKey");

-- CreateIndex
CREATE INDEX "RetrievalChunk_projectId_idx" ON "RetrievalChunk"("projectId");

-- CreateIndex
CREATE INDEX "RetrievalChunk_projectId_url_idx" ON "RetrievalChunk"("projectId", "url");

-- CreateIndex
CREATE INDEX "EntityNode_projectId_idx" ON "EntityNode"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityNode_projectId_type_name_key" ON "EntityNode"("projectId", "type", "name");

-- CreateIndex
CREATE INDEX "EntityEdge_projectId_idx" ON "EntityEdge"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityEdge_projectId_fromId_toId_relation_key" ON "EntityEdge"("projectId", "fromId", "toId", "relation");

-- CreateIndex
CREATE UNIQUE INDEX "Report_shareToken_key" ON "Report"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "ReportBranding_userId_key" ON "ReportBranding"("userId");

-- CreateIndex
CREATE INDEX "CancellationRecord_cancelled_createdAt_winback30SentAt_idx" ON "CancellationRecord"("cancelled", "createdAt", "winback30SentAt");

-- CreateIndex
CREATE INDEX "CancellationRecord_cancelled_wantWinback_createdAt_winback9_idx" ON "CancellationRecord"("cancelled", "wantWinback", "createdAt", "winback90SentAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSent_trackingId_key" ON "EmailSent"("trackingId");

-- CreateIndex
CREATE INDEX "EmailSent_userId_sequence_step_idx" ON "EmailSent"("userId", "sequence", "step");

-- CreateIndex
CREATE INDEX "ScheduledEmail_sendAt_cancelled_sentAt_idx" ON "ScheduledEmail"("sendAt", "cancelled", "sentAt");

-- CreateIndex
CREATE INDEX "CronRun_name_startedAt_idx" ON "CronRun"("name", "startedAt");

-- CreateIndex
CREATE INDEX "SocialOpportunity_projectId_status_aiCitationProbability_idx" ON "SocialOpportunity"("projectId", "status", "aiCitationProbability");

-- CreateIndex
CREATE INDEX "SocialOpportunity_projectId_foundAt_idx" ON "SocialOpportunity"("projectId", "foundAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialOpportunity_projectId_url_key" ON "SocialOpportunity"("projectId", "url");

-- CreateIndex
CREATE INDEX "SocialReply_projectId_idx" ON "SocialReply"("projectId");

-- CreateIndex
CREATE INDEX "SocialReply_opportunityId_idx" ON "SocialReply"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialSettings_projectId_key" ON "SocialSettings"("projectId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "Mention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBrief" ADD CONSTRAINT "ContentBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotSession" ADD CONSTRAINT "CopilotSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotSession" ADD CONSTRAINT "CopilotSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotMessage" ADD CONSTRAINT "CopilotMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CopilotSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiBotVisit" ADD CONSTRAINT "AiBotVisit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetrievalChunk" ADD CONSTRAINT "RetrievalChunk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityNode" ADD CONSTRAINT "EntityNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityEdge" ADD CONSTRAINT "EntityEdge_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "EntityNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityEdge" ADD CONSTRAINT "EntityEdge_toId_fkey" FOREIGN KEY ("toId") REFERENCES "EntityNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityEdge" ADD CONSTRAINT "EntityEdge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportBranding" ADD CONSTRAINT "ReportBranding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRecord" ADD CONSTRAINT "CancellationRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSent" ADD CONSTRAINT "EmailSent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivationState" ADD CONSTRAINT "UserActivationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledEmail" ADD CONSTRAINT "ScheduledEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialOpportunity" ADD CONSTRAINT "SocialOpportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialReply" ADD CONSTRAINT "SocialReply_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "SocialOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialSettings" ADD CONSTRAINT "SocialSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

