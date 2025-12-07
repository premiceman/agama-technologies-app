async function simulateSync(connection) {
  const label = connection?.provider || 'gong';
  console.log('[integration] Gong sync simulated', {
    orgId: connection?.orgId?.toString?.() || connection?.orgId,
    provider: label
  });
  return {
    status: 'ok',
    summary: `Gong sync simulated for ${label}`
  };
}

module.exports = { simulateSync };
