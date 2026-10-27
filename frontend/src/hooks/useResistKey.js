import { useEffect } from "react";

// hold Space to steady against the luciferic lure
export function useResistKey(setControls) {
  useEffect(() => {
    const set = (v) => setControls((c) => (c.resist === v ? c : { ...c, resist: v }));
    const down = (ev) => {
      if (ev.code !== "Space") return;
      ev.preventDefault();
      if (!ev.repeat) set(true);
    };
    const up = (ev) => {
      if (ev.code !== "Space") return;
      ev.preventDefault();
      set(false);
    };
    const blur = () => set(false);
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", blur);
    };
  }, [setControls]);
}
