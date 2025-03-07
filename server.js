import express from 'express';
import bodyParser from 'body-parser';
import cors from "cors";
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { address, abi } from './constants/constants.js';
import { ethers } from 'ethers';
const app = express();

app.use(bodyParser.json());
app.use(cors());

const merkleTreesStore = {};
const achievementsStore = [];

function createLeaf(address, amount = 5n) {
    const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [address, amount]
    );
    const innerHash = ethers.keccak256(encodedData);
    return ethers.keccak256(
        ethers.solidityPacked(['bytes'], [innerHash])
    );
}

function createMerkleTree(addresses) {
    const leaves = addresses.map(address => createLeaf(address));
    return new MerkleTree(leaves, keccak256, { sortPairs: true });
}

app.post('/api/submit/eligible', (req, res) => {
    const { player, achievementID } = req.body;

    if (!player) {
        return res.status(400).json({
            success: false,
            message: "Player address is required"
        });
    }

    achievementsStore.push({
        player,
        achievementID: achievementID || 0,
        timestamp: Date.now()
    });

    res.status(200).json({
        success: true,
        message: "Achievement data received successfully",
        achievementsCount: achievementsStore.length
    });
});

app.post('/api/submit/addresses', (req, res) => {
    const addresses = req.body.addresses;
    const treeId = req.body.treeId || 'default';

    if (!addresses || !Array.isArray(addresses)) {
        return res.status(400).json({
            success: false,
            message: "Invalid addresses format. Expected an array."
        });
    }

    try {
        const merkleTree = createMerkleTree(addresses);
        const root = merkleTree.getHexRoot();

        merkleTreesStore[treeId] = {
            tree: merkleTree,
            root,
            addresses: addresses,
            timestamp: Date.now()
        };

        console.log('Received addresses:', addresses);
        console.log('Generated Merkle root:', root);

        res.status(200).json({
            success: true,
            message: "Addresses received and Merkle tree created successfully",
            count: addresses.length,
            root
        });
    } catch (error) {
        console.error('Error creating merkle tree:', error);
        return res.status(500).json({
            success: false,
            message: "Error creating merkle tree",
            error: error.message
        });
    }
});

app.post('/api/verify/address', (req, res) => {
    const { address, treeId = 'default' } = req.body;

    if (!address) {
        return res.status(400).json({
            success: false,
            message: "Address is required"
        });
    }

    if (!merkleTreesStore[treeId]) {
        return res.status(404).json({
            success: false,
            message: `Merkle tree with ID ${treeId} not found`
        });
    }

    const { tree, addresses } = merkleTreesStore[treeId];

    if (!addresses.includes(address)) {
        return res.status(200).json({
            success: false,
            message: "Address is not eligible",
            eligible: false
        });
    }

    const leaf = createLeaf(address);
    const proof = tree.getHexProof(leaf);
    const isValid = tree.verify(proof, leaf, tree.getRoot());

    if (!isValid) {
        return res.status(200).json({
            success: false,
            message: "Invalid proof",
            eligible: false
        });
    }

    res.status(200).json({
        success: true,
        message: "Address is eligible",
        eligible: true,
        proof,
        root: tree.getHexRoot()
    });
});

app.get("/api/merkle/root/:treeId", (req, res) => {
    const treeId = req.params.treeId || 'default';

    if (!merkleTreesStore[treeId]) {
        return res.status(404).json({
            success: false,
            message: `Merkle tree with ID ${treeId} not found`
        });
    }

    res.status(200).json({
        success: true,
        root: merkleTreesStore[treeId].root
    });
});

app.get('/api/achievements', (req, res) => {
    res.status(200).json({
        success: true,
        achievements: achievementsStore
    });
});

app.get('/api/merkle/trees', (req, res) => {
    const trees = Object.keys(merkleTreesStore).map(id => ({
        id,
        addressCount: merkleTreesStore[id].addresses.length,
        root: merkleTreesStore[id].root,
        timestamp: merkleTreesStore[id].timestamp
    }));

    res.status(200).json({
        success: true,
        trees
    });
});

app.get('/api/claim/:address', (req, res) => {
    const address = req.params.address;
    const amount = 5n;
    const treeId = 'default';

    if (!merkleTreesStore[treeId]) {
        return res.status(404).json({
            success: false,
            message: `Merkle tree with ID ${treeId} not found`
        });
    }

    const { tree, addresses } = merkleTreesStore[treeId];
    if (!addresses.map(addr => addr.toLowerCase()).includes(address.toLowerCase())) {
        return res.status(200).json({
            success: false,
            message: "Address is not eligible",
            eligible: false
        });
    }

    const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [address, amount]
    );
    const innerHash = ethers.keccak256(encodedData);
    const leaf = ethers.keccak256(
        ethers.solidityPacked(['bytes'], [innerHash])
    );

    const proof = tree.getHexProof(leaf);
    const isValid = tree.verify(proof, leaf, tree.getRoot());

    if (!isValid) {
        return res.status(200).json({
            success: false,
            message: "Invalid proof",
            eligible: false
        });
    }

    res.status(200).json({
        success: true,
        message: "Claim data generated successfully",
        data: {
            address,
            amount: Number(amount),
            proof
        }
    });
});

app.listen(10001, () => {
    console.log('Server is running on port 10001');
});