import { NextResponse } from 'next/server';
import { compareOutputs, generateTestDriver } from '@/lib/test-harness';
import { QUESTION_LIBRARY } from '@/lib/interview-service';
import { getBackendApiBaseUrl, signCandidateInterviewToken } from '@/lib/server-auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();
    const { code, language, problemId } = body || {};

    if (typeof code !== 'string' || typeof language !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing code or language for submission' },
        { status: 400 }
      );
    }

    const backendApiV1 = `${getBackendApiBaseUrl()}/api/v1`;
    const interviewRes = await fetch(`${backendApiV1}/interviews/token/${token}`);

    if (interviewRes.status === 410) {
      return NextResponse.json(
        { success: false, error: 'Interview session has been cancelled' },
        { status: 410 }
      );
    }

    if (!interviewRes.ok) {
      return NextResponse.json(
        { success: false, error: 'Interview session not found' },
        { status: 404 }
      );
    }

    const payload = await interviewRes.json();
    const interview = payload?.data;

    if (!interview) {
      return NextResponse.json(
        { success: false, error: 'Interview session not found' },
        { status: 404 }
      );
    }

    if (interview.status === 'CANCELLED') {
      return NextResponse.json(
        { success: false, error: 'Interview session has been cancelled' },
        { status: 410 }
      );
    }

    const problem =
      interview.problems?.find((p: any) => p.id === problemId) ||
      interview.problems?.[0] ||
      QUESTION_LIBRARY[0];

    const fallbackLibraryProb = QUESTION_LIBRARY.find((q) => q.id === problem.id);
    const visibleCases = problem.visibleTestCases || [];
    const hiddenCases =
      problem.hiddenTestCases && problem.hiddenTestCases.length > 0
        ? problem.hiddenTestCases
        : fallbackLibraryProb?.hiddenTestCases || [];

    const targetRoomId = interview.roomId || `room-interview-${interview.token.replace('cs_inv_', '')}`;
    const signedCandidateJwt = signCandidateInterviewToken(interview.token, targetRoomId);

    const runSingleCase = async (input: string, expectedOutput: string) => {
      const driverCode = generateTestDriver(
        code,
        language,
        problem.id,
        input,
        problem.functionSignature
      );

      const res = await fetch(`${backendApiV1}/rooms/${targetRoomId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Interview-Token': signedCandidateJwt,
        },
        body: JSON.stringify({ code: driverCode, language }),
      });

      const execPayload = await res.json().catch(() => ({}));
      const ed = execPayload?.data;
      if (!res.ok || !ed) {
        return {
          passed: false,
          actualOutput: execPayload?.error?.message || 'Execution failed',
          executionTimeMs: 0,
          isCompile: false,
          isTimeout: false,
          isRuntime: true,
        };
      }

      const isTimeout = Boolean(
        ed.timedOut || ed.exitCode === 124 || ed.exitCode === 143
      );
      const isCompile = Boolean(ed.compileError);
      const isRuntime = Boolean(ed.runtimeError && !isTimeout);
      const isClean = ed.exitCode === 0 && !isTimeout && !isCompile;
      const passed =
        isClean &&
        compareOutputs(ed.stdout || '', expectedOutput, { problemId: problem.id });

      const actualOutput = isTimeout
        ? 'Execution timed out after 5.0 seconds'
        : isCompile
        ? ed.compileError
        : isRuntime
        ? ed.runtimeError
        : ed.stdout
        ? ed.stdout.trim()
        : 'No output';

      return {
        passed,
        actualOutput,
        executionTimeMs: ed.executionTimeMs || 0,
        isCompile,
        isTimeout,
        isRuntime,
      };
    };

    let visiblePassed = 0;
    let hiddenPassed = 0;
    let totalRuntime = 0;
    let hasCompileError = false;
    let hasTimeout = false;
    let hasRuntimeError = false;

    // Evaluate visible test cases
    const evaluatedVisible = await Promise.all(
      visibleCases.map(async (tc: any) => {
        const result = await runSingleCase(tc.input, tc.expectedOutput);
        totalRuntime += result.executionTimeMs;
        if (result.isCompile) hasCompileError = true;
        if (result.isTimeout) hasTimeout = true;
        if (result.isRuntime) hasRuntimeError = true;
        if (result.passed) visiblePassed++;
        return {
          ...tc,
          actualOutput: result.actualOutput,
          passed: result.passed,
          executionTime: result.executionTimeMs,
        };
      })
    );

    // Evaluate confidential hidden test cases strictly server-side (zero inputs/outputs returned!)
    for (const tc of hiddenCases) {
      const result = await runSingleCase(tc.input, tc.expectedOutput);
      totalRuntime += result.executionTimeMs;
      if (result.isCompile) hasCompileError = true;
      if (result.isTimeout) hasTimeout = true;
      if (result.isRuntime) hasRuntimeError = true;
      if (result.passed) hiddenPassed++;
    }

    const totalCases = visibleCases.length + hiddenCases.length;
    const totalPassed = visiblePassed + hiddenPassed;
    const score = totalCases > 0 ? Math.round((totalPassed / totalCases) * 100) : 0;

    const verdict: 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' =
      score === 100
        ? 'ACCEPTED'
        : hasCompileError || hasTimeout || hasRuntimeError
        ? 'RUNTIME_ERROR'
        : 'WRONG_ANSWER';

    const verdictMessage =
      verdict === 'ACCEPTED'
        ? `All ${totalCases} test cases passed! Optimal ${problem.expectedTimeComplexity || 'O(N)'} target.`
        : hasTimeout
        ? 'Execution timed out after 5.0 seconds on test suite.'
        : hasCompileError
        ? 'Compilation failed on solution test suite.'
        : hasRuntimeError
        ? 'Runtime error encountered during test suite execution.'
        : `${totalPassed} of ${totalCases} test cases passed.`;

    const avgRuntimeMs = totalCases > 0 ? Math.round(totalRuntime / totalCases) : 0;
    const submissionRecord = {
      submittedCode: code,
      language,
      score,
      visiblePassed,
      visibleTotal: visibleCases.length,
      hiddenPassed,
      hiddenTotal: hiddenCases.length,
      runtimeMs: avgRuntimeMs,
      memoryMb: '256 MB Limit',
      verdict,
      completedAt: new Date().toISOString(),
    };

    // Persist completed evaluation and submission record in durable PostgreSQL backend
    await fetch(`${backendApiV1}/interviews/token/${token}/record-submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ submission: submissionRecord }),
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      data: {
        visibleCases: evaluatedVisible,
        status: verdict,
        visiblePassed,
        visibleTotal: visibleCases.length,
        hiddenPassed,
        hiddenTotal: hiddenCases.length,
        score,
        runtimeMs: avgRuntimeMs,
        memoryMb: '256 MB Limit',
        verdictMessage,
        completedAt: submissionRecord.completedAt,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Submission evaluation failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
