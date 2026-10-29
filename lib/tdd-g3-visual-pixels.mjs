/** PAP-1073: count visibly changed RGBA pixels without comparing PNG encodings. */
export function comparePixelBuffers(reference, rendered, { channels = 4, channelTolerance = 28 } = {}) {
  if (!reference || !rendered || reference.length !== rendered.length ||
      channels !== 4 || reference.length % channels !== 0 ||
      !Number.isInteger(channelTolerance) || channelTolerance < 0 || channelTolerance > 255) {
    throw Error("Invalid G3 visual comparison inputs");
  }
  let changed = 0;
  for (let offset = 0; offset < reference.length; offset += channels) {
    let max = 0;
    for (let channel = 0; channel < channels; channel++) {
      max = Math.max(max, Math.abs(reference[offset + channel] - rendered[offset + channel]));
    }
    if (max > channelTolerance) changed++;
  }
  const total = reference.length / channels;
  return { changed, total, ratio: total ? changed / total : 0 };
}
