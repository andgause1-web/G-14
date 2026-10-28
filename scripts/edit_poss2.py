import os
os.chdir('/app/frontend/src')
def ed(p, a, b):
    s=open(p).read(); assert a in s, (p,a[:70]); open(p,'w').write(s.replace(a,b,1))
for P, scene, opts in [('pages/VisorPage.jsx','city',''),('pages/HallwayPage.jsx','hallway',', { yawMax: 35, pitchMax: 15 }')]:
    ed(P,'import { TapeDeck } from "@/components/telemetry/TapeDeck";','import { TapeDeck } from "@/components/telemetry/TapeDeck";\nimport { PossessionHud } from "@/components/hud/PossessionHud";\nimport { useHeadLook } from "@/hooks/useHeadLook";\nimport { usePossessionAudio } from "@/hooks/usePossessionAudio";')
    ed(P,'''  useBodyAudio(frameRef, controls.bodyAudio, controls.bodyVol);''','''  useBodyAudio(frameRef, controls.bodyAudio, controls.bodyVol);
  usePossessionAudio(frameRef, controls.bodyAudio, controls.bodyVol);
  useHeadLook(setControls, frameRef%s);''' % opts)
    ed(P,f'''      <TapeDeck engine={{engine}} scene="{scene}" />''',f'''      <PossessionHud frame={{frame}} />
      <TapeDeck engine={{engine}} scene="{scene}" />''')
H='pages/HallwayPage.jsx'
ed(H,'''// W / ↑ = walk, +Shift = sprint, C = crouch, X = prone
function useRunKeys(active, setControls) {''','''// W = walk, +Shift = sprint, C = crouch, X = prone; run keys pass the possession input filter
function useRunKeys(active, setControls, frameRef) {''')
ed(H,'''    const push = () => setControls((c) => ({ ...c, keyRun: keys.w ? (keys.shift ? RUN.sprint : RUN.walk) : null }));''','''    const push = () => {
      const v = keys.w ? (keys.shift ? RUN.sprint : RUN.walk) : null;
      const lag = frameRef.current.possession?.lag_ms ?? 0;
      const apply = () => setControls((c) => ({ ...c, keyRun: v }));
      if (lag > 0) setTimeout(apply, lag);
      else apply();
    };''')
ed(H,'''      if (k === "w" || k === "arrowup") { keys.w = true; push(); }''','''      if (k === "w") { keys.w = true; push(); }''')
ed(H,'''      if (k === "w" || k === "arrowup") keys.w = false;''','''      if (k === "w") keys.w = false;''')
ed(H,'''  }, [active, setControls]);''','''  }, [active, setControls, frameRef]);''')
ed(H,'''  useRunKeys(controls.run === "manual", setControls);''','''  useRunKeys(controls.run === "manual", setControls, frameRef);''')
ed('components/panels/HallwayPanel.jsx','Manual: W / ↑ walk,','Manual: W walk,')
ed('components/panels/SensorPanel.jsx','label="Footstep + breathing audio"','label="Body + possession audio (footsteps, breath, bone-conduction cues)"')
ed('pages/VisorPage.jsx','· HOLD SPACE TO STEADY ·','· DRAG / ARROWS TO LOOK · HOLD SPACE TO STEADY ·')
print('ok')
