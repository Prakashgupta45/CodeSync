export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  status?: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface AuthResponseData {
  user: UserDto;
  accessToken?: string;
}

export type RoomRole = 'OWNER' | 'PARTICIPANT' | 'VIEWER';
export type RoomStatus = 'ACTIVE' | 'CLOSED';

export interface RoomMemberUserDto {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface RoomMemberDto {
  id: string;
  roomId: string;
  userId: string;
  role: RoomRole;
  joinedAt: string;
  user: RoomMemberUserDto;
}

export interface RoomDto {
  id: string;
  name: string;
  ownerId: string;
  language: string;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
  role?: RoomRole;
  memberCount?: number;
  members?: RoomMemberDto[];
  owner?: RoomMemberUserDto;
}

export interface ChatMessageDto {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export interface RoomPresenceUserDto {
  userId: string;
  name: string;
  role: RoomRole;
  socketCount: number;
}

export interface CodeExecutionResultDto {
  stdout: string;
  stderr: string;
  exitCode: number;
  compileError?: string | null;
  runtimeError?: string | null;
  executionTimeMs: number;
  timedOut: boolean;
}

export interface RoomExecutionResultDto extends CodeExecutionResultDto {
  roomId: string;
  executionId: string;
  executedBy: {
    userId: string;
    name: string;
    role: RoomRole;
  };
  language: string;
  timestamp: string;
}

export type AiActionType = 'CHAT' | 'EXPLAIN' | 'DEBUG' | 'REFACTOR' | 'TESTS';

export interface AiMessageDto {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userRole: RoomRole;
  prompt: string;
  response: string;
  action: AiActionType;
  createdAt: string;
}

export interface CallParticipantDto {
  userId: string;
  name: string;
  role: RoomRole;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
}

export interface CallJoinPayload {
  roomId: string;
}

export interface CallLeavePayload {
  roomId: string;
}

export interface CallOfferPayload {
  roomId: string;
  targetUserId: string;
  offer: any;
}

export interface CallAnswerPayload {
  roomId: string;
  targetUserId: string;
  answer: any;
}

export interface CallIceCandidatePayload {
  roomId: string;
  targetUserId: string;
  candidate: any;
}

export interface CallMediaStatePayload {
  roomId: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
}

export type InterviewActionType =
  | 'START_INTERVIEW'
  | 'ASK_APPROACH'
  | 'ANALYZE_CODE'
  | 'ASK_COMPLEXITY'
  | 'DEBUG_ERROR'
  | 'FOLLOW_UP'
  | 'EVALUATE'
  | 'FINAL_REPORT';

export interface ProblemDto {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  constraints?: string | null;
  examples: any[];
  expectedInput?: string | null;
  expectedOutput?: string | null;
  starterCode?: string | null;
}

export interface InterviewMessageDto {
  id: string;
  interviewId: string;
  senderType: 'AI_INTERVIEWER' | 'CANDIDATE';
  senderId: string | null;
  senderName: string;
  content: string;
  action?: InterviewActionType | null;
  createdAt: string;
}

export interface InterviewReportDto {
  id?: string;
  interviewId: string;
  overallScore: number;
  problemSolvingScore: number;
  algorithmScore: number;
  codeQualityScore: number;
  debuggingScore: number;
  complexityScore: number;
  communicationScore: number;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  importantEvents: string[];
  assessment: string;
  recommendedNextSteps: string;
  createdAt?: string;
}

export interface InterviewDto {
  id: string;
  roomId: string;
  ownerId: string;
  candidateId: string;
  candidateName: string | null;
  problemId?: string | null;
  problem?: ProblemDto | null;
  title: string;
  status: 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  language: string;
  duration: number;
  instructions?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: InterviewMessageDto[];
  report?: InterviewReportDto | null;
}
