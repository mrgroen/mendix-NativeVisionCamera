const base = require("@mendix/pluggable-widgets-tools/configs/eslint.ts.base.json");

// Remove jest/globals env and jest plugin — incompatible with Node 22 / ESLint 8 in this setup
const { "jest/globals": _jestGlobals, ...envWithoutJest } = base.env;
const pluginsWithoutJest = (base.plugins || []).filter(p => p !== "jest");
const rulesWithoutJest = Object.fromEntries(Object.entries(base.rules || {}).filter(([k]) => !k.startsWith("jest/")));

module.exports = {
    ...base,
    env: envWithoutJest,
    plugins: pluginsWithoutJest,
    rules: rulesWithoutJest
};
