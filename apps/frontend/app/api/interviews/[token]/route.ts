import { NextResponse } from 'next/server';
import { updatePortalInterviewSchema } from '@codesync/shared';
import { getAuthenticatedServerUser, getBackendApiBaseUrl } from '@/lib/server-auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const backendRes = await fetch(`${getBackendApiBaseUrl()}/api/v1/interviews/token/${token}`, {
      method: 'GET',
      headers: {
        cookie: req.headers.get('cookie') || '',
        authorization: req.headers.get('authorization') || '',
      },
    });

    if (backendRes.status === 410) {
      return NextResponse.json(
        { success: false, error: 'This interview invitation has been cancelled or revoked.' },
        { status: 410 }
      );
    }

    if (backendRes.status === 404) {
      return NextResponse.json(
        { success: false, error: 'Interview session not found or link has expired' },
        { status: 404 }
      );
    }

    if (backendRes.ok) {
      const payload = await backendRes.json();
      return NextResponse.json(payload);
    }

    const errorPayload = await backendRes.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, error: errorPayload?.error?.message || 'Failed to fetch interview session' },
      { status: backendRes.status }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Backend connection error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const user = await getAuthenticatedServerUser(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  const { token } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updatePortalInterviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message || 'Invalid update payload',
      },
      { status: 400 }
    );
  }

  try {
    const backendRes = await fetch(`${getBackendApiBaseUrl()}/api/v1/interviews/${token}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') || '',
        authorization: req.headers.get('authorization') || '',
      },
      body: JSON.stringify(parsed.data),
    });

    const data = await backendRes.json().catch(() => ({}));
    if (backendRes.ok) {
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { success: false, error: data?.error?.message || 'Failed to update interview' },
      { status: backendRes.status }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Backend connection error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
