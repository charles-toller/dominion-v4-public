const moneyAccess = require('./no-direct-money-access');
const noPlayerMaps = require('./no-player-maps');
const noVpWithoutFeature = require('./no-vp-without-feature');
module.exports = {
    rules: {
        'no-direct-money-access': moneyAccess,
        'no-player-maps': noPlayerMaps,
        'no-vp-without-feature': noVpWithoutFeature,
    }
}