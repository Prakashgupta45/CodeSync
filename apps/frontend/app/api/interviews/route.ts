import { NextResponse } from 'next/server';
import { createPortalInterviewSchema } from '@codesync/shared';
import { getAuthenticatedServerUser, getBackendApiBaseUrl } from '@/lib/server-auth';

export async function GET(req: Request) {
  const user = await getAuthenticatedServerUser(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const backendRes = await fetch(`${getBackendApiBaseUrl()}/api/v1/interviews`, {
      method: 'GET',
      headers: {
        cookie: req.headers.get('cookie') || '',
        authorization: req.headers.get('authorization') || '',
      },
    });

    if (backendRes.ok) {
      const payload = await backendRes.json();
      return NextResponse.json(payload);
    }

    const errorPayload = await backendRes.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, error: errorPayload?.error?.message || 'Failed to fetch interviews' },
      { status: backendRes.status }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Backend connection error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedServerUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = createPortalInterviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid interview payload',
        },
        { status: 400 }
      );
    }

    const backendRes = await fetch(`${getBackendApiBaseUrl()}/api/v1/interviews/portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') || '',
        authorization: req.headers.get('authorization') || '',
      },
      body: JSON.stringify(parsed.data),
    });

    const data = await backendRes.json().catch(() => ({}));
    if (backendRes.ok) {
      return NextResponse.json(data, { status: 201 });
    }

    return NextResponse.json(
      { success: false, error: data?.error?.message || 'Failed to create interview' },
      { status: backendRes.status }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create interview';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
