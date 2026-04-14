import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameRuntime } from '../engine/GameRuntime';
import {
  SHOT_METER_SWEET_SPOT_SIZE,
  SHOT_METER_SWEET_SPOT_START,
  SHOT_METER_SWEET_SPOT_TOP,
  type ShotReleaseQuality,
} from '../engine/shotTiming';

const RELEASE_FLASH_MS = 560;
const MARKER_CHASE_RATE = 28;

interface ShotMeterFlash {
  version: number;
  quality: ShotReleaseQuality;
  value: number;
  label: string;
}

function approach(current: number, target: number, dt: number, rate: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

function getReleaseLabel(quality: ShotReleaseQuality): string {
  if (quality === 'perfect') return 'GREEN';
  return quality === 'early' ? 'EARLY' : 'LATE';
}

export function ShotMeter({ runtime }: { runtime: GameRuntime }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const visibleRef = useRef(false);
  const markerValueRef = useRef(0);
  const flashRef = useRef<ShotMeterFlash | null>(null);
  const lastReleaseVersionRef = useRef(0);
  const clearFlashTimerRef = useRef<number | null>(null);
  const [view, setView] = useState<{ visible: boolean; flash: ShotMeterFlash | null }>({
    visible: false,
    flash: null,
  });

  const meterStyle = useMemo<CSSProperties>(() => ({
    ['--shot-meter-sweetspot-start' as string]: `${SHOT_METER_SWEET_SPOT_START * 100}%`,
    ['--shot-meter-sweetspot-size' as string]: `${SHOT_METER_SWEET_SPOT_SIZE * 100}%`,
  }), []);

  useEffect(() => {
    function syncView(nextVisible: boolean, nextFlash: ShotMeterFlash | null): void {
      visibleRef.current = nextVisible;
      setView((current) => {
        const sameFlash =
          current.flash?.version === nextFlash?.version &&
          current.flash?.quality === nextFlash?.quality;
        if (current.visible === nextVisible && sameFlash) return current;
        return { visible: nextVisible, flash: nextFlash };
      });
    }

    const root = rootRef.current;
    if (!root) return;

    let rafId = 0;
    let lastTimestamp = 0;

    const frame = (timestamp: number) => {
      const snapshot = runtime.getRenderState();
      const dt = lastTimestamp > 0 ? Math.min((timestamp - lastTimestamp) / 1000, 0.05) : 1 / 60;
      lastTimestamp = timestamp;

      if (
        snapshot.shotReleaseVersion > 0 &&
        snapshot.shotReleaseVersion !== lastReleaseVersionRef.current &&
        snapshot.shotReleaseQuality
      ) {
        lastReleaseVersionRef.current = snapshot.shotReleaseVersion;
        const nextFlash: ShotMeterFlash = {
          version: snapshot.shotReleaseVersion,
          quality: snapshot.shotReleaseQuality,
          value: snapshot.shotReleaseValue,
          label: getReleaseLabel(snapshot.shotReleaseQuality),
        };
        flashRef.current = nextFlash;
        syncView(true, nextFlash);

        if (clearFlashTimerRef.current !== null) {
          window.clearTimeout(clearFlashTimerRef.current);
        }

        clearFlashTimerRef.current = window.setTimeout(() => {
          flashRef.current = null;
          const stillVisible = runtime.getRenderState().shotMeterVisible;
          syncView(stillVisible, null);
          clearFlashTimerRef.current = null;
        }, RELEASE_FLASH_MS);
      }

      const activeFlash = flashRef.current;
      const targetValue = snapshot.shotMeterVisible ? snapshot.shotMeterValue : activeFlash?.value ?? 0;
      const nextVisible = snapshot.shotMeterVisible || activeFlash !== null;

      if (nextVisible !== visibleRef.current) {
        syncView(nextVisible, activeFlash);
      }

      markerValueRef.current = approach(
        markerValueRef.current,
        targetValue,
        dt,
        snapshot.shotMeterVisible ? MARKER_CHASE_RATE : 18,
      );

      root.style.setProperty('--shot-meter-value', markerValueRef.current.toFixed(4));
      root.dataset.live = snapshot.shotMeterVisible ? 'true' : 'false';

      if (markerValueRef.current >= SHOT_METER_SWEET_SPOT_START && markerValueRef.current <= SHOT_METER_SWEET_SPOT_TOP) {
        root.dataset.range = 'sweet';
      } else if (markerValueRef.current > SHOT_METER_SWEET_SPOT_TOP) {
        root.dataset.range = 'late';
      } else {
        root.dataset.range = 'normal';
      }

      root.dataset.feedback = activeFlash?.quality ?? 'none';
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (clearFlashTimerRef.current !== null) {
        window.clearTimeout(clearFlashTimerRef.current);
      }
    };
  }, [runtime]);

  return (
    <div
      ref={rootRef}
      className={[
        'shot-meter',
        view.visible ? 'shot-meter--visible' : '',
        view.flash ? 'shot-meter--release' : '',
        view.flash ? `shot-meter--${view.flash.quality}` : '',
      ].filter(Boolean).join(' ')}
      style={meterStyle}
      aria-hidden="true"
    >
      <div className="shot-meter__shell">
        <div className="shot-meter__track">
          <div className="shot-meter__track-core">
            <div className="shot-meter__track-well" />
            <div className="shot-meter__track-grid" />
            <div className="shot-meter__fill" />
            <div className="shot-meter__sweetspot" />
          </div>
        </div>
        <div className="shot-meter__frame" />
      </div>

      {view.flash ? (
        <div
          key={`burst-${view.flash.version}`}
          className={`shot-meter__burst shot-meter__burst--${view.flash.quality}`}
        />
      ) : null}

      {view.flash ? (
        <div
          key={`label-${view.flash.version}`}
          className={`shot-meter__release-label shot-meter__release-label--${view.flash.quality}`}
        >
          {view.flash.label}
        </div>
      ) : null}
    </div>
  );
}
