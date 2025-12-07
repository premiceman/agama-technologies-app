async function simulateSync(connection) {
  const label = connection?.provider || 'crm-provider';
  console.log('[integration] CRM sync simulated', {
    orgId: connection?.orgId?.toString?.() || connection?.orgId,
    provider: label
  });
  return {
    status: 'ok',
    summary: `CRM sync simulated for ${label}`
  };
}

module.exports = { simulateSync };
