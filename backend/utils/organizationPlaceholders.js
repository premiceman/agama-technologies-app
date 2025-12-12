const mongoose = require('mongoose');

// Stable placeholder used when an organization is required but should not scope data access.
const PUBLIC_ORGANIZATION_PLACEHOLDER_ID = new mongoose.Types.ObjectId('000000000000000000000000');

function usePublicOrganization(value) {
  return value || PUBLIC_ORGANIZATION_PLACEHOLDER_ID;
}

module.exports = {
  PUBLIC_ORGANIZATION_PLACEHOLDER_ID,
  usePublicOrganization
};
