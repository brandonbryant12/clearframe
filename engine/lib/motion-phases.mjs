// Editorial timing for deterministic, qualitative pose functions. Not a simulation clock.
const fail = message => { throw new Error(`Motion phases: ${message}`); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const roles = new Set(['anticipation', 'action', 'settle', 'hold', 'cycle']);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const ceilFrame = value => Math.ceil(value - 1e-9);

export function validateMotionContract(contract, loop) {
  if (!object(contract) || contract.version !== 1 || contract.clock !== 'qualitative-pose') fail('expected version 1 qualitative-pose contract');
  if (!Array.isArray(contract.phases) || !contract.phases.length || contract.phases.length > 16) fail('provide 1–16 phases');
  const ids = new Set(); let end = 0;
  for (const phase of contract.phases) {
    if (!object(phase) || typeof phase.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(phase.id) || ids.has(phase.id)) fail('phase IDs must be unique lowercase names');
    ids.add(phase.id);
    if (!roles.has(phase.role) || !finite(phase.start) || !finite(phase.end) || phase.start !== end || phase.end <= phase.start || phase.end > 1) fail(`${phase.id}: intervals must partition [0,1] in order`);
    if (!finite(phase.minSeconds) || phase.minSeconds < 0 || phase.minSeconds > 12) fail(`${phase.id}: invalid minimum duration`);
    end = phase.end;
  }
  if (end !== 1 || typeof loop !== 'boolean') fail('phases must end at 1 and loop intent must be explicit');
  if (contract.phases.some(p => p.role === 'cycle') && (!loop || contract.phases.length !== 1)) fail('a cycle is one full looping interval');
  return contract;
}

export function motionManifest(contract, { frames, fps, loop, phaseSeconds } = {}) {
  validateMotionContract(contract, loop);
  if (!Number.isInteger(fps) || fps < 12 || fps > 60 || !Number.isInteger(frames) || frames < fps || frames > 30 * fps) fail('use 12–60 integer fps and 1–30 seconds of frames');
  if (phaseSeconds !== undefined) {
    if (!object(phaseSeconds) || Object.keys(phaseSeconds).length !== contract.phases.length || contract.phases.some(p => !finite(phaseSeconds[p.id]) || phaseSeconds[p.id] <= 0)) fail('phaseSeconds must give positive seconds for every phase, with no extra names');
  }
  const total = phaseSeconds && Object.values(phaseSeconds).reduce((a, b) => a + b, 0);
  if (phaseSeconds && (total < 1 - 1e-9 || total > 30 + 1e-9 || Math.round(total * fps) !== frames)) fail('phase durations must match the requested frame count and total 1–30 seconds');
  let elapsed = 0, priorEnd = 0;
  const phases = contract.phases.map((p, index) => {
    elapsed += phaseSeconds ? phaseSeconds[p.id] : 0;
    const startFrame = priorEnd;
    const endFrame = index === contract.phases.length - 1 ? frames : phaseSeconds ? Math.round(elapsed * fps) : ceilFrame(p.end * frames);
    if (endFrame <= startFrame || endFrame - startFrame < ceilFrame(p.minSeconds * fps)) fail(`${p.id}: too short after frame quantization`);
    priorEnd = endFrame;
    return { ...p, startFrame, endFrame, startSeconds: startFrame / fps, endSeconds: endFrame / fps, duration: (endFrame - startFrame) / fps };
  });
  // Baked Blender frame 1 corresponds to encoded/source frame 0. The final
  // entry is an unencoded endpoint used to prove loop transform closure.
  const poseSamples = Array.from({ length: frames + 1 }, (_, frame) => {
    if (frame === frames) return 1;
    if (!phaseSeconds) return frame / frames; // Preserve existing choreography exactly.
    const p = phases.find(p => frame >= p.startFrame && frame < p.endFrame);
    return p.start + (p.end - p.start) * (frame - p.startFrame) / (p.endFrame - p.startFrame);
  });
  return { version: 1, clock: contract.clock, frameConvention: 'zero-based half-open; endpoint at frames is baked but not encoded',
    fps, frames, duration: frames / fps, loopIntent: loop, timing: phaseSeconds ? 'phase-retimed-pose' : 'original-normalized-pose',
    phases, poseSamples, safeTrimWindows: phases.filter(p => p.role === 'hold').map(p => ({ id: p.id, startFrame: p.startFrame, endFrame: p.endFrame })),
    limitations: 'Authored qualitative pose timing, not measured time or a new simulation. Holds and loop seams require rendered review.' };
}

// Plan frame selection from an EXISTING encoded clip. This does not render it,
// modify a storyboard, synthesize intermediate poses, or change a simulation.
export function planClipRetiming(manifest, { startFrame = 0, endFrame = manifest?.frames, rate = 1, outputFps = manifest?.fps, readHoldSeconds = 0 } = {}) {
  if (!object(manifest) || manifest.version !== 1 || manifest.clock !== 'qualitative-pose') fail('invalid manifest');
  const contract = { version: 1, clock: manifest.clock, phases: manifest.phases?.map(({ id, role, start, end, minSeconds }) => ({ id, role, start, end, minSeconds })) };
  // Rebuild frame/phase consistency instead of trusting a caller-edited sidecar.
  const phaseSeconds = manifest.timing === 'phase-retimed-pose' ? Object.fromEntries(manifest.phases.map(p => [p.id, p.duration])) : undefined;
  const checked = motionManifest(contract, { frames: manifest.frames, fps: manifest.fps, loop: manifest.loopIntent, phaseSeconds });
  if (JSON.stringify(checked.phases) !== JSON.stringify(manifest.phases) || JSON.stringify(checked.poseSamples) !== JSON.stringify(manifest.poseSamples) || manifest.duration !== checked.duration || !['original-normalized-pose', 'phase-retimed-pose'].includes(manifest.timing)) fail('manifest timing differs from its contract');
  if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame) || startFrame < 0 || endFrame > manifest.frames || startFrame >= endFrame) fail('invalid source frame interval');
  if (!finite(rate) || rate < 0.25 || rate > 4 || !Number.isInteger(outputFps) || outputFps < 12 || outputFps > 60 || !finite(readHoldSeconds) || readHoldSeconds < 0 || readHoldSeconds > 12) fail('rate must be 0.25–4, fps 12–60, reading hold 0–12 seconds');
  const holds = checked.phases.filter(p => p.role === 'hold');
  if (startFrame !== 0 && !holds.some(p => startFrame >= p.startFrame && startFrame < p.endFrame)) fail('start trim must be inside a declared hold');
  if (endFrame !== manifest.frames && !holds.some(p => endFrame > p.startFrame && endFrame <= p.endFrame)) fail('end trim must be inside a declared hold');
  for (const p of checked.phases.filter(p => p.role !== 'hold')) {
    if (startFrame > p.startFrame || endFrame < p.endFrame) fail(`trim would remove ${p.id}`);
  }
  const count = endFrame - startFrame, outputFrames = Math.round(count / manifest.fps / rate * outputFps);
  if (outputFrames < 1 || outputFrames > 2880) fail('retimed clip must contain 1–2880 output frames');
  const sourceFrames = Array.from({ length: outputFrames }, (_, i) => startFrame + Math.floor(i * count / outputFrames));
  const phases = checked.phases.map(p => {
    const indices = sourceFrames.flatMap((f, i) => f >= p.startFrame && f < p.endFrame ? [i] : []);
    const duration = indices.length / outputFps;
    if (duration + 1e-9 < p.minSeconds || (p.role !== 'hold' && !indices.length)) fail(`playback removes or shortens ${p.id} below its minimum`);
    return { id: p.id, role: p.role, startFrame: indices[0] ?? null, endFrame: indices.length ? indices.at(-1) + 1 : null, duration };
  });
  const last = phases.at(-1);
  if (readHoldSeconds && (last.role !== 'hold' || last.duration + 1e-9 < readHoldSeconds)) fail('final reading hold is too short');
  return { version: 1, operation: 'encoded-frame-selection-plan', sourceFps: manifest.fps, startFrame, endFrame,
    requestedRate: rate, effectiveRate: count / manifest.fps / (outputFrames / outputFps), outputFps, outputFrames, duration: outputFrames / outputFps,
    sourceFrames, sourceSeconds: sourceFrames.map(f => f / manifest.fps), phases,
    loopIntent: manifest.loopIntent && startFrame === 0 && endFrame === manifest.frames,
    limitations: 'Planning only. Repeats or drops existing encoded frames; no interpolation, simulation or claim of measured source time. Review playback and any loop seam after applying.' };
}
