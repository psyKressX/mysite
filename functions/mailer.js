const dotenv = require("dotenv");
dotenv.config();
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');


let transporter = nodemailer.createTransport({
    service: 'hotmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
})
transporter.use('compile', hbs({
    viewEngine: {
        extName: '.hbs',
        partialsDir: './functions/views/',
        layoutsDir: './functions/views/',
    },
    viewPath: './functions/views/'
}))

const mailer = (addrss, contxt, subjct, templte, callback) => {

    const mail = {
        from: process.env.EMAIL_USER,
        to: addrss,
        subject: subjct,
        template: templte,
        context: contxt
    }
    transporter.sendMail(mail, (err, data) => {
        console.log(err, data)
        callback(err, data)
    })
}

module.exports = { mailer }