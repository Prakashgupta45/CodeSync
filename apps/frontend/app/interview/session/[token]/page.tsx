'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  getInterviewByToken,
  fetchInterviewByTokenAsync,
  InterviewItem,
} from '../../../../lib/interview-service';
import { InterviewWorkspace } from '../../../../components/interview/interview-workspace';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function CandidateInterviewSessionPage() {
  const params = useParams();
  const token = (params?.token as string) || '';

  const [interview, setInterview] = useState<InterviewItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      // 1. Fetch from server API first to guarantee the real configured custom problem
      let data = await fetchInterviewByTokenAsync(token);

      // 2. Fall back to local storage cache if server request didn't return
      if (!data) {
        data = getInterviewByToken(token);
      }

      if (isMounted) {
        if (data && data.status !== 'CANCELLED') {
          setInterview(data);
        } else if (data?.status === 'CANCELLED') {
          setError('This interview invitation has been cancelled or revoked by the organizer.');
        } else {
          setError('This interview session invitation could not be found, has been cancelled, or has expired.');
        }
        setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center text-text-muted gap-3">
        <Loader2 className="animate-spin" size={28} color="#ff5c00" />
        <p style={{ fontSize: '13px' }}>Loading candidate technical interview session...</p>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
        <div className="iw-candidate-card" style={{ textAlign: 'center', padding: '40px 24px', maxWidth: '480px' }}>
          <AlertCircle size={44} color="#ef4444" style={{ margin: '0 auto 14px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px' }}>
            Interview Session Not Found
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 auto 20px' }}>
            {error || 'This interview invitation link is invalid or may have expired.'}
          </p>
          <Link href="/interview" className="iw-btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            Go to Interview Portal
          </Link>
        </div>
      </div>
    );
  }

  const effectiveRoomId =
    interview.roomId && interview.roomId.startsWith('room-interview-')
      ? interview.roomId
      : `room-interview-${token.replace('cs_inv_', '')}`;

  return <InterviewWorkspace roomId={effectiveRoomId} interview={interview} />;
}
