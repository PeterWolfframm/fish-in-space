// pixelgen: a small network that learns from swipes what makes a sprite beautiful, and a procgen
// hook that renders every roll at its best. See features.js, net.js, dataset.js, beautify.js.

export { featurize, aesthetics, still, layout, schema, hasStyle, AESTHETIC } from './features.js';
export { Net, train, fineTune } from './net.js';
export { toRows, newNet, fit, evaluate } from './dataset.js';
export { beautify, pickGood, qualityFloor, score, scoreBoth, blend, insights } from './beautify.js';
