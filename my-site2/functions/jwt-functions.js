const dotenv = require("dotenv");
dotenv.config();
const jwt = require("jsonwebtoken");

const createJwt = x => {
    y = jwt.sign(x, process.env.SECRET);
    return y;
}

const decodeJwt = x => {
    jwt.verify(x, process.env.SECRET, (err, decoded) => {
        if (err) {
            return err;
        } else {
            return decoded;
        }
    });
}