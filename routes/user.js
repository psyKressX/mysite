const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const router = express.Router();
const passport = require("passport");
const passportJWT = require("passport-jwt");
const bodyParser = require("body-parser");
const validate = require("../accountValidation");
const mailer = require("../functions/mailer");
const knex = require("knex");
const jwt = require("jsonwebtoken");
const bookshelf = require("bookshelf");
const securePassword = require("bookshelf-secure-password");
const cookieParser = require("cookie-parser");
const { promises } = require("fs");

const jwtStrategy = passportJWT.Strategy;
const ExtractJwt = passportJWT.ExtractJwt;
const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.SECRET,
};
const strategy = new jwtStrategy(opts, (payload, next) => {
    User.forge({ id: payload.id })
        .fetch()
        .then((res) => {
            next(null, res);
        });
});
passport.use(strategy);
const knexDB = knex({
    client: "pg",
    connection: process.env.MY_DB,
});
const db = bookshelf(knexDB);
db.plugin(securePassword);
router.use(passport.initialize());
router.use(bodyParser.json());
router.use(cookieParser());

const User = db.Model.extend({
    tableName: "users",
    hasSecurePassword: true,
});

router.post("/seedUser", async (req, res) => {
    const { email, fName, lName, password, subscribe } = req.body;
    const body = req.body;
    x = validate.valid(body);
    if (x.email === null) {
        await User.where({ email })
            .fetch({ require: false })
            .then((data) => {
                if (data) {
                    x.email = "This email is already registered";
                }
            })
            .catch();
    }
    for (var msg in x) {
        if (x[msg]) {
            failed = true;
        }
    }
    if (failed) return res.status(400).json(x);
    const user = new User({ email, password, fName, lName });
    let promises = []
    if (subscribe) { promises.push(knexDB('mail_list').insert({ email })) }
    promises.push(user.save())
    Promise.all(promises)
    then(() => {
        const token = jwt.sign(email, process.env.SECRET)
        mailer.mailer(
            email,
            { token },
            'Luna Skin Naturals account verification',
            'verify',
            (err, data) => {
                if (err) {
                    x.success = "Check email is valid";
                    return res.status(400).json(x);
                }
                console.log('ok')
                return res.status(200).end()
            }
        )
    }).catch((err) => {
        x.success = "Error processing";
        return res.status(400).json(x);
    });
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    let x = {
        failed: true,
        mess: null,
        user: null,
    };
    if (!email || !password) {
        x.mess = "Please enter an email and password";
    }

    await User.where({ email: email })
        .fetch({ require: false })
        .then(async (data) => {
            if (!data) {
                x.mess = "Email is incorrect or doesn't exist";
            } else {
                await data
                    .authenticate(password)
                    .then((user) => {
                        console.log(user.attributes);
                        const payload = { id: user.attributes.id };
                        const token = jwt.sign(payload, process.env.SECRET);
                        x.failed = false;
                        x.user = user.attributes.fName;
                        res.cookie("token", token, { maxAge: 86400000, httpOnly: true });
                    })
                    .catch((err) => {
                        x.mess = "Password is incorrect";
                    });
            }
        });
    res.json(x);
    return res;
});

router.get('/check', (req, res) => {
    t = req.cookies.token;
    console.log(t);
    if (!t) return res.json({ name: null, email: null })
    jwt.verify(t, process.env.SECRET, (err, decoded) => {
        if (err) return res.status(400).send("ERROR")
        knexDB('users').where({ id: decoded.id })
            .then(data => res.json({ name: data[0].fName, email: data[0].email }))
    })
})

router.get('/verify', (req, res) => {
    const t = req.query.TOKEN;
    if (!t) return res.status(400).end();
    jwt.verify(t, process.env.SECRET, (err, decoded) => {
        if (err) return res.status(400).end()
        knexDB('users').where({ email: decoded }).update({ authed: true }).returning()
            .then(data => {
                const token = jwt.sign({ id: data[0].id }, process.env.SECRET);
                res.cookie("token", token, { maxAge: 86400000, httpOnly: true });
                return res.status(200).end();
            })
            .catch(err => {
                return res.status(400).end();
            })
    })
})

router.get('/log-out', (req, res) => {
    res.cookie('token', null, { maxAge: 0 });
    return res.status(200).end();
})

router.post('/sub-email', (req, res) => {
    email = req.body.email
    const emailRegex = RegExp(/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/);
    if (!emailRegex.test(email)) return res.status(401).end();
    knexDB('mail_list').insert({ email }).catch(err)
    res.status(200).end();
})

router.get('/unsubscribe', (req, res) => {
    const t = req.query.TOKEN;
    if (!t) return res.status(400).end()
    jwt.verify(t, process.env.SECRET, (err, decoded) => {
        if (err) { throw err }
        else {
            knexDB('mail_list').where({ email: decoded }).del()
                .catch(err => console.log(err))
            return res.status(200).end()
        }
    })
})
module.exports = router;