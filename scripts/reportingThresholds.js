// Manual duplicate of the warning-level thresholds hardcoded in
// scripts/reporting/insights_engine.py (Tot/Rsp/Usr branches). Keep the two in
// sync by hand — cross-language sharing (e.g. a JSON file both sides read) is a
// reasonable future refactor but out of scope for now; thresholds rarely change.
export const THRESHOLDS = {
  Tot: 70, // CPU % — insights_engine.py: `abs_max > 70`
  Rsp: 2.0, // seconds — insights_engine.py: `abs_max > 2.0`
  Usr: 50, // faults/sec — insights_engine.py: `abs_max > 50`
};
