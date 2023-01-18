const fs = require('fs');

const getAbi = contractName => {
    var abiJson = fs.readFileSync(`./artifacts/contracts/${contractName}.sol/${contractName}.json`);
    var abi = JSON.parse(abiJson).abi;
    return abi
}

const uint256Max = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

module.exports= {
    getAbi: getAbi,
    uint256Max: uint256Max
}