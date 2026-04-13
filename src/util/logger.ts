let _onchainOsCalls = 0;

export const logger = {
  info: (msg: string, data?: unknown) => {
    console.log(`[INFO] ${msg}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  },
  warn: (msg: string, data?: unknown) => {
    console.warn(`[WARN] ${msg}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  },
  error: (msg: string, data?: unknown) => {
    console.error(`[ERROR] ${msg}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  },
  onchainOs: (endpoint: string, status: number, durationMs: number) => {
    _onchainOsCalls++;
    console.log(`[ONCHAINOS] #${_onchainOsCalls} ${endpoint} → ${status} (${durationMs}ms)`);
  },
};

export function getOnchainOsCallCount() {
  return _onchainOsCalls;
}

export function resetOnchainOsCallCount() {
  _onchainOsCalls = 0;
}
