import { RoomPresenceUserDto, RoomRole } from '@codesync/shared';

interface RoomPresenceState {
  userId: string;
  name: string;
  role: RoomRole;
  socketCount: number;
}

export class PresenceService {
  // Room ID -> (User ID -> RoomPresenceState)
  private roomPresenceMap = new Map<string, Map<string, RoomPresenceState>>();

  public userConnected(
    roomId: string,
    userId: string,
    name: string,
    role: RoomRole
  ): { user: RoomPresenceUserDto; isNewUser: boolean; users: RoomPresenceUserDto[] } {
    let roomMap = this.roomPresenceMap.get(roomId);
    if (!roomMap) {
      roomMap = new Map<string, RoomPresenceState>();
      this.roomPresenceMap.set(roomId, roomMap);
    }

    const existing = roomMap.get(userId);
    let isNewUser = false;

    if (existing) {
      existing.socketCount += 1;
      existing.role = role; // Update role in case changed
      existing.name = name;
    } else {
      isNewUser = true;
      roomMap.set(userId, {
        userId,
        name,
        role,
        socketCount: 1,
      });
    }

    const state = roomMap.get(userId)!;
    const userDto: RoomPresenceUserDto = {
      userId: state.userId,
      name: state.name,
      role: state.role,
      socketCount: state.socketCount,
    };

    return {
      user: userDto,
      isNewUser,
      users: this.getRoomPresence(roomId),
    };
  }

  public userDisconnected(
    roomId: string,
    userId: string
  ): { userFullyDisconnected: boolean; users: RoomPresenceUserDto[] } {
    const roomMap = this.roomPresenceMap.get(roomId);
    if (!roomMap) {
      return { userFullyDisconnected: false, users: [] };
    }

    const existing = roomMap.get(userId);
    if (!existing) {
      return { userFullyDisconnected: false, users: this.getRoomPresence(roomId) };
    }

    existing.socketCount -= 1;
    let userFullyDisconnected = false;

    if (existing.socketCount <= 0) {
      roomMap.delete(userId);
      userFullyDisconnected = true;
    }

    if (roomMap.size === 0) {
      this.roomPresenceMap.delete(roomId);
    }

    return {
      userFullyDisconnected,
      users: this.getRoomPresence(roomId),
    };
  }

  public getRoomPresence(roomId: string): RoomPresenceUserDto[] {
    const roomMap = this.roomPresenceMap.get(roomId);
    if (!roomMap) return [];

    return Array.from(roomMap.values()).map((state) => ({
      userId: state.userId,
      name: state.name,
      role: state.role,
      socketCount: state.socketCount,
    }));
  }

  public clearAll() {
    this.roomPresenceMap.clear();
  }
}

export const presenceService = new PresenceService();
