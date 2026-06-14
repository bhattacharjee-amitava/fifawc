'use client';

import { useEffect } from 'react';

/**
 * Ported from the legacy app: a soft royalty-free tune (C major, 92 BPM, sine
 * voices with ADSR) that begins on the user's first interaction, per browser
 * autoplay policy. Self-contained; starts once and loops.
 *
 * NOTE: auto-starting audio is debatable UX — left intact for parity. Easy to
 * gate behind a user toggle later if we want.
 */
export function useAmbientTune(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    let ctx: AudioContext | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let nextAt = 0;

    const Q = 60 / 92; // seconds per beat

    // prettier-ignore
    const C3=130.81,F3=174.61,G3=196.0,A3=220.0,B3=246.94,C4=261.63,D4=293.66,
          E4=329.63,F4=349.23,G4=392.0,A4=440.0,B4=493.88,C5=523.25,E3=164.81;

    const MEL: Array<[number, number]> = [
      [E4, 1], [G4, 1], [A4, 1], [G4, 1], [E4, 2], [D4, 1], [C4, 1],
      [D4, 1], [F4, 1], [G4, 1], [A4, 1], [G4, 3], [E4, 1],
      [C5, 1], [B4, 1], [A4, 1], [G4, 1], [A4, 1], [G4, 1], [E4, 2],
      [F4, 1], [E4, 1], [D4, 1], [C4, 1], [C4, 4],
    ];
    const HAR: Array<[number, number]> = [
      [C4, 1], [E4, 1], [F4, 1], [E4, 1], [C4, 2], [B3, 1], [A3, 1],
      [B3, 1], [D4, 1], [E4, 1], [F4, 1], [E4, 3], [C4, 1],
      [A4, 1], [G4, 1], [F4, 1], [E4, 1], [F4, 1], [E4, 1], [C4, 2],
      [D4, 1], [C4, 1], [B3, 1], [A3, 1], [A3, 4],
    ];
    const BAS: Array<[number, number]> = [
      [C3, 2], [C3, 2], [C3, 2], [G3, 2], [G3, 2], [G3, 2], [G3, 2], [G3, 2],
      [A3, 2], [A3, 2], [A3, 2], [E3, 2], [F3, 2], [F3, 2], [C3, 2], [C3, 2],
    ];

    function note(freq: number, t: number, beats: number, vol: number) {
      if (!ctx) return;
      const dur = beats * Q;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.025);
      g.gain.setValueAtTime(vol * 0.78, t + 0.1);
      g.gain.setValueAtTime(vol * 0.78, t + dur - 0.08);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.06);
      o.start(t);
      o.stop(t + dur + 0.1);
    }

    function scheduleLoop() {
      if (!ctx) return;
      let t = nextAt;
      MEL.forEach((n) => { note(n[0], t, n[1], 0.22); t += n[1] * Q; });
      const len = MEL.reduce((s, n) => s + n[1] * Q, 0);

      let th = nextAt + 0.01;
      HAR.forEach((n) => { note(n[0], th, n[1], 0.1); th += n[1] * Q; });

      let tb = nextAt;
      BAS.forEach((n) => { note(n[0], tb, n[1], 0.08); tb += n[1] * Q; });

      nextAt += len;
      const ms = (nextAt - ctx.currentTime) * 1000 - 200;
      timer = setTimeout(scheduleLoop, Math.max(ms, 0));
    }

    function start() {
      if (ctx) return;
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new Ctor();
      nextAt = ctx.currentTime + 0.15;
      scheduleLoop();
    }

    const events: Array<keyof DocumentEventMap> = ['touchstart', 'click', 'keydown'];
    const handler = () => {
      start();
      events.forEach((ev) => document.removeEventListener(ev, handler));
    };
    events.forEach((ev) => document.addEventListener(ev, handler));

    return () => {
      events.forEach((ev) => document.removeEventListener(ev, handler));
      if (timer) clearTimeout(timer);
      if (ctx) ctx.close();
    };
  }, [enabled]);
}
