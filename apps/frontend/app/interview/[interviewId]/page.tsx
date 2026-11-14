'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { InterviewWorkspace } from '../../../components/interview/interview-workspace';

export default function InterviewSessionPage() {
  const params = useParams();
  const interviewId = (params?.interviewId as string) || '';

  return <InterviewWorkspace roomId={interviewId} />;
}
