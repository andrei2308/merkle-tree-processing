const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();

app.use(bodyParser.json());

app.use(cors({
    origin: "http://localhost:3000"
}));

app.post('/api/submit/eligible', (req, res) => {
    const eligibleAddresses = req.body.eligibleAddresses;
    res.status(200).json({
        success: true,
        message: "Received eligible addresses successfully"
    });
});

app.post('/api/submit/addresses', (req, res) => {
    const addresses = req.body.addresses;
    if (!addresses || !Array.isArray(addresses)) {
        return res.status(400).json({
            success: false,
            message: "Invalid addresses format. Expected an array."
        });
    }
    console.log('Received addresses:', addresses);
    res.status(200).json({
        success: true,
        message: "Addresses received successfully",
        count: addresses.length
    });
});

app.listen(10001, () => {
    console.log('Server is running on port 10001');
});