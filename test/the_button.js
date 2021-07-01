const TheButton = artifacts.require("TheButton");

const constants = require('../constants');

const advanceBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime(),
      },
      (err, _) => {
        if (err) {
          return reject(err);
        }
        const newBlockHash = web3.eth.getBlock("latest").hash;
        return resolve(newBlockHash);
      },
    );
  });
};

const mapEvents = ({ event, returnValues }) => ({ event, returnValues });

contract("TheButton", async accounts => {
  it("Initializes properly.", async () => {
    const instance = await TheButton.deployed();

    const press_fee = await instance.press_fee();
    const last_presser = await instance.last_presser();
    const last_press_block = await instance.last_press_block();
    const events = await instance.getPastEvents();
    const treasure = await web3.eth.getBalance(instance.address);

    assert.equal(press_fee, constants.PRESS_FEE);
    assert.equal(last_presser, 0);
    assert.equal(last_press_block, 0);
    assert.deepEqual(events, []);
    assert.equal(treasure, 0);
  });

  it("Runs press_button() as expected.", async () => {
    const instance = await TheButton.deployed();

    await instance.press_button({ from: accounts[0], value: constants.PRESS_FEE });
    
    const last_presser = await instance.last_presser();
    const last_press_block = await instance.last_press_block();
    const events = (await instance.getPastEvents()).map(mapEvents);
    const treasure = await web3.eth.getBalance(instance.address);
    const block_num = await web3.eth.getBlockNumber();

    assert.equal(last_presser, accounts[0]);
    assert.equal(last_press_block, block_num);
    assert.deepEqual(events[0], {
      event: 'ButtonPressed',
      returnValues: { 0: accounts[0] }
    });
    assert.equal(treasure, constants.PRESS_FEE);
  });

  it("Runs press_button() as expected again with different account.", async () => {
    const instance = await TheButton.deployed();

    await instance.press_button({ from: accounts[1], value: constants.PRESS_FEE });

    const last_presser = await instance.last_presser();
    const last_press_block = await instance.last_press_block();
    const events = (await instance.getPastEvents()).map(mapEvents);
    const treasure = await web3.eth.getBalance(instance.address);
    const block_num = await web3.eth.getBlockNumber();

    assert.equal(last_presser, accounts[1]);
    assert.equal(last_press_block, block_num);
    assert.deepEqual(events[0], {
      event: 'ButtonPressed',
      returnValues: { 0: accounts[1] }
    });
    assert.equal(treasure, constants.PRESS_FEE * 2);
  });

  it("Rejects if same address calls press_button() again in a row.", async () => {
    const instance = await TheButton.deployed();

    try {
      await instance.press_button({ from: accounts[1], value: constants.PRESS_FEE });
      assert.fail();
    } catch (e) {
      assert(e.message.includes("Why would you press the button again??"));

      const last_presser = await instance.last_presser();
      const treasure = await web3.eth.getBalance(instance.address);

      assert.equal(last_presser, accounts[1]);
      assert.equal(treasure, constants.PRESS_FEE * 2);
    }
  });

  it("Rejects if press_button() called with value < press_fee.", async () => {
    const instance = await TheButton.deployed();

    try {
      await instance.press_button({ from: accounts[2], value: constants.PRESS_FEE - 1});
      assert.fail();
    } catch (e) {
      assert(e.message.includes("Caller must pay exact fee to press the button."));

      const last_presser = await instance.last_presser();
      const treasure = await web3.eth.getBalance(instance.address);

      assert.equal(last_presser, accounts[1]);
      assert.equal(treasure, constants.PRESS_FEE * 2);
    }
  });

  it("Rejects if press_button() called with value > press_fee.", async () => {
    const instance = await TheButton.deployed();

    try {
      await instance.press_button({ from: accounts[2], value: constants.PRESS_FEE + 1});
      assert.fail();
    } catch (e) {
      assert(e.message.includes("Caller must pay exact fee to press the button."));

      const last_presser = await instance.last_presser();
      const treasure = await web3.eth.getBalance(instance.address);

      assert.equal(last_presser, accounts[1]);
      assert.equal(treasure, constants.PRESS_FEE * 2);
    }
  });

  it("Runs claim_treasure() as expected.", async () => {
    const instance = await TheButton.deployed();

    await advanceBlock();

    const reward = await web3.eth.getBalance(instance.address);
    const claimant_pre_balance = await web3.eth.getBalance(accounts[1]);

    await instance.claim_treasure({ from: accounts[1] });
    
    const last_press_block = await instance.last_press_block();
    const events = (await instance.getPastEvents()).map(mapEvents);
    const treasure = await web3.eth.getBalance(instance.address);
    const claimant_balance = await web3.eth.getBalance(accounts[1]);
    const block = await web3.eth.getBlock("latest");
    const gasPrice = await web3.eth.getGasPrice();

    assert(last_press_block.toNumber() + constants.TREASURE_WAIT < block.number);
    assert.equal(treasure, 0);
    assert.equal(parseInt(claimant_balance), parseInt(claimant_pre_balance) + parseInt(reward) - block.gasUsed * parseInt(gasPrice));
    assert.deepEqual(events[0], {
      event: 'TreasureClaimed',
      returnValues: { 0: accounts[1], 1: reward }
    });
  });

  it("Rejects if claim_treasure() is called before enough blocks have passed.", async () => {
    const instance = await TheButton.deployed();

    try {
      await instance.press_button({ from: accounts[0], value: constants.PRESS_FEE });
      await instance.claim_treasure({ from : accounts[0] });
      assert.fail();
    } catch (e) {
      assert(e.message.includes("Patience is a virtue."));

      const treasure = await web3.eth.getBalance(instance.address);

      assert.equal(treasure, constants.PRESS_FEE );
    }
  });

  it("Rejects if claim_treasure() is called by address that is not last presser.", async () => {
    const instance = await TheButton.deployed();

    try {
      await instance.claim_treasure({ from : accounts[1] });
      assert.fail();
    } catch (e) {
      assert(e.message.includes("Caller did not press the button last."));

      const treasure = await web3.eth.getBalance(instance.address);

      assert.equal(treasure, constants.PRESS_FEE );
    }
  });
});
