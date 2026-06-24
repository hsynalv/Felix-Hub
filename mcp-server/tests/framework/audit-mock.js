/**
 * Shared audit test helpers — secrets.store local audit vs core auditLog
 */

const auditEntries = [];

export function resetAuditMock() {
  auditEntries.length = 0;
}

export function mockAuditEntry(entry) {
  const logEntry = { timestamp: new Date().toISOString(), ...entry };
  auditEntries.push(logEntry);
  return logEntry;
}

export function getMockAuditEntries(limit = 100) {
  return auditEntries.slice(-limit);
}
