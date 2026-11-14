import { NextResponse } from 'next/server';
import { aiPortalInterviewSchema } from '@codesync/shared';
import { readInterviewsStore } from '@/lib/interview-store';
import { getBackendApiBaseUrl, signCandidateInterviewToken } from '@/lib/server-auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const list = readInterviewsStore();
    const interview = list.find((i) => i.token === token);

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

    const targetRoomId =
      interview.roomId || `room-interview-${interview.token.replace('cs_inv_', '')}`;
    const signedCandidateJwt = signCandidateInterviewToken(interview.token, targetRoomId);

    const backendRes = await fetch(
      `${getBackendApiBaseUrl()}/api/v1/rooms/${targetRoomId}/ai/prompt`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Interview-Token': signedCandidateJwt,
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
