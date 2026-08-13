export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
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
  accessToken: string;
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
