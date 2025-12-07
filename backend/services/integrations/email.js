async function simulateSync(connection) {
  const label = connection?.provider || 'email';
  console.log('[integration] Email sync simulated', {
    orgId: connection?.orgId?.toString?.() || connection?.orgId,
    provider: label
  });
  return {
    status: 'ok',
    summary: `Email/calendar sync simulated for ${label}`
  };
}

module.exports = { simulateSync };
