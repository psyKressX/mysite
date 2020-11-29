const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const router = express.Router();
const knex = require("knex");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const validate = require("../item-validate");
const check = require("./functions/check");
const fileUpload = require("express-fileupload");
const ImageKit = require("imagekit");
const fs = require("fs");

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
//setup for file transfer
router.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/images/",
  })
);
var imagekit = new ImageKit({
  publicKey: process.env.IMG_PUBLIC,
  privateKey: process.env.IMG_PRIVATE,
  urlEndpoint: process.env.IMG_URL,
});
//image routes
//dynamic image data retriever
router.post("/get-images", (req, res) => {
  const { key, val } = req.body;
  knexDB("product_images")
    .where(key, val)
    .then((data) => res.json(data))
    .catch((err) => console.log(err));
});
//sends image to imagekit for uploading through b64 stream
// and saves return data
router.post("/add-image", (req, res) => {
  if (!req.files) return res.status(400).end();
  const { file } = req.files;
  let product_id = parseInt(req.body.product_id) || null;
  if (file.mimetype !== "image/jpeg") return res.status(400).end();
  fs.readFile(file.tempFilePath, (err, data) => {
    const b64 = new Buffer.from(data, "base64");
    imagekit
      .upload({
        file: b64,
        fileName: file.name,
      })
      .then((upload) => {
        knexDB("product_images")
          .insert({
            id: upload.fileId,
            ref: upload.url,
            product_id,
          })
          .returning("*")
          .then((data) => res.json(data[0]))
          .catch((err) => {
            console.log(err);
            res.status(400).send("error saving image");
          });
      })
      .catch(() => res.status(400).send("failed to upload, please try again"));
  });
});
//made its own function to use with delete item as well
const deleteImg = (idArray, callback) => {
  imagekit
    .bulkDeleteFiles(idArray)
    .then((data) => {
      knexDB("product_images")
        .delete()
        .whereIn("id", idArray)
        .then((data) => {
          callback(null, data);
        })
        .catch((err) => callback(err));
    })
    .catch((err) => callback(err));
};
router.post("/delete-image", (req, res) => {
  deleteImg(req.body, (err, data) => {
    if (err) return res.status(400).end();
    return res.status(200).end();
  });
});
//dynamic multipurpose image table updater, used to update sort order and product_id
router.post("/upd-image", (req, res) => {
  let promises = [];
  req.body.forEach((upd) => {
    console.log(upd.id, upd.update);
    promises.push(
      knexDB("product_images").where("id", upd.id).update(upd.update)
    );
  });
  Promise.all(promises)
    .then((data) => {
      console.log(data);
      res.status(200).end();
    })
    .catch((err) => {
      console.log(err);
      res.status(400).end();
    });
});
router.get("/get-carousel", (req, res) => {
  fs.readFile("./carousel.json", (err, data) => {
    res.send(data);
  });
});
router.post("/set-carousel-info", (req, res) => {
  fs.writeFile("./carousel.json", JSON.stringify(req.body), (err, data) => {
    console.log(err, data);
    if (err) return res.status(400).end();
    return res.status(200).end();
  });
});

//product related routes
//add item form validator, used in both add item and update item
const addItemValidator = (req, res, callback) => {
  const formErrors = validate.validate(req.body.form);
  let errPass = true;
  for (var msg in formErrors) {
    if (formErrors[msg]) {
      errPass = false;
    }
  }
  if (errPass) callback(formErrors);
  else return res.status(400).json(formErrors);
};
router.get("/get-stock", (req, res) => {
  getSort((err, data) => {
    if (err) return res.status(400);
    return res.json(data);
  });
});
router.post("/get-item", (req, res) => {
  const { product_id } = req.body;
  knexDB("products")
    .where({ product_id })
    .then((data) => res.json(data[0]));
});
router.post("/add-item", (req, res) => {
  addItemValidator(req, res, (formErrors) => {
    const { form } = req.body;
    knexDB("products")
      .max("sort as max")
      .then((max) => {
        if (max) {
          form.sort = max[0].max + 1;
        }
        knexDB("products")
          .insert(form)
          .returning("product_id")
          .then((data) => res.json(data))
          .catch((err) => {
            console.log(err);
            res.status(400).end();
          });
      });
  });
});

router.post("/upd-item", (req, res) => {
  addItemValidator(req, res, (formErrors) => {
    const { form, product_id } = req.body;
    knexDB("products")
      .where({ product_id })
      .update(form)
      .then((data) => res.json([product_id]))
      .catch((err) => res.status(400).end());
  });
});
//gets and sorts products and their relitive images
const getSort = (callback) => {
  knexDB("products")
    .where({ discontinued: false })
    .then((data) => {
      let promises = [];
      data.forEach((i) => {
        promises.push(
          knexDB("product_images")
            .where({ product_id: i.product_id })
            .then((images) => {
              images.sort((a, b) => a.sort - b.sort);
              i.images = images;
            })
        );
      });
      Promise.all(promises)
        .then(() => {
          data.sort((a, b) => a.sort - b.sort);
          callback(null, data);
        })
        .catch((err) => callback(err, null));
    })
    .catch((err) => callback(err, null));
};
//changes stock amount for each item
router.post("/stock-update", (req, res) => {
  const { product_id, amount } = req.body;
  knexDB("products")
    .where({ product_id })
    .increment({ amount })
    .then(() => {
      getSort((err, data) => {
        if (err) return res.status(400).end();
        return res.json(data);
      });
    })
    .catch(() => res.status(400).end());
});
//save function for item list page, deletes products and their images, updates sort order
router.post("/products-update", (req, res) => {
  const { deleted, products } = req.body;
  let promises = [];
  promises.push(
    knexDB("product_images").whereIn("product_id", deleted).pluck("id")
  );
  promises.push(
    knexDB("products").whereIn("product_id", deleted).update({
      amount: 0,
      dir: "DISCONTINUED",
      disc: "DISCONTINUED",
      ing: "DISCONTINUED",
      discontinued: true,
    })
  );
  products.forEach((i) => {
    promises.push(
      knexDB("products")
        .where({ product_id: i.product_id })
        .update({ sort: i.sort })
    );
  });
  Promise.all(promises)
    .then((resolve) => {
      console.log(resolve[0]);
      deleteImg(resolve[0], (err) => {
        if (err) return res.status(400).end();
        getSort((err, data) => res.json(data));
      });
    })
    .catch((err) => res.status(400).end());
});

module.exports = router;
