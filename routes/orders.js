const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const router = express.Router();
const fs = require("fs");
const knex = require("knex");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const paypal = require("paypal-rest-sdk");
const mailer = require("../functions/mailer");

paypal.configure({
  mode: "sandbox",
  client_id: process.env.PAYPAL_ID,
  client_secret: process.env.PAYPAL_SECRET,
});

const knexDB = knex({
  client: "pg",
  connection: process.env.MY_DB,
});

router.use(
  bodyParser.urlencoded({
    extended: false,
  })
);
router.use(bodyParser.json());
router.use(cookieParser());

const c = fs.readFileSync("code.json");
const coupon = Object.values(JSON.parse(c));

checkCodes = (c) => {
  let discount;
  coupon.forEach((i) => {
    if (i.code === c) {
      discount = i.percent;
    }
  });
  return discount;
};

router.post("/couponCheck", (req, res) => {
  discount = checkCodes(req.body.code);
  return res.json({ discount });
});

router.post("/check-order", (req, res) => {
  order = req.body;
  order.forEach((e) => {
    if (e.value < 1) {
      return res
        .status(400)
        .json("ERROR: odering negative units, ip has been loged");
    }
  });
  cleansOrder(order).then((newOrd) => {
    sendOrder = jwt.sign({ newOrd }, process.env.SECRET);
    res.cookie("ord", sendOrder, { maxAge: 86400000, httpOnly: true });
    return res.status(200).end();
  });
});

router.post("/decode-order", (req, res) => {
  const { ord } = req.cookies;
  jwt.verify(ord, process.env.SECRET, (err, decoded) => {
    if (err) return res.status(400).end();
    else {
      return res.json(decoded.newOrd);
    }
  });
});

const cleansOrder = async (order) => {
  return await knexDB("products")
    .where("discontinued", false)
    .then((data) => {
      let newOrder = [];
      order.forEach((product) => {
        let item = data.find((i) => i.product_id === product.product_id);
        item.value = product.value;
        newOrder.push(item);
      });
      return newOrder;
    })
    .catch((err) => console.log(err));
};

router.post("/processOrder", async (req, res) => {
  const order = req.body;
  let payorder = order.map((i) => ({
    name: i.name,
    sku: i.product_id,
    price: i.price,
    currency: "AUD",
    quantity: i.value,
  }));
  let total = order.reduce((accum, cost) => {
    return parseFloat((accum + cost.price * cost.value).toFixed(2));
  }, 0);
  const shipping = 0;
  let final = parseFloat((total + shipping).toFixed(2));
  const orderJson = {
    intent: "sale",
    payer: {
      payment_method: "paypal",
    },
    redirect_urls: {
      return_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
    },
    transactions: [
      {
        item_list: {
          items: payorder,
        },
        amount: {
          currency: "AUD",
          total: final,
          details: {
            subtotal: total,
            shipping: 0,
          },
        },
        description: "psyKressX Store",
      },
    ],
  };
  paypal.payment.create(orderJson, function (error, payment) {
    if (error) {
      console.log(error.response.details);
    } else {
      for (let i = 0; i < payment.links.length; i++) {
        if (payment.links[i].rel === "approval_url") {
          res.set("Content-Type", "text/html");
          return res.send(payment.links[i].href);
        }
      }
    }
  });
});

router.get("/success", (req, res) => {
  t = req.cookies.token;
  const payerId = req.query.PayerID;
  const paymentId = req.query.paymentId;
  const execute_payment_json = {
    payer_id: payerId,
  };
  paypal.payment.execute(paymentId, execute_payment_json, function (
    error,
    payment
  ) {
    if (error) {
      console.log(error.response);
      res.redirect("/cancel");
      throw error;
    } else {
      const {
        line1,
        city,
        state,
        postal_code,
        country_code,
      } = payment.payer.payer_info.shipping_address;
      const { create_time } = payment;
      const { items } = payment.transactions[0].item_list;
      const { email, first_name, last_name } = payment.payer.payer_info;
      const order_id = payment.transactions[0].related_resources[0].sale.id;
      let line2 = null;
      if (payment.transactions[0].item_list.shipping_address.line2) {
        line2 = payment.transactions[0].item_list.shipping_address.line2;
      }
      let payerId = null;
      const sub = payment.transactions[0].amount.details.subtotal;
      const ship = payment.transactions[0].amount.details.shipping;
      const total = payment.transactions[0].amount.total;
      if (t) {
        jwt.verify(t, process.env.SECRET, (err, decoded) => {
          if (err) {
            throw err;
          } else {
            console.log("got id", decoded);
            payerId = decoded.id;
          }
        });
      }
      const details = items.map((i) => ({
        order_id: order_id,
        product_id: parseInt(i.sku),
        qty: parseInt(i.quantity),
        unit_price: parseFloat(i.price),
        extended_price: parseFloat(i.price) * parseFloat(i.quantity),
        name: i.name,
      }));
      console.log(details);
      let promises = [];
      items.forEach((i) => {
        promises.push(
          knexDB("products")
            .where({ product_id: parseInt(i.sku) })
            .decrement("amount", parseInt(i.quantity))
        );
      });
      knexDB("orders")
        .where({ order_id })
        .select()
        .then((o) => {
          if (o.length < 1) {
            knexDB("orders")
              .insert({
                order_id: order_id,
                id: payerId,
                subtotal: parseFloat(sub),
                shipping: parseFloat(ship),
                price: parseFloat(total),
                order_date: create_time,
                email: email,
                shipping_address1: line1,
                shipping_address2: line2,
                shipping_city: city,
                shipping_state: state,
                shipping_code: parseInt(postal_code),
                shipping_country: country_code,
                first_name: first_name,
                last_name: last_name,
              })
              .then(() => {
                knexDB("order_details")
                  .insert(details)
                  .then(() => {
                    Promise.all(promises)
                      .then(() => res.status(200).end())
                      .catch((err) => console.log(err));
                  })
                  .catch((err) => console.log(err));
              })
              .catch((err) => {
                console.log(err);
                return res.status(400).end();
              });
          } else {
            return res.status(429).end();
          }
        });
    }
  });
});

router.get("/my-orders", (req, res) => {
  t = req.cookies.token;
  if (!t) return res.status(400).end();
  jwt.verify(t, process.env.SECRET, (err, decoded) => {
    if (err) return res.status(400).end();
    console.log("ping");
    const { id } = decoded;
    knexDB("orders")
      .where({ id })
      .then((o) => res.json(o))
      .catch((err) => res.status(400).end());
  });
});

router.get("/my-order", (req, res) => {
  t = req.cookies.token;
  const { order } = req.query;
  if (!t) return res.status(401).end();
  jwt.verify(t, process.env.SECRET, (err, decoded) => {
    if (err) return res.status(400).end();
    const { id } = decoded;
    Promise.all([
      knexDB("orders").where({ id, order_id: order }),
      knexDB("order_details").where({ order_id: order }),
    ])
      .then((data) => res.json({ orderDetails: data[1], order: data[0] }))
      .catch((err) => res.status(400).end());
  });
});

module.exports = router;
