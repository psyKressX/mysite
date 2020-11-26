const dotenv = require("dotenv");
dotenv.config();
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');


let transporter = nodemailer.createTransport({
    service: 'SendPlus',
    auth: {
        user: 'cycrasx@hotmail.com',
        pass: 'getinzachopa123',
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
        from: 'psykressx@gmail.com',
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