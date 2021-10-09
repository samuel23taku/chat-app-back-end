const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const {
  login,
  getChats,
  helperClass,
  getMessages,
  sendMessage,
  createAccount,
  getPeople,
  newChat,
} = require("./database_link");
const app = express();
const server = require("http").createServer(app);
const session = require("cookie-session")({
  name: "cookie-based-session",
  keys: ["key-password"],
  maxAge: 24 * 60 * 60 * 1000,
});
const io = new Server(server);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session);
app.use(
  cors({
    origin: "*",
  })
);

// socket code
io.sockets.on("connection", (socket) => {
    socket.on("am_online", (chatId) => {
    socket.join(`${chatId}`);
  });
  function getSessionCookie(socket_request) {
    let cookieString = socket_request;
    let req = {
      connection: { encrypted: false },
      headers: { cookie: cookieString },
    };
    let res = { getHeader: () => {}, setHeader: () => {} };
    let cookieSession = "";
    session(req, res, () => {
      cookieSession = req.session.cookieSession;
    });
    return cookieSession;
  }
  socket.on("new_chat", async (data) => {
    const { userid, username } = getSessionCookie(
      socket.request.headers.cookie
    ).cookieData;
    newChat(
      userid,
      data.personId,
      username,
      data.personName,
      data.message
    ).then((result) => {
      socket.join(result.chatId);
      io.sockets.to(result.chatId).emit("send_message", result.messages);
    });
  });
  socket.on("send_message", (data) => {
    console.log("send mesage");
    socket.join(`${data.chatId}`);
    // am insetting messages and then resend all messages in data because am facing message duplicates in the mobile app
    // if i append emitted message
    sendMessage(
      data.chatId,
      getSessionCookie(socket.request.headers.cookie).cookieData.userid,
      data.message
    ).then(async () => {
      console.log(data);
      io.sockets
        .to(`${data.chatId}`)
        .emit("send_message", await getMessages(data.chatId));
    });
  });
});

app.post("/login", async (req, res) => {
  console.log("login")
  const emailAddress = req.body.emailAddress;
  const password = req.body.password;
  const verify = await login(emailAddress, password);
  if (verify === true) {
    // setting up cookie using data from database.Want use the data for other operations later
    const cookieData = (
      await new helperClass().getDataFromDatabase(
        "SELECT * FROM user WHERE emailAddress=?",
        [emailAddress]
      )
    )[0];
    req.session = {
      cookieSession: {
        cookieData,
      },
    };
    res.send("access granted");
  } else {
    res.send(verify);
  }
});

app.post("/createAccount", async (req, res) => {
  const emailAddress = req.body.emailAddress;
  const username = req.body.username;
  const password = req.body.password;

  const verify = await createAccount(emailAddress, username, password);
  if (verify === true) {
    // set cookie
    const cookieData = (
      await new helperClass().getDataFromDatabase(
        "SELECT * FROM user WHERE emailAddress=?",
        [emailAddress]
      )
    )[0];
    req.session = {
      cookieSession: {
        cookieData,
      },
    };
    res.send("account created");
  } else {
    res.send(verify);
  }
});

app.get("/getChats", async (req, res) => {
  try {
    const userId = req.session.cookieSession.cookieData.userid;
    res.send({ chats: await getChats(userId), userId });
  } catch (error) {
    res.send("session expired");
  }
});


app.get("/getPeople", async (req, res) => {
  try {
    const people = await getPeople();
    delete req.session.cookieSession.cookieData.password
    const remove_me_from_people =  people.filter((e)=>e.userid != req.session.cookieSession.cookieData.userid)
    res.send(remove_me_from_people);
  } catch (error) {
    // pass
  }

});


app.post("/getMessages", async (req, res) => {
  res.send(await getMessages(req.body.chatId));
});


app.get("/isSessionExpired", function (req, res) {
  try {
    req.session.cookieSession.cookieData.userid;
    res.send("session active");
  } catch (error) {
    res.send("session expired");
  }
});

server.listen(5000, () => {
  console.warn("running");
});
