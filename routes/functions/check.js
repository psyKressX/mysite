const dotenv = require("dotenv");
dotenv.config();
const jwt = require("jsonwebtoken");

let failures = [];

const onFailure = (ip) => {
  const index = failures.findIndex((i) => i.ip === ip);
  if (index >= 0) {
    failures[index].count++;
    if (failures[index].count >= 10) {
      return res.status(429).end();
    }
  } else {
    failures.push({
      ip: ip,
      count: 1,
      time: Date.now() + 1800000,
    });
  }
};

setInterval(() => {
  for (let i = 0; i < failures.length; i++) {
    if (failures[i].time < Date.now()) {
      failures.splice(i, 1);
    }
  }
}, 600000);

const confirm = (x) => {
  return jwt.verify(x, process.env.SECRET, (err, decoded) => {
    if (err) return false;
    if (decoded.user === process.env.ADMIN_USER) return true;
    else return false;
  });
};
module.exports = { confirm, onFailure, failures };
