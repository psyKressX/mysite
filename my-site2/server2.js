const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const router = require("./routes/orders");
const users = require("./routes/user");
const adminOrders = require("./routes/admin-orders");
const adminItems = require("./routes/admin-items");
const app = express();
const socketIo = require("socket.io");
const cors = require("cors");
const http = require("http");
const check = require("./routes/functions/check");
const cookie = require("cookie");

const port1 = process.env.PORT || 5000;

app.use(router);
app.use(users);
app.use(adminOrders);
app.use(adminItems);
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

const httpServer = http.createServer(app);

httpServer.listen(port1, "0.0.0.0", () =>
  console.log(`app listening on port ${port1}!`)
);

const io = socketIo(httpServer);

let interval = 0;
let chat = {};
let chatDate = {};
let admin;

io.on("connection", (socket) => {
  interval++;
  io.to(socket.id).emit(
    "FromAPI",
    JSON.stringify({
      text: "hello",
      sender: {
        name: "psyKressX",
        uid: "from",
      },
    })
  );

  console.log(interval);
  socket.on("disconnect", () => {
    socket.leave(socket);
    interval--;
    if (socket.id === admin) admin = null;
  });

  socket.on("ToAPI", (message) => {
    const msg = { from: socket.id, msg: message };
    if (chat[socket.id]) {
      chat[socket.id].convo.push(msg)
      chat[socket.id].read = false;
    } else {
      chat[socket.id] = { read: false, convo: [msg] };
      chatDate[socket.id] = new Date().getTime() + 172800000;
    }
    console.log(chat, admin);
    if (admin) io.to(admin).emit("ToAPI", JSON.stringify(msg));
  });

  socket.on("FromAPI", (message) => {
    if (socket.id !== admin) return;
    const { user, msg } = message;
    chat[user].convo.push({ from: "admin", msg });
    io.to(user).emit("FromAPI", JSON.stringify({
      text: msg,
      sender: {
        name: "psyKressX",
        uid: "from",
      }
    }));
  });

  socket.on("connectAdmin", () => {
    console.log('admin connecting')
    const cookies = (() => {
      if (typeof socket.handshake.headers.cookie === String) cookie.parse(socket.handshake.headers.cookie)
    })();
    if (!cookies) return;
    let pass = check.confirm(cookies.admin);
    if (!pass) return;
    admin = socket.id;
    allChats = {};
    for (convo in chat) {
      console.log(convo);
      allChats[convo] = { read: chat[convo].read, msg: chat[convo].convo[0] };
    }
    console.log("all", allChats);
    io.to(admin).emit("convoList", JSON.stringify(allChats));
  });

  socket.on("getChat", (id) => {
    io.to(admin).emit("returnChat", JSON.stringify(chat[id].convo));
  });

  socket.on("read", (id) => {
    chat[id].read = true;
  })

  setInterval(() => {
    time = new Date().getTime();
    console.log("ping")
    for (date in chatDate) {
      if (chatDate[date] < time) {
        console.log("deleting ", chatDate[date], chat[date])
        delete chatDate[date];
        delete chat[date];
      }
    }
  }, 14400000);
});
