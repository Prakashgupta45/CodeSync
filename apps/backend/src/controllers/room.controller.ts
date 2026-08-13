import { Response, NextFunction } from 'express';
import { roomService } from '../services/room.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ApiResponse, RoomDto, RoomMemberDto } from '@codesync/shared';

export class RoomController {
  public create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const room = await roomService.createRoom(userId, req.body);

      const response: ApiResponse<RoomDto> = {
        success: true,
        message: 'Coding room created successfully',
        data: room,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const search = req.query.search ? String(req.query.search) : undefined;
      const language = req.query.language ? String(req.query.language) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;

      const rooms = await roomService.listUserRooms(userId, search, language, status);

      const response: ApiResponse<RoomDto[]> = {
        success: true,
        data: rooms,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const roomId = String(req.params.roomId);

      const room = await roomService.getRoomDetails(roomId, userId);

      const response: ApiResponse<RoomDto> = {
        success: true,
        data: room,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public join = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const roomId = String(req.params.roomId);

      const room = await roomService.joinRoom(roomId, userId);

      const response: ApiResponse<RoomDto> = {
        success: true,
        message: 'Joined room successfully',
        data: room,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public leave = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const roomId = String(req.params.roomId);

      await roomService.leaveRoom(roomId, userId);

      const response: ApiResponse = {
        success: true,
        message: 'Left room successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const roomId = String(req.params.roomId);

      await roomService.deleteRoom(roomId, userId);

      const response: ApiResponse = {
        success: true,
        message: 'Room deleted successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public getMembers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const roomId = String(req.params.roomId);

      const members = await roomService.getRoomMembers(roomId, userId);

      const response: ApiResponse<RoomMemberDto[]> = {
        success: true,
        data: members,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public removeMember = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerUserId = req.user!.userId;
      const roomId = String(req.params.roomId);
      const memberUserId = String(req.params.userId);

      await roomService.removeMember(roomId, ownerUserId, memberUserId);

      const response: ApiResponse = {
        success: true,
        message: 'Member removed successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}

export const roomController = new RoomController();
