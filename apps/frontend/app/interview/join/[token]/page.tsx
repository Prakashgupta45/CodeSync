'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  getInterviewByToken,
  fetchInterviewByTokenAsync,
  createFallbackInterview,
  saveInterview,
  InterviewItem,
} from '../../../../lib/interview-service';
import {
  ShieldCheck,
  Clock,
  Video,
  Mic,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Code2,
  Bot,
  Sparkles,
  ChevronRight,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';

export default function CandidateJoinPage() {
  const params = useParams();
  const token = (params?.token as string) || '';
  const router = useRouter();

  const [interview, setInterview] = useState<InterviewItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Device Permissions State
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [isTestingDevices, setIsTestingDevices] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const savedTheme = (localStorage.getItem('codesync-theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    const initInterview = async () => {
      // 1. Try server API first
      let data = await fetchInterviewByTokenAsync(token);
      // 2. Try local cache
      if (!data) {
        data = getInterviewByToken(token);
      }

      if (data) {
        setInterview(data);
      }
      setLoading(false);
    };

    initInterview();
  }, [token]);

  // Request Camera & Mic honestly (never spoof success when denied)
  const handleTestDevices = async () => {
    setIsTestingDevices(true);
    setDeviceError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser mediaDevices API is unavailable in this context.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setHasCameraPermission(stream.getVideoTracks().length > 0);
      setHasMicPermission(stream.getAudioTracks().length > 0);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: unknown) {
      setHasCameraPermission(false);
      setHasMicPermission(false);
      setDeviceError(
        err instanceof Error
          ? err.message
          : 'Camera or microphone permission was denied or hardware is unavailable.'
      );
    } finally {
      setIsTestingDevices(false);
    }
  };

  const handleStartInterview = () => {
    const targetToken = interview?.token || token;
    router.push(`/interview/session/${targetToken}`);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('codesync-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  if (loading) {
    return (
      <div className="iw-candidate-landing-wrap">
        <div className="iw-candidate-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p>Loading your technical interview invitation...</p>
        </div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="iw-candidate-landing-wrap">
        <div className="iw-candidate-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <AlertCircle size={44} color="#ef4444" style={{ margin: '0 auto 14px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px' }}>
            Invitation Link Not Found or Expired
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '420px', margin: '0 auto 20px' }}>
            We could not verify this interview invitation token. Please check the URL or contact your hiring recruiter.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link href="/interview" className="iw-btn-primary" style={{ textDecoration: 'none' }}>
              Go to Interview Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`iw-candidate-landing-wrap ${theme === 'dark' ? 'dark' : 'light'}`}>
      {/* Top Simple Header */}
      <header className="iw-candidate-header">
        <div className="brand" style={{ letterSpacing: '-0.8px', fontSize: '18px', fontWeight: 800 }}>
          Code<span>Sync</span> <span className="iw-badge-sm">Assessment</span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="iw-icon-btn"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </header>

      {/* Main Candidate Card */}
      <main className="iw-candidate-container">
        <div className="iw-candidate-card">
          {/* Header Ribbon */}
          <div className="iw-candidate-card-top">
            <div className="iw-ribbon-tag">
              <ShieldCheck size={14} color="#10b981" />
              <span>Verified Interview Invitation</span>
            </div>
            <h1>Welcome, {interview.candidateName}!</h1>
            <p className="iw-sub-lead">
              You are invited to take the technical assessment for <strong>{interview.role}</strong> at CodeSync AI.
            </p>
          </div>

          {/* Quick Info Grid */}
          <div className="iw-candidate-info-grid">
            <div className="info-box">
              <span className="lbl">Assessment Title</span>
              <strong>{interview.title}</strong>
            </div>

            <div className="info-box">
              <span className="lbl">Duration</span>
              <strong>
                <Clock size={13} style={{ display: 'inline', marginRight: '4px' }} />
                {interview.duration} Minutes
              </strong>
            </div>

            <div className="info-box">
              <span className="lbl">Difficulty</span>
              <strong className="text-replit-orange">{interview.difficulty} Level</strong>
            </div>

            <div className="info-box">
              <span className="lbl">Permitted Languages</span>
              <div className="iw-lang-pills-row">
                {interview.permittedLanguages.map((l) => (
                  <span key={l} className="iw-lang-pill">
                    {l.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Instructions & Code of Conduct */}
          <div className="iw-instructions-box">
            <h3>Assessment Overview &amp; Instructions</h3>
            <p className="inst-p">{interview.instructions}</p>

            <ul className="inst-bullets">
              <li>
                <strong>Monaco Editor:</strong> Your workspace includes complete syntax highlighting, line numbers, and language templates for your configured languages.
              </li>
              <li>
                <strong>AI Interviewer Proctor:</strong> Explain your initial approach and Big-O reasoning before writing code. The AI Interviewer is ready to discuss logic and complexity.
              </li>
              <li>
                <strong>Real-Time Code Execution:</strong> You can test your code against visible test cases anytime by clicking <strong>Run Tests</strong>.
              </li>
              <li>
                <strong>Confidential Evaluation:</strong> Hidden test cases will run securely when you click <strong>Submit Solution</strong>.
              </li>
            </ul>
          </div>

          {/* Device Verification (If Video/Audio Proctoring Enabled) */}
          {interview.aiSettings.enableVideoProctor && (
            <div className="iw-device-check-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Laptop size={16} color="#ff5c00" />
                  <strong>Device &amp; Proctor Check</strong>
                </div>
                {hasCameraPermission && (
                  <span className="text-green-500 font-bold text-xs" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={14} /> Ready
                  </span>
                )}
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                This interview has proctoring enabled. Please ensure your camera and microphone are accessible.
              </p>

              {hasCameraPermission && hasMicPermission ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '120px', height: '80px', borderRadius: '6px', background: '#000', objectFit: 'cover' }}
                  />
                  <div style={{ fontSize: '12px', color: '#10b981' }}>
                    ✓ Camera and Microphone stream verified!
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {deviceError && (
                    <div style={{ fontSize: '12px', color: '#f87171' }}>
                      ⚠ {deviceError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleTestDevices}
                    disabled={isTestingDevices}
                    className="iw-btn-secondary"
                    style={{ width: 'fit-content' }}
                  >
                    <Video size={14} />
                    <span>{isTestingDevices ? 'Checking Devices...' : 'Verify Camera & Mic'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Start Interview Action */}
          <div className="iw-candidate-footer">
            <button
              type="button"
              onClick={handleStartInterview}
              className="iw-btn-start-interview"
            >
              <span>Start Technical Interview</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
