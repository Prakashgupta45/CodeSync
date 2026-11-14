'use client';

import React, { use } from 'react';
import { InterviewWorkspace } from '../../../../components/interview/interview-workspace';

interface InterviewRoomProps {
  params: Promise<{ roomId: string }>;
}

export default function InterviewRoomPage({ params }: InterviewRoomProps) {
  const unwrapped = use(params);
  const roomId = unwrapped.roomId;

  return <InterviewWorkspace roomId={roomId} />;
}
