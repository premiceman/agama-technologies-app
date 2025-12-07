const RevenueAccount = require('../models/RevenueAccount');
const ProcurementVendor = require('../models/ProcurementVendor');
const EngagementRoom = require('../models/EngagementRoom');
const BuyerValueAssessment = require('../models/BuyerValueAssessment');

function buildEmptyOverview() {
  return {
    vendor: null,
    buyer: null,
    shared: null
  };
}

async function getDashboardOverview({ organization, user, permissions }) {
  const overview = buildEmptyOverview();

  if (permissions?.vendorSuiteAccess) {
    const [revenueAccountCount, sellerAssessmentsCount] = await Promise.all([
      RevenueAccount.countDocuments({ userId: user._id }),
      BuyerValueAssessment.countDocuments({ createdBy: user._id, organization: null })
    ]);

    overview.vendor = {
      revenueAccounts: { total: revenueAccountCount },
      valueSphere: { sellerAssessments: sellerAssessmentsCount }
    };
  }

  if (permissions?.buyerSuiteAccess) {
    const [procurementVendorCount, buyerAssessmentsCount] = await Promise.all([
      ProcurementVendor.countDocuments({ organization: organization._id }),
      BuyerValueAssessment.countDocuments({ organization: organization._id })
    ]);

    overview.buyer = {
      procurementVendors: { total: procurementVendorCount },
      valueSphere: { buyerAssessments: buyerAssessmentsCount }
    };
  }

  if (permissions?.sharedSuiteAccess) {
    const engagementRoomCount = await EngagementRoom.countDocuments({
      $or: [{ vendorOrg: organization._id }, { buyerOrg: organization._id }]
    });

    overview.shared = {
      engagementRooms: { total: engagementRoomCount }
    };
  }

  return overview;
}

module.exports = {
  getDashboardOverview
};
