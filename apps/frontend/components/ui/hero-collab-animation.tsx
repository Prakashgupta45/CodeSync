'use client';

import React, { useState } from 'react';
import { Users, Box, Sparkles, Terminal, Check } from 'lucide-react';

export default function HeroCollabAnimation() {
  const [activeTab, setActiveTab] = useState<'team' | 'ai'>('team');

  return (
    <div className="hero-collab-wrapper" aria-label="Interactive real-time collaboration preview">
      {/* Floating Badge: Top Right */}
      <div className="hero-floating-pill pill-top-right">
        <span className="live-ping-container">
          <span className="live-ping-ring" />
          <span className="live-ping-dot" />
        </span>
        <span className="pill-text"><strong>2 active</strong> · 0ms Yjs sync</span>
      </div>

      {/* Main Collaborative Showcase Card */}
      <div className="hero-collab-card">
        {/* Editor Window Mockup */}
        <div className="hero-collab-window">
          <div className="hero-collab-window-bar">
            <div className="window-dots-mini">
              <span className="dot-red" />
              <span className="dot-yellow" />
              <span className="dot-green" />
            </div>
            <span className="window-title-tab">
              <span className="file-icon">⚡</span>
              team-room.tsx
            </span>
            <span className="window-lang-tag">TypeScript</span>
          </div>

          <div className="hero-collab-window-body">
            {/* Line Numbers and Code */}
            <div className="hero-code-gutter">
              <span>01</span>
              <span>02</span>
              <span>03</span>
              <span>04</span>
            </div>

            <div className="hero-code-editor">
              <div className="code-line-row">
                <span className="code-kw-coral">const</span>{' '}
                <span className="code-var">solution</span> ={' '}
                <span className="code-fn">pair</span>(team);
              </div>
              <div className="code-line-row">
                <span className="code-kw-purple">await</span>{' '}
                <span className="code-var">solution</span>.<span className="code-fn-green">sync</span>();
              </div>
              <div className="code-line-row active-code-row">
                <span className="code-kw-blue">export default</span>{' '}
                <span className="code-var">solution</span>;
                <span className="hero-blinking-cursor" />
              </div>
              <div className="code-line-row text-muted-comment">
                <span className="comment-text">{'// Collaborative CRDT active'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Developer Avatar Left (Coding / Typing) */}
        <div className="collab-person hero-person-left">
          <span className="collab-head" />
          <span className="collab-body" />
          <span className="collab-arm hero-arm-animated-left" />
          <span className="person-tag-pill tag-left">Jamie (You)</span>
        </div>

        {/* Developer Avatar Right (Reviewing / Pair Programming) */}
        <div className="collab-person hero-person-right">
          <span className="collab-head" />
          <span className="collab-body" />
          <span className="collab-arm hero-arm-animated-right" />
          <span className="person-tag-pill tag-right">Alex (Peer)</span>
        </div>

        {/* Animated Diamond Sparks */}
        <span className="collab-spark hero-spark-one" />
        <span className="collab-spark hero-spark-two" />
        <span className="collab-spark hero-spark-three" />
      </div>

      {/* Floating Badge: Bottom Left */}
      <div className="hero-floating-pill pill-bottom-left">
        <Box className="w-3.5 h-3.5 text-replit-orange" />
        <span className="pill-text"><strong>Docker Runner:</strong> Isolated</span>
      </div>

      {/* Floating Badge: Bottom Right */}
      <div className="hero-floating-pill pill-bottom-right">
        <Sparkles className="w-3.5 h-3.5 text-replit-orange" />
        <span className="pill-text"><strong>AI Assistant:</strong> Active</span>
      </div>
    </div>
  );
}
