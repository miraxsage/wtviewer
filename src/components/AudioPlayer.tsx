"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface AudioPlayerProps {
  src: string;
}

/** Simple hash from string to produce consistent pseudo-random bar heights. */
function seedFromUrl(url: string): number {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (h * 31 + url.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Generate an array of bar heights (0.2 – 1.0) seeded from the URL. */
function generateBars(url: string, count: number): number[] {
  let seed = seedFromUrl(url);
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    // Simple LCG (linear congruential generator)
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const val = (seed % 80) / 100 + 0.2; // range 0.2 – 1.0
    bars.push(val);
  }
  return bars;
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="3" width="5" height="18" rx="1" />
      <rect x="14" y="3" width="5" height="18" rx="1" />
    </svg>
  );
}

const BAR_COUNT = 40;

export default function AudioPlayer({ src }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsContainerRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const bars = useRef(generateBars(src, BAR_COUNT)).current;

  const progress = duration > 0 ? currentTime / duration : 0;

  /* ---- Audio event handlers ---- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        // autoplay may be blocked
      }
    }
  }, [playing]);

  /** Click on waveform to seek */
  const handleWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      const container = barsContainerRef.current;
      if (!audio || !container || !duration) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      audio.currentTime = ratio * duration;
      setCurrentTime(audio.currentTime);
    },
    [duration]
  );

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-2.5 py-2 min-w-[220px] max-w-[280px]"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      {/* Hidden audio element */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
        style={{
          background: "var(--text-accent)",
          color: "#fff",
        }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* Waveform progress */}
      <div
        ref={barsContainerRef}
        className="flex-1 flex items-center gap-px h-6 cursor-pointer"
        onClick={handleWaveformClick}
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {bars.map((height, i) => {
          const barProgress = i / bars.length;
          const isFilled = barProgress < progress;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-colors"
              style={{
                height: `${height * 100}%`,
                minWidth: "2px",
                background: isFilled
                  ? "var(--text-accent)"
                  : "rgba(255,255,255,0.15)",
              }}
            />
          );
        })}
      </div>

      {/* Time display */}
      <span
        className="flex-shrink-0 text-[11px] tabular-nums whitespace-nowrap"
        style={{ color: "var(--text-secondary)" }}
      >
        {formatDuration(currentTime)} / {formatDuration(duration)}
      </span>
    </div>
  );
}
