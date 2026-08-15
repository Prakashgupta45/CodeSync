'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  Loader2,
  Lock,
  User,
  X,
} from 'lucide-react';
import { RoomRole } from '@codesync/shared';
import { Socket } from 'socket.io-client';
import { useWebRTC } from '../../hooks/use-webrtc';

interface RoomVideoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  user: {
    id: string;
    name: string;
  };
  role: RoomRole;
  socket: Socket | null;
  onCallStateChange?: (isInCall: boolean) => void;
}

const VideoTile: React.FC<{
  stream: MediaStream | null;
  name: string;
  role: RoomRole;
  isLocal?: boolean;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
}> = ({ stream, name, role, isLocal = false, cameraEnabled, microphoneEnabled }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Callback ref guarantees srcObject assignment and play() execution whenever <video> enters DOM
  const setVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && stream && cameraEnabled) {
        node.srcObject = stream;
        node.play().catch(() => {});
      }
    },
    [stream, cameraEnabled]
  );

  useEffect(() => {
    if (videoRef.current && stream && cameraEnabled) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, cameraEnabled]);

  return (
    <div className="relative bg-[#0d0f14] border border-border-subtle rounded-xl overflow-hidden aspect-video flex flex-col justify-between p-3 shadow-xl group min-h-[220px]">
      {/* Video Viewport or Placeholder */}
      {cameraEnabled && stream ? (
        <video
          ref={setVideoNode}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-cover rounded-xl"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-secondary/90 text-text-muted gap-2 select-none">
          <div className="w-14 h-14 rounded-full bg-replit-orange/20 border border-replit-orange/30 text-replit-orange font-bold text-lg flex items-center justify-center font-mono shadow-md">
            {name.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-text-muted font-medium">Camera Off</span>
        </div>
      )}

      {/* Top Header Overlay */}
      <div className="relative z-10 flex items-center justify-between">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shadow-sm ${
            role === 'OWNER'
              ? 'bg-replit-orange text-white'
              : role === 'VIEWER'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}
        >
          {role}
        </span>

        {isLocal && (
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-semibold shadow-sm">
            YOU
          </span>
        )}
      </div>

      {/* Bottom Footer Overlay */}
      <div className="relative z-10 flex items-center justify-between bg-bg-main/80 backdrop-blur-md p-2 rounded-lg border border-border-subtle text-xs">
        <div className="flex items-center gap-1.5 truncate text-white font-medium">
          <User className="w-3.5 h-3.5 text-replit-orange shrink-0" />
          <span className="truncate">{name}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {microphoneEnabled ? (
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <MicOff className="w-3.5 h-3.5 text-red-400" />
          )}

          {cameraEnabled ? (
            <Video className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <VideoOff className="w-3.5 h-3.5 text-red-400" />
          )}
        </div>
      </div>
    </div>
  );
};

export const RoomVideoPanel: React.FC<RoomVideoPanelProps> = ({
  isOpen,
  onClose,
  roomId,
  user,
  role,
  socket,
  onCallStateChange,
}) => {
  const {
    isInCall,
    isJoining,
    localStream,
    cameraEnabled,
    microphoneEnabled,
    remoteParticipants,
    error,
    joinCall,
    leaveCall,
    toggleCamera,
    toggleMicrophone,
  } = useWebRTC(roomId, user, role, socket);

  useEffect(() => {
    if (onCallStateChange) {
      onCallStateChange(isInCall);
    }
  }, [isInCall, onCallStateChange]);

  const isReadOnlyViewer = role === 'VIEWER';

  return (
    <div
      className={
        isOpen
          ? 'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md transition-all'
          : 'hidden'
      }
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose(); // Close modal on backdrop click without leaving call
        }
      }}
    >
      <div className="w-[85vw] max-w-6xl max-h-[85vh] bg-[#12141a] border border-border-subtle rounded-2xl overflow-hidden text-xs font-mono select-none shadow-2xl flex flex-col">
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-border-subtle bg-bg-secondary flex items-center justify-between">
          <div className="flex items-center gap-3 font-bold text-white text-sm">
            <Video className="w-5 h-5 text-replit-orange" />
            <span>Real-Time Video Call</span>

            {isInCall && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Call Active
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-bg-surface transition-colors"
            title="Close View (Call Remains Active)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Video Viewport Grid */}
        <div className="p-5 bg-[#0d0f14] min-h-[350px] max-h-[68vh] overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {!isInCall && !isJoining && (
            <div className="text-center py-16 space-y-4">
              <Video className="w-12 h-12 mx-auto text-replit-orange opacity-80" />
              <div>
                <p className="text-white font-semibold text-base">Join Peer-to-Peer Video Call</p>
                <p className="text-text-muted text-xs mt-1 max-w-md mx-auto leading-relaxed">
                  {isReadOnlyViewer
                    ? 'Viewers can watch remote video & listen to room audio'
                    : 'Connect camera and microphone for pair programming audio/video'}
                </p>
              </div>
              <button
                onClick={joinCall}
                className="btn-replit-primary py-2.5 px-6 text-xs inline-flex items-center gap-2 font-semibold shadow-lg"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Join Call</span>
              </button>
            </div>
          )}

          {isJoining && (
            <div className="flex flex-col items-center justify-center py-16 text-replit-orange gap-3">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-xs font-semibold">Requesting camera & microphone access...</span>
            </div>
          )}

          {isInCall && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Local User Tile */}
              <VideoTile
                stream={localStream}
                name={user.name}
                role={role}
                isLocal
                cameraEnabled={cameraEnabled}
                microphoneEnabled={microphoneEnabled}
              />

              {/* Remote Participants Tiles */}
              {remoteParticipants.map((p) => (
                <VideoTile
                  key={p.userId}
                  stream={p.stream}
                  name={p.name}
                  role={p.role}
                  cameraEnabled={p.cameraEnabled}
                  microphoneEnabled={p.microphoneEnabled}
                />
              ))}
            </div>
          )}
        </div>

        {/* Control Action Bar */}
        {isInCall && (
          <div className="px-5 py-3 border-t border-border-subtle bg-bg-secondary flex items-center justify-between flex-wrap gap-3">
            {isReadOnlyViewer ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-surface border border-border-subtle text-text-muted text-xs font-medium">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Viewer Mode (Watch-Only)
              </span>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  onClick={toggleMicrophone}
                  className={`py-2 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold transition-all ${
                    microphoneEnabled
                      ? 'bg-bg-surface text-white border border-border-subtle hover:bg-bg-secondary shadow-sm'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                  }`}
                >
                  {microphoneEnabled ? (
                    <>
                      <Mic className="w-4 h-4 text-emerald-400" /> Mic On
                    </>
                  ) : (
                    <>
                      <MicOff className="w-4 h-4" /> Mic Off
                    </>
                  )}
                </button>

                <button
                  onClick={toggleCamera}
                  className={`py-2 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold transition-all ${
                    cameraEnabled
                      ? 'bg-bg-surface text-white border border-border-subtle hover:bg-bg-secondary shadow-sm'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                  }`}
                >
                  {cameraEnabled ? (
                    <>
                      <Video className="w-4 h-4 text-emerald-400" /> Camera On
                    </>
                  ) : (
                    <>
                      <VideoOff className="w-4 h-4" /> Camera Off
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button
                onClick={leaveCall}
                className="py-2 px-4 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs font-semibold flex items-center gap-2 shadow-md transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Leave Call</span>
              </button>

              <button
                onClick={onClose}
                className="py-2 px-4 rounded-lg bg-bg-surface text-text-muted hover:text-white border border-border-subtle text-xs font-semibold transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
