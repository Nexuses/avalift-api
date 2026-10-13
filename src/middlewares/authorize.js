// src/middleware/authorize.js
const db = require('../dto'); 
const roleService = require('../services/roleService');
//const roleService = require('../services/roleService');

const authorize = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const user = await db.User.findByPk(userId);
      const { role_id } = user.dataValues;
      const userPermissions = await roleService.getPermissionsForRoles(role_id);
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized: User not found' });
        return res.status(401).json({ message: 'Unauthorized: User not found' });
      }

     //console.log('Inside authorize middleware');
     if (userPermissions?.permissions?.includes(requiredPermission)) {
      return next();
    } else {
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
      }
    } catch (error) {
      console.error('Authorization middleware error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  };
};

module.exports = authorize;
