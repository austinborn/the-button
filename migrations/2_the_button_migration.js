const TheButton = artifacts.require("TheButton");

const constants = require('../constants');

module.exports = function(deployer) {
  deployer.deploy(TheButton, constants.PRESS_FEE);
};