import { Web3Storage, getFilesFromPath } from 'web3.storage';
const { ethers } = require('ethers');
const Constants = require('../constant'); // Assuming Constants are defined in a separate file
const formidable = require('formidable');
import path from 'path';

export const config = {
    api: {
        bodyParser: false    // disable built-in body parser
    }
}

function moveFiletoServer(req) {
    return new Promise((resolve, reject) => {
        const options = {};
        options.uploadDir = path.join(process.cwd(), "/pages/uploads");
        options.filename = (name, ext, path, form) => {
            return path.originalFilename;
        }
        const form = formidable(options);

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error(err);
                reject("Something went wrong");
                return;
            }
            const uniqueFileName = fields.filename;
            const actualFileName = files.file.originalFilename;

            resolve({ uniqueFileName, actualFileName });
        })
    })
}

async function storeDataInBlockchain(actualFileName, uniqueFileName) {
    try {
        const provider = new ethers.providers.JsonRpcProvider(Constants.API_URL);
        const signer = new ethers.Wallet(Constants.PRIVATE_KEY, provider);
        const StorageContract = new ethers.Contract(Constants.contractAddress, Constants.contractAbi, signer);

        const isStored = await StorageContract.isFileStored(uniqueFileName);

        console.log(isStored);

        if (!isStored) {
            const token = "z6MkoNKsYNVa8Fwtp6myKnHJLBpRzMP4YaxF4EFjMuK5naVG";
            const storage = new Web3Storage({ token });
            const uploadPath = path.join(process.cwd(), "/pages/uploads");
            const files = await getFilesFromPath(uploadPath, `/${actualFileName}`);
            const cid = await storage.put(files);
            const hash = cid.toString();
            console.log("Storing the data in IPFS");
            const tx = await StorageContract.upload(uniqueFileName, hash);
            await tx.wait();
            const storedhash = await StorageContract.getIPFSHash(uniqueFileName);
            return { message: `IPFS hash is stored in the smart contract: ${storedhash}` };
        } else {
            console.log("Data is already stored for this file name");
            const IPFShash = await StorageContract.getIPFSHash(uniqueFileName);
            return { message: `IPFS hash is already stored in the smart contract: ${IPFShash}` };
        }
    } catch (error) {
        console.error("Error in storeDataInBlockchain:", error);
        throw error; // Re-throw the error to handle it in the caller function
    }
}

async function handler(req, res) {
    try {
        const { uniqueFileName, actualFileName } = await moveFiletoServer(req);
        console.log("Files are stored in local server");

        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulating delay

        const response = await storeDataInBlockchain(actualFileName, uniqueFileName);
        console.log("Hash stored in smart contract");

        return res.status(200).json(response);
    } catch (err) {
        console.error("Error in handler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export default handler;
