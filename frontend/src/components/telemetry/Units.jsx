export const U = ({ children }) => <small className="u-label">{children}</small>;

// small "SIM" tag when any of the channels behind a readout fell back to simulation
export const SimTag = ({ frame, ch }) => {
  const chs = Array.isArray(ch) ? ch : [ch];
  const fb = chs.filter((c) => frame.telemetry?.[c]?.fallback);
  return fb.length ? <small className="sim-tag" data-testid={`sim-tag-${chs[0]}`} title={`${fb.join(", ")} fell back to SIM`}>SIM</small> : null;
};
