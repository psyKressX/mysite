const passport = require("passport");
const passportJWT = require("passport-jwt");
const bodyParser = require("body-parser");
const knex = require("knex");
const bookshelf = require("bookshelf");

const knexDB = knex({
    client: "pg",
    connection: "postgres://localhost/store2",
});
const db = bookshelf(knexDB);

const User = db.Model.extend({
    tableName: "users",
    hasSecurePassword: true,
});

const getUserInfo = async id => {
    x = await User.where({ id: id }).fetch().then(u => {
        user = {
            email: u.attributes.email,
            fName: u.attributes.fName,
            lName: u.attributes.lName
        }
        return user;
    })
    return x;
}

const changeUserInfo = async (id, obj) => {
    await User.where({ ID: id }).update(obj)
}
module.exports = { getUserInfo, changeUserInfo }