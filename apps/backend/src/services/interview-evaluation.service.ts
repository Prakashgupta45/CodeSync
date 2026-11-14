import { InterviewReportDto } from '@codesync/shared';

export class InterviewEvaluationService {
  /**
   * Generates structured final interview evaluation report scores and detailed feedback.
   */
  public generateEvaluationReport(
    interviewId: string,
    problemTitle: string,
    messagesCount: number,
    eventsCount: number,
    finalCode: string,
    hasRuntimeErrors: boolean,
    testMetrics?: { passedCount: number; totalCount: number }
  ): InterviewReportDto {
    const stripped = (finalCode || '')
      .replace(/\/\/.*$/gm, '')
      .replace(/#.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    // Detect if only an empty starter stub was submitted (no control flow, loops, maps, or meaningful statements)
    const nonTrivialLines = stripped
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 0 &&
          !['{', '}', 'pass', 'return 0;', 'return -1;', 'return [];', 'return {};', 'return false;', 'return "";', 'return null;', 'return nullptr;'].includes(l) &&
          !/^(class Solution|public:|private:|using namespace|#include|from typing)/.test(l)
      );

    const hasLogicConstructs = /\b(for|while|if|else|switch|map|Map|Set|unordered_map|lower_bound|dict|set|stack|queue|return\s+[^0{}\[\]"]+)/.test(
      stripped
    );
    const hasSubstantiveCode = nonTrivialLines.length >= 4 && hasLogicConstructs;
    const isCodePresent = stripped.length > 20 && nonTrivialLines.length >= 3;

    let passRatio = hasSubstantiveCode ? (hasRuntimeErrors ? 0.45 : 0.8) : 0;
    if (testMetrics && testMetrics.totalCount > 0) {
      passRatio = Math.max(0, Math.min(1, testMetrics.passedCount / testMetrics.totalCount));
    }

    const baseFromTests = Math.round(passRatio * 100);
    const problemSolvingScore = !isCodePresent
      ? 20
      : testMetrics && testMetrics.totalCount > 0
      ? Math.max(15, baseFromTests)
      : hasSubstantiveCode
      ? hasRuntimeErrors
        ? 55
        : 82
      : 30;

    const algorithmScore = !isCodePresent
      ? 15
      : hasSubstantiveCode
      ? testMetrics && testMetrics.totalCount > 0
        ? Math.max(15, Math.round(passRatio * 95))
        : hasRuntimeErrors
        ? 52
        : 80
      : 25;

    const codeQualityScore = !isCodePresent ? 20 : nonTrivialLines.length >= 6 ? 78 : 55;
    const debuggingScore = !isCodePresent ? 20 : hasRuntimeErrors ? 45 : 80;
    const complexityScore = !isCodePresent
      ? 15
      : /\b(unordered_map|Map|dict|lower_bound|binary|mid)\b/.test(stripped)
      ? 85
      : hasSubstantiveCode
      ? 68
      : 20;
    const communicationScore =
      messagesCount >= 4 ? 85 : messagesCount >= 2 ? 68 : messagesCount >= 1 ? 50 : 25;

    const overallScore = Math.round(
      (problemSolvingScore +
        algorithmScore +
        codeQualityScore +
        debuggingScore +
        complexityScore +
        communicationScore) /
        6
    );

    const strengths: string[] = [];
    if (messagesCount >= 2) {
      strengths.push(`Participated in ${messagesCount} technical interview exchanges.`);
    }
    if (hasSubstantiveCode && !hasRuntimeErrors) {
      strengths.push(`Submitted structured implementation logic for "${problemTitle}".`);
    }
    if (testMetrics && testMetrics.totalCount > 0 && testMetrics.passedCount > 0) {
      strengths.push(`Passed ${testMetrics.passedCount}/${testMetrics.totalCount} automated test cases.`);
    }
    if (strengths.length === 0) {
      strengths.push('No substantial working solution or discussion signals were observed.');
    }

    const weaknesses: string[] = [];
    if (!hasSubstantiveCode) {
      weaknesses.push('No substantive algorithmic implementation was written beyond starter template.');
    }
    if (hasRuntimeErrors) {
      weaknesses.push('Encountered compilation or runtime execution errors during Docker testing.');
    }
    if (testMetrics && testMetrics.totalCount > 0 && testMetrics.passedCount < testMetrics.totalCount) {
      weaknesses.push(
        `Failed ${testMetrics.totalCount - testMetrics.passedCount} of ${testMetrics.totalCount} test cases.`
      );
    }
    if (messagesCount < 2) {
      weaknesses.push('Limited explanation or discussion of algorithmic approach and edge cases.');
    }
    if (weaknesses.length === 0) {
      weaknesses.push('Ensure corner cases and extreme constraints are explicitly tested.');
    }

    const improvements = [
      'Analyze boundary inputs (empty arrays, negative integers, single-element inputs) before submitting.',
      'Walk through time and space complexity tradeoffs alongside implementation details.',
    ];

    const importantEvents = [
      `Interview session initialized with problem: "${problemTitle}".`,
      `Logged ${messagesCount} conversation turns and ${eventsCount} workflow events.`,
      hasSubstantiveCode
        ? 'Candidate submitted algorithmic implementation for evaluation.'
        : 'Session concluded without a complete algorithmic implementation.',
    ];

    const assessment = !hasSubstantiveCode
      ? `Incomplete submission for "${problemTitle}". The final editor buffer contained insufficient working logic (overall score: ${overallScore}/100).`
      : hasRuntimeErrors
      ? `The candidate wrote partial logic for "${problemTitle}" (${nonTrivialLines.length} lines) but encountered execution/runtime errors (overall score: ${overallScore}/100).`
      : `The candidate implemented a solution for "${problemTitle}" across ${nonTrivialLines.length} logical lines and ${messagesCount} interview turns (overall score: ${overallScore}/100).`;

    const recommendedNextSteps =
      overallScore >= 75
        ? 'Proceed to next engineering interview stage; verify complexity tradeoffs on follow-up variants.'
        : overallScore >= 50
        ? 'Borderline technical signal; schedule focused problem-solving & debugging follow-up if role requires.'
        : 'Do not advance based on this session; candidate needs stronger implementation completeness and test verification.';

    return {
      id: `report-${interviewId.slice(0, 8)}`,
      interviewId,
      overallScore,
      problemSolvingScore,
      algorithmScore,
      codeQualityScore,
      debuggingScore,
      complexityScore,
      communicationScore,
      strengths,
      weaknesses,
      improvements,
      importantEvents,
      assessment,
      recommendedNextSteps,
      createdAt: new Date().toISOString(),
    };
  }
}

export const interviewEvaluationService = new InterviewEvaluationService();
