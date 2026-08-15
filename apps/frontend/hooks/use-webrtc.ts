'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { CallParticipantDto, RoomRole } from '@codesync/shared';

const STUN_SERVERS = [
  { urls: process.env.NEXT_PUBLIC_STUN_SERVER_URL || 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const ICE_CONFIG: RTCConfiguration = {
  iceServers: STUN_SERVERS,
};

export interface RemoteParticipantStream {
  userId: string;
  name: string;
  role: RoomRole;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  stream: MediaStream | null;
}

export function useWebRTC(
  roomId: string,
  user: { id: string; name: string },
  role: RoomRole,
  socket: Socket | null
) {
  const [isInCall, setIsInCall] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState<boolean>(role !== 'VIEWER');
  const [microphoneEnabled, setMicrophoneEnabled] = useState<boolean>(role !== 'VIEWER');
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipantStream>>(
    new Map()
  );
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const cameraEnabledRef = useRef<boolean>(cameraEnabled);
  const microphoneEnabledRef = useRef<boolean>(microphoneEnabled);

  cameraEnabledRef.current = cameraEnabled;
  microphoneEnabledRef.current = microphoneEnabled;

  const isViewer = role === 'VIEWER';

  // Helper to create RTCPeerConnection for a target peer
  const createPeerConnection = useCallback(
    (targetUserId: string, targetName: string, targetRole: RoomRole) => {
      if (peerConnectionsRef.current.has(targetUserId)) {
        return peerConnectionsRef.current.get(targetUserId)!;
      }

      const pc = new RTCPeerConnection(ICE_CONFIG);
      peerConnectionsRef.current.set(targetUserId, pc);

      // Add local media tracks to peer connection if available
      if (localStreamRef.current && !isViewer) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Send local ICE candidates to target peer via Socket.IO
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('call:ice-candidate', {
            roomId,
            targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle incoming remote media tracks
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteParticipants((prev) => {
          const next = new Map(prev);
          const existing = next.get(targetUserId) || {
            userId: targetUserId,
            name: targetName,
            role: targetRole,
            cameraEnabled: true,
            microphoneEnabled: true,
            stream: null,
          };

          next.set(targetUserId, {
            ...existing,
            stream: remoteStream || new MediaStream([event.track]),
          });
          return next;
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          pc.close();
          peerConnectionsRef.current.delete(targetUserId);
        }
      };

      return pc;
    },
    [roomId, socket, isViewer]
  );

  // Clean up a peer connection and remove video tile
  const removePeerConnection = useCallback((peerUserId: string) => {
    const pc = peerConnectionsRef.current.get(peerUserId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerUserId);
    }
    setRemoteParticipants((prev) => {
      const next = new Map(prev);
      next.delete(peerUserId);
      return next;
    });
  }, []);

  // Socket.IO WebRTC Signaling Event Listeners
  useEffect(() => {
    if (!socket || !isInCall) return;

    // 1. call:sync - Received initial participants list upon joining call
    const handleCallSync = async (data: { roomId: string; participants: CallParticipantDto[] }) => {
      if (data.roomId !== roomId) return;

      for (const p of data.participants) {
        if (p.userId === user.id) continue;

        setRemoteParticipants((prev) => {
          const next = new Map(prev);
          next.set(p.userId, {
            userId: p.userId,
            name: p.name,
            role: p.role,
            cameraEnabled: p.cameraEnabled,
            microphoneEnabled: p.microphoneEnabled,
            stream: null,
          });
          return next;
        });

        const pc = createPeerConnection(p.userId, p.name, p.role);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit('call:offer', {
            roomId,
            targetUserId: p.userId,
            offer,
          });
        } catch (_) {}
      }
    };

    // 2. call:peer-joined - Remote peer joined the room call
    const handlePeerJoined = (data: { roomId: string; participant: CallParticipantDto }) => {
      if (data.roomId !== roomId || data.participant.userId === user.id) return;

      const p = data.participant;
      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        next.set(p.userId, {
          userId: p.userId,
          name: p.name,
          role: p.role,
          cameraEnabled: p.cameraEnabled,
          microphoneEnabled: p.microphoneEnabled,
          stream: null,
        });
        return next;
      });

      createPeerConnection(p.userId, p.name, p.role);
    };

    // 3. call:offer - Received SDP offer from remote peer
    const handleCallOffer = async (data: {
      roomId: string;
      senderUserId: string;
      targetUserId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (data.roomId !== roomId || data.targetUserId !== user.id) return;

      const pc = createPeerConnection(data.senderUserId, 'Peer', 'PARTICIPANT');
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('call:answer', {
          roomId,
          targetUserId: data.senderUserId,
          answer,
        });
      } catch (_) {}
    };

    // 4. call:answer - Received SDP answer from remote peer
    const handleCallAnswer = async (data: {
      roomId: string;
      senderUserId: string;
      targetUserId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (data.roomId !== roomId || data.targetUserId !== user.id) return;

      const pc = peerConnectionsRef.current.get(data.senderUserId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (_) {}
      }
    };

    // 5. call:ice-candidate - Received ICE candidate from remote peer
    const handleIceCandidate = async (data: {
      roomId: string;
      senderUserId: string;
      targetUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (data.roomId !== roomId || data.targetUserId !== user.id) return;

      const pc = peerConnectionsRef.current.get(data.senderUserId);
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (_) {}
      }
    };

    // 6. call:peer-left - Remote peer left call
    const handlePeerLeft = (data: { roomId: string; userId: string }) => {
      if (data.roomId === roomId) {
        removePeerConnection(data.userId);
      }
    };

    // 7. call:media-state - Remote peer updated camera/mic toggles
    const handleMediaState = (data: {
      roomId: string;
      userId: string;
      cameraEnabled: boolean;
      microphoneEnabled: boolean;
    }) => {
      if (data.roomId !== roomId) return;

      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.userId);
        if (existing) {
          next.set(data.userId, {
            ...existing,
            cameraEnabled: data.cameraEnabled,
            microphoneEnabled: data.microphoneEnabled,
          });
        }
        return next;
      });
    };

    socket.on('call:sync', handleCallSync);
    socket.on('call:peer-joined', handlePeerJoined);
    socket.on('call:offer', handleCallOffer);
    socket.on('call:answer', handleCallAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:peer-left', handlePeerLeft);
    socket.on('call:media-state', handleMediaState);

    return () => {
      socket.off('call:sync', handleCallSync);
      socket.off('call:peer-joined', handlePeerJoined);
      socket.off('call:offer', handleCallOffer);
      socket.off('call:answer', handleCallAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:peer-left', handlePeerLeft);
      socket.off('call:media-state', handleMediaState);
    };
  }, [socket, roomId, isInCall, user.id, createPeerConnection, removePeerConnection]);

  // Join Call action
  const joinCall = async () => {
    if (isInCall || isJoining) return;

    try {
      setIsJoining(true);
      setError(null);

      let stream: MediaStream | null = null;

      if (!isViewer) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (mediaErr: any) {
          setError('Unable to access camera/microphone. Please check browser permissions.');
          setIsJoining(false);
          return;
        }
      }

      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsInCall(true);
      setCameraEnabled(!isViewer);
      setMicrophoneEnabled(!isViewer);

      if (socket) {
        socket.emit('call:join', { roomId });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join video call');
    } finally {
      setIsJoining(false);
    }
  };

  // Leave Call action
  const leaveCall = useCallback(() => {
    if (socket) {
      socket.emit('call:leave', { roomId });
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setRemoteParticipants(new Map());
    setIsInCall(false);
  }, [socket, roomId]);

  // Robust Camera Toggle: Handles track enabling & stopped track replacement
  const toggleCamera = async () => {
    if (isViewer) return;

    try {
      setError(null);
      let videoTrack = localStreamRef.current?.getVideoTracks()[0];

      // If video track does not exist or was ended, request a new track via getUserMedia
      if (!videoTrack || videoTrack.readyState === 'ended') {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          const newVideoTrack = newStream.getVideoTracks()[0];

          if (newVideoTrack) {
            if (!localStreamRef.current) {
              localStreamRef.current = new MediaStream([newVideoTrack]);
            } else {
              localStreamRef.current.addTrack(newVideoTrack);
            }

            // Replace sender track across all active peer connections
            peerConnectionsRef.current.forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
              if (sender) {
                sender.replaceTrack(newVideoTrack);
              } else if (localStreamRef.current) {
                pc.addTrack(newVideoTrack, localStreamRef.current);
              }
            });

            videoTrack = newVideoTrack;
          }
        } catch (err: any) {
          setError('Unable to access camera. Please check browser permissions.');
          setCameraEnabled(false);
          cameraEnabledRef.current = false;
          if (socket) {
            socket.emit('call:media-state', {
              roomId,
              cameraEnabled: false,
              microphoneEnabled: microphoneEnabledRef.current,
            });
          }
          return;
        }
      }

      if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;

        setCameraEnabled(nextState);
        cameraEnabledRef.current = nextState;

        // Clone MediaStream reference to trigger React state updates for video components
        if (localStreamRef.current) {
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        if (socket) {
          socket.emit('call:media-state', {
            roomId,
            cameraEnabled: nextState,
            microphoneEnabled: microphoneEnabledRef.current,
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to toggle camera');
    }
  };

  // Robust Microphone Toggle: Handles track enabling & stopped track replacement
  const toggleMicrophone = async () => {
    if (isViewer) return;

    try {
      setError(null);
      let audioTrack = localStreamRef.current?.getAudioTracks()[0];

      if (!audioTrack || audioTrack.readyState === 'ended') {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          const newAudioTrack = newStream.getAudioTracks()[0];

          if (newAudioTrack) {
            if (!localStreamRef.current) {
              localStreamRef.current = new MediaStream([newAudioTrack]);
            } else {
              localStreamRef.current.addTrack(newAudioTrack);
            }

            peerConnectionsRef.current.forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
              if (sender) {
                sender.replaceTrack(newAudioTrack);
              } else if (localStreamRef.current) {
                pc.addTrack(newAudioTrack, localStreamRef.current);
              }
            });

            audioTrack = newAudioTrack;
          }
        } catch (err: any) {
          setError('Unable to access microphone. Please check browser permissions.');
          setMicrophoneEnabled(false);
          microphoneEnabledRef.current = false;
          if (socket) {
            socket.emit('call:media-state', {
              roomId,
              cameraEnabled: cameraEnabledRef.current,
              microphoneEnabled: false,
            });
          }
          return;
        }
      }

      if (audioTrack) {
        const nextState = !audioTrack.enabled;
        audioTrack.enabled = nextState;

        setMicrophoneEnabled(nextState);
        microphoneEnabledRef.current = nextState;

        if (localStreamRef.current) {
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        if (socket) {
          socket.emit('call:media-state', {
            roomId,
            cameraEnabled: cameraEnabledRef.current,
            microphoneEnabled: nextState,
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to toggle microphone');
    }
  };

  // Auto cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
    };
  }, []);

  return {
    isInCall,
    isJoining,
    localStream,
    cameraEnabled,
    microphoneEnabled,
    remoteParticipants: Array.from(remoteParticipants.values()),
    error,
    joinCall,
    leaveCall,
    toggleCamera,
    toggleMicrophone,
  };
}
