const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const router = express.Router();
const knex = require("knex");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const mailer = require("../functions/mailer");
const check = require("./functions/check");

const knexDB = knex({
  client: "pg",
  connection: process.env.MY_DB,
});
router.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
router.use(bodyParser.json());
router.use(cookieParser());

router.get("/get-orders", (req, res) => {
  knexDB("orders")
    .then((o) => res.json(o))
    .catch((err) => res.status(400).end());
});

router.post("/find-order", (req, res) => {
  const { order_id } = req.body;
  Promise.all([
    knexDB("order_details").where({ order_id }),
    knexDB("orders").where({ order_id }),
  ])
    .then((o) => {
      return res.json({ orderDetails: o[0], order: o[1] });
    })
    .catch((err) => {
      return res.status(400).end();
    });
});

router.post("/update-order", (req, res) => {
  const { order_id, update } = req.body;
  knexDB("oders")
    .where({ order_id })
    .update(update)
    .then(() => res.status(200).end())
    .catch((err) => res.status(400).end());
});
router.post("/ship-order", (req, res) => {
  const { order_id } = req.body;
  Promise.all([
    knexDB("orders").where({ order_id }),
    knexDB("order_details").where({ order_id }),
  ]).then((data) => {
    const order = data[0][0];
    const details = data[1];
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate() + 1
      }`;
    let sendleJson = {
      pickup_date: dateStr,
      first_mile_option: "pickup",
      description: "Luna Skin Naturals",
      weight: { value: null, units: "g" },
      customer_reference: `ORDER ${order_id}`,
      sender: {
        contact: {
          name: "Jade Martin",
          phone: "0423542974",
          company: "Luna Skin Naturals",
          email: "hello@lunaskinnaturals.com",
        },
        address: {
          address_line1: "32 Mitchell road",
          suburb: "Melton South",
          state_name: "VIC",
          postcode: "3338",
          country: "Australia",
        },
      },
      receiver: {
        contact: {
          name: `${order.first_name} ${order.last_name}`,
          email: order.email,
        },
        address: {
          address_line1: order.shipping_address1,
          address_line2: order.shipping_address2,
          suburb: order.shipping_city,
          state_name: order.shipping_state,
          postcode: order.shipping_code,
          country: order.shipping_country,
        },
      },
    };
    let promises = [];
    data[1].forEach((d) => {
      const { product_id } = d;
      promises.push(knexDB("products").where({ product_id }));
    });
    Promise.all(promises).then((pData) => {
      let weight = 0;
      pData.forEach((i) => {
        weight =
          weight +
          details.find((x) => x.product_id === i[0].product_id).qty *
          i[0].weight;
      });
      sendleJson.weight.value = weight;
      const b64 = Buffer.from(
        `${process.env.SENDLE_ID}:${process.env.SENDLE_KEY}`
      ).toString("base64");
      fetch("https://sandbox.sendle.com/api/orders", {
        method: "POST",
        headers: {
          Authorization: "Basic " + b64,
          Accept: "application/json",
          "Idempotency-Key": order_id,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendleJson),
      })
        .then((data) => {
          if (data.status === 200) return res.status(200).end();
          return res.status(400).send(data.statusText);
        })
        .catch((err) => {
          console.log("this is err", err);
        });
    });
  });
});

router.post("/list-mail", (req, res) => {
  let body = `<p>${req.body.email}</p><br />${req.body.body}<br /> <p>Liam Smith</p>`
  mailer.mailer(
    "liam_smith1989@hotmail.com",
    { name: "MESSAGE FROM MYSITE", body },
    req.body.title,
    "blank",
    (err, data) => {
      if (err) return res.status(400).end();
      return res.status(200).end();
    }
  );
});

module.exports = router;
