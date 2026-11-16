import { NextResponse } from 'next/server';
import { aiPortalInterviewSchema } from '@codesync/shared';
import { getBackendApiBaseUrl, signCandidateInterviewToken } from '@/lib/server-auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const backendRes = await fetch(`${getBackendApiBaseUrl()}/api/v1/interviews/token/${token}/ai`, {
      cache: 'no-store',
    });
    const data = await backendRes.json().catch(() => ({
      success: false,
      error: { message: 'Failed to retrieve AI conversation history' },
    }));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI history proxy failed';
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const interviewRes = await fetch(`${getBackendApiBaseUrl()}/api/v1/interviews/token/${token}`);

    if (interviewRes.status === 410) {
      return NextResponse.json(
        { success: false, error: { message: 'Interview session has been cancelled' } },
        { status: 410 }
      );
    }

    if (!interviewRes.ok) {
      return NextResponse.json(
        { success: false, error: { message: 'Interview session not found' } },
        { status: 404 }
      );
    }

    const payload = await interviewRes.json();
    const interview = payload?.data;

    if (!interview) {
      return NextResponse.json(
        { success: false, error: { message: 'Interview session not found' } },
        { status: 404 }
      );
    }

    if (interview.status === 'CANCELLED') {
      return NextResponse.json(
        { success: false, error: { message: 'Interview session has been cancelled' } },
        { status: 410 }
      );
    }

    if (interview.aiSettings?.enableAi === false) {
      return NextResponse.json(
        { success: false, error: { message: 'AI Assistant is disabled for this assessment' } },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = aiPortalInterviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { message: parsed.error.issues[0]?.message || 'Invalid AI prompt payload' },
        },
        { status: 400 }
      );
    }

    const backendRes = await fetch(
      `${getBackendApiBaseUrl()}/api/v1/interviews/token/${token}/ai`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed.data),
      }
    );

    const data = await backendRes.json().catch(() => ({
      success: false,
      error: { message: 'AI service returned an invalid response' },
    }));

    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI proxy failed';
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    );
  }
}
