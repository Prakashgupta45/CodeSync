'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { ChatMessageDto, RoomPresenceUserDto } from '@codesync/shared';
import {
  MessageSquare,
  Send,
  X,
  Users,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

interface RoomChatPanelProps {
  roomId: string;
  user: {
    id: string;
    name: string;
  };
  socket: Socket | null;
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange: (count: number) => void;
  presenceUsers: RoomPresenceUserDto[];
}

export const RoomChatPanel: React.FC<RoomChatPanelProps> = ({
  roomId,
  user,
  socket,
  isOpen,
  onClose,
  onUnreadCountChange,
  presenceUsers,
}) => {
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'presence'>('chat');
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map()); // userId -> name

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unreadCountRef = useRef<number>(0);
  const isOpenRef = useRef<boolean>(isOpen);

  isOpenRef.current = isOpen;

  // Reset unread count when chat panel is opened
  useEffect(() => {
    if (isOpen) {
      unreadCountRef.current = 0;
      onUnreadCountChange(0);
    }
  }, [isOpen, onUnreadCountChange]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  const isUserScrolledUp = (): boolean => {
    if (!scrollContainerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    return scrollHeight - scrollTop - clientHeight > 100;
  };

  // Socket Event Listeners
  useEffect(() => {
    if (!socket) return;

    // 1. Request Chat History on mount or socket connection
    setIsLoadingHistory(true);
    socket.emit('chat:history', { roomId });

    const handleHistory = (data: { roomId: string; messages: ChatMessageDto[] }) => {
      if (data.roomId === roomId) {
        setMessages(data.messages || []);
        setIsLoadingHistory(false);
        setTimeout(() => scrollToBottom(false), 100);
      }
    };

    const handleIncomingMessage = (message: ChatMessageDto) => {
      if (message.roomId === roomId) {
        setMessages((prev) => [...prev, message]);

        // Increment unread count if panel is closed and message is from another user
        if (!isOpenRef.current && message.senderId !== user.id) {
          unreadCountRef.current += 1;
          onUnreadCountChange(unreadCountRef.current);
        }

        // Auto-scroll to bottom unless user is manually reading older messages
        if (!isUserScrolledUp()) {
          setTimeout(() => scrollToBottom(true), 50);
        }
      }
    };

    const handleUserTyping = (data: { userId: string; name: string }) => {
      if (data.userId !== user.id) {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(data.userId, data.name);
          return next;
        });
      }
    };

    const handleUserStopTyping = (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    };

    const handleError = (data: { message: string }) => {
      setErrorMessage(data.message || 'Chat error');
      setIsLoadingHistory(false);
    };

    socket.on('chat:history', handleHistory);
    socket.on('chat:message', handleIncomingMessage);
    socket.on('chat:user-typing', handleUserTyping);
    socket.on('chat:user-stop-typing', handleUserStopTyping);
    socket.on('chat:error', handleError);

    return () => {
      socket.off('chat:history', handleHistory);
      socket.off('chat:message', handleIncomingMessage);
      socket.off('chat:user-typing', handleUserTyping);
      socket.off('chat:user-stop-typing', handleUserStopTyping);
      socket.off('chat:error', handleError);
    };
  }, [socket, roomId, user.id, onUnreadCountChange, scrollToBottom]);

  // Emit typing indicator with 3-second auto-stop debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!socket) return;

    socket.emit('chat:typing', { roomId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('chat:stop-typing', { roomId });
    }, 2500);
  };

  const handleSendMessage = () => {
    const trimmed = inputText.trim();
    if (!trimmed || !socket) return;

    socket.emit('chat:send', { roomId, content: trimmed });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('chat:stop-typing', { roomId });

    setInputText('');
    setErrorMessage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Format typing text (e.g., "Rahul is typing..." or "Rahul and Priya are typing...")
  const renderTypingText = (): string | null => {
    const names = Array.from(typingUsers.values());
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]} and ${names.length - 1} others are typing...`;
  };

  if (!isOpen) return null;

  return (
    <div className="card-replit border border-border-subtle bg-[#12141a] flex flex-col w-full min-h-[380px] max-h-[460px] shadow-lg rounded-lg overflow-hidden text-xs font-sans select-none">
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-border-subtle bg-bg-secondary flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono">
          <MessageSquare className="w-4 h-4 text-replit-orange" />
          <h2 className="font-bold text-white text-xs uppercase tracking-wider">Room Workspace</h2>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center border-b border-border-subtle bg-bg-surface text-xs font-mono">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2.5 px-3 text-center border-b-2 font-medium transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'chat'
              ? 'border-replit-orange text-white bg-bg-secondary/40'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat
        </button>

        <button
          onClick={() => setActiveTab('presence')}
          className={`flex-1 py-2.5 px-3 text-center border-b-2 font-medium transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'presence'
              ? 'border-replit-orange text-white bg-bg-secondary/40'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          Online ({presenceUsers.length})
        </button>
      </div>

      {/* Tab Content 1: Chat Stream */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0e1117]">
          {/* Error Alert Banner */}
          {errorMessage && (
            <div className="p-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          )}

          {/* Scrollable Message List */}
          <div ref={scrollContainerRef} className="flex-1 p-3 overflow-y-auto space-y-3 font-mono">
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2 py-8">
                <Loader2 className="w-5 h-5 animate-spin text-replit-orange" />
                <span className="text-[11px]">Loading chat history...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2 py-12 text-center">
                <MessageSquare className="w-8 h-8 text-border-subtle" />
                <p className="text-xs font-semibold text-gray-300">No messages yet</p>
                <p className="text-[11px] text-gray-500">Send a message to start room chat!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[88%] ${
                      isMe ? 'ml-auto' : 'mr-auto'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-text-muted">
                      <span className={`font-semibold ${isMe ? 'text-replit-orange' : 'text-gray-300'}`}>
                        {isMe ? 'You' : msg.senderName}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div
                      className={`p-2.5 rounded-lg text-xs break-words max-w-full ${
                        isMe
                          ? 'bg-replit-orange/20 border border-replit-orange/30 text-white rounded-br-none'
                          : 'bg-bg-secondary border border-border-subtle text-gray-200 rounded-bl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator Bar */}
          {renderTypingText() && (
            <div className="px-3 py-1 bg-bg-surface border-t border-border-subtle text-[11px] text-replit-orange font-mono flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>{renderTypingText()}</span>
            </div>
          )}

          {/* Input Box Bar */}
          <div className="p-3 border-t border-border-subtle bg-bg-surface flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-bg-secondary border border-border-subtle rounded px-3 py-2 text-xs text-white placeholder-text-muted focus:outline-none focus:border-replit-orange font-mono"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              className="p-2 rounded bg-replit-orange text-white hover:bg-replit-orange/90 disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Content 2: Presence List */}
      {activeTab === 'presence' && (
        <div className="flex-1 p-3 bg-[#0e1117] overflow-y-auto space-y-2 font-mono">
          <div className="text-[11px] text-text-muted mb-2 uppercase font-bold tracking-wider">
            Active Members ({presenceUsers.length})
          </div>

          {presenceUsers.length === 0 ? (
            <div className="text-center py-6 text-text-muted text-xs">No users online</div>
          ) : (
            presenceUsers.map((u) => (
              <div
                key={u.userId}
                className="flex items-center justify-between p-2 rounded bg-bg-secondary/60 border border-border-subtle"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-white font-medium">{u.name}</span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    u.role === 'OWNER'
                      ? 'bg-replit-orange/20 text-replit-orange'
                      : u.role === 'VIEWER'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-bg-surface text-text-muted border border-border-subtle'
                  }`}
                >
                  {u.role}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
