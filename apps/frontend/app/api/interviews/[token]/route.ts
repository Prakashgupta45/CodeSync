import { NextResponse } from 'next/server';
import { updatePortalInterviewSchema } from '@codesync/shared';
import {
  readInterviewsStore,
  sanitizeInterviewForCandidate,
  writeInterviewsStore,
} from '@/lib/interview-store';
import { getAuthenticatedServerUser } from '@/lib/server-auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const list = readInterviewsStore();

  let found = list.find((i) => i.token === token);
  if (!found) {
    const ownerCandidate = list.find((i) => i.id === token);
    if (ownerCandidate) {
      const user = await getAuthenticatedServerUser(req);
      if (user && ownerCandidate.ownerId === user.id) {
        found = ownerCandidate;
      }
    }
  }

  if (!found) {
    return NextResponse.json(
      { success: false, error: 'Interview session not found or link has expired' },
      { status: 404 }
    );
  }

  if (found.status === 'CANCELLED') {
    return NextResponse.json(
      { success: false, error: 'This interview invitation has been cancelled or revoked.' },
      { status: 410 }
    );
  }

  return NextResponse.json({
    success: true,
    data: sanitizeInterviewForCandidate(found),
  });
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
  const list = readInterviewsStore();
  const index = list.findIndex((i) => i.token === token || i.id === token);

  if (index === -1) {
    return NextResponse.json({ success: false, error: 'Interview not found' }, { status: 404 });
  }

  const target = list[index];
  if (!target.ownerId || target.ownerId !== user.id) {
    return NextResponse.json(
      { success: false, error: 'You are not authorized to modify this interview' },
      { status: 403 }
    );
  }

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

  const allowedUpdates = parsed.data;
  const updated = {
    ...target,
    ...(allowedUpdates.status !== undefined ? { status: allowedUpdates.status } : {}),
    ...(allowedUpdates.scheduledDate !== undefined
      ? { scheduledDate: allowedUpdates.scheduledDate }
      : {}),
    ...(allowedUpdates.instructions !== undefined
      ? { instructions: allowedUpdates.instructions }
      : {}),
  };

  list[index] = updated;
  writeInterviewsStore(list);

  return NextResponse.json({
    success: true,
    data: sanitizeInterviewForCandidate(updated),
  });
}
