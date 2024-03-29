import { MerkleTree } from 'merkletreejs'
const keccak256 = require('keccak256');

const whitelistAddresses = [
    ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5],
    ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 10],
    ['0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 50],
    ['0x90F79bf6EB2c4f870365E785982E1f101E93b906', 100],
    ['0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', 55],
    ['0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', 30],
    ['0x976EA74026E726554dB657fA54763abd0C3a0aa9', 40],
    ['0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', 20],
    ['0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', 100]
]

const leafNodes = whitelistAddresses.map(addr => keccak256(addr));
const merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true});

const rootHash = merkleTree.getRoot();
console.log("Whitelist MerkleTree Root Hash: ", merkleTree.toString());

const claimingAddress = leafNodes[0];
const caller = whitelistAddresses[0];

//const hexProof = merkleTree.getHexProof(keccak256(caller.address));
const hexProof = merkleTree.getHexProof(claimingAddress);

console.log("Merkle proof for address: ", claimingAddress);
console.log("Caller address: ", caller);
console.log(hexProof);