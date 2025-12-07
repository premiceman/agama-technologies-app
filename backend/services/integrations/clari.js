async function simulateSync(connection) {
  const label = connection?.provider || 'clari';
  console.log('[integration] Clari sync simulated', {
    orgId: connection?.orgId?.toString?.() || connection?.orgId,
    provider: label
  });
  return {
    status: 'ok',
    summary: `Clari sync simulated for ${label}`
  };
}

module.exports = { simulateSync };
