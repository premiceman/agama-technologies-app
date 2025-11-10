import User from '../models/User.js';

export const resolveUser = async (req, res, next) => {
  try {
    if (req.session?.userId) {
      const user = await User.findById(req.session.userId).lean();
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

const roleRank = ['viewer', 'editor', 'admin', 'owner'];

export const requireOrgRole = (minRole) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const roleEntry = req.user.org_roles?.find(
    (r) =>
      r.orgId?.toString() ===
      (req.params.orgId || req.body.orgId || req.query.orgId)
  );
  if (!roleEntry) {
    return res.status(403).json({ message: 'No organisation access' });
  }
  if (roleRank.indexOf(roleEntry.role) < roleRank.indexOf(minRole)) {
    return res.status(403).json({ message: 'Insufficient organisation role' });
  }
  next();
};

export const requireProjectRole = (minRole) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const projectId =
    req.params.projectId || req.body.projectId || req.query.projectId;
  const roleEntry = req.user.project_roles?.find(
    (r) => r.projectId?.toString() === projectId
  );
  if (!roleEntry) {
    return res.status(403).json({ message: 'No project access' });
  }
  const rank = ['viewer', 'editor', 'admin'];
  if (rank.indexOf(roleEntry.role) < rank.indexOf(minRole)) {
    return res.status(403).json({ message: 'Insufficient project role' });
  }
  next();
};

export const requireVendorAccess = () => (req, res, next) => {
  if (!req.user?.vendor_profile_id) {
    return res.status(403).json({ message: 'Vendor access only' });
  }
  next();
};
