const mariadb = require("mariadb");

const pool = mariadb.createPool({
  user: "tacool",
  password: "password",
  database: "ChatApp",
  connectionLimit: 5,
});

// 
const helperClass = class HelperClass {
  constructor() {
    this.connection = pool.getConnection();
  }

  async getDataFromDatabase(sql, params = []) {
    const res = await (await this.connection).query(sql, params);
    (await this.connection).end()
    return JSON.parse(JSON.stringify(res));
  }
  async insertData(sql, params = []) {
    const res = await (await this.connection).query(sql, params);
    (await this.connection).end()
    return res;
  }
};

// 

const isEmailAddressInDatabase = async (emailAddress) => {
  const validate = await new helperClass().getDataFromDatabase(
    "SELECT * FROM user WHERE emailAddress=?",
    [emailAddress]
  );
  if ((await validate.length) < 1) {
    return false;
  } else {
    return true;
  }
};


const login = async (emailAddress, password) => {
  if (await isEmailAddressInDatabase(emailAddress)) {

    async function isPasswordValid() {
      const isValid = await new helperClass().getDataFromDatabase(
        "SELECT * FROM user where emailAddress=? and password=?",
        [emailAddress, password]
      );
      if ((await isValid.length) < 1) {
        return false;
      } else {
        return true;
      }
    }

    if (await isPasswordValid()) {
      return true;
    } else {
      return "wrong password";
    }
  } else {
    return "account not found";
  }
};


const newChat = async(user1id,user2id,user1name,user2name,message)=>{
  try{
    const isChatAvailable = await new helperClass().getDataFromDatabase("SELECT * FROM user_chats where user1=? and user2=? or user2=? and user1=?",[user1id,user2id,user2id,user1id])

    function getChatId(){
      // i want to reuse it in below conditions
      return new helperClass().getDataFromDatabase("SELECT chatId FROM user_chats WHERE user1=? and user2=? or user2=? and user1=?",[user1id,user2id,user2id,user1id])
    }

    if(isChatAvailable.length < 1){
      new helperClass().insertData("INSERT INTO user_chats(user1,user2,user1Name,user2Name) values(?,?,?,?)",[user1id,user2id,user1name,user2name])
      const chatId = (await getChatId())[0].chatId
      sendMessage(chatId,user1id,message)
      return {messages:await getMessages(chatId),chatId}
    }else{
      const chatId = (await getChatId())[0].chatId
      sendMessage(chatId,user1id,message)
      return {messages:await getMessages(chatId),chatId}
      //  i added in the above object because i want to use to create a room
    }
  }catch(e){
    console.log(e)
  }
}


const createAccount = async (emailAddress, username, password) => {
  if(await isEmailAddressInDatabase(emailAddress)){
    return "did you forget password : Account taken"
  }else{
    async function isUsernameTaken(){
      const validate = await new helperClass().getDataFromDatabase("SELECT * FROM user WHERE username=?",[username])
      if(await validate.length < 1){
        return false
      }else{
        return true
      }
    }

    if(await isUsernameTaken()){
      return "username taken"
    }else{
      const addNewUser = await new helperClass().insertData("INSERT INTO user(emailAddress,username,password) VALUES(?,?,?)",[emailAddress,username,password])
      return true
    }
  }
};


const getChats = async (userid) => {
  const chats = await new helperClass().getDataFromDatabase("SELECT * FROM user_chats where user1=? or user2=?",[userid,userid])
  return chats
};


const getMessages = async (chatId) => {
  const messages = await new helperClass().getDataFromDatabase("SELECT * FROM messages WHERE chatId=?",[chatId])
  return messages
};


const getPeople = async () => {
  const people = await new helperClass().getDataFromDatabase("SELECT userid,emailAddress,username FROM user")
  return people
};


const sendMessage = async (chatId,userId,message) => {
  new helperClass().insertData("INSERT INTO messages(chatId,sendBy,message) VALUES(?,?,?)",[chatId,userId,message])
};
 module.exports = {login,createAccount,getChats,getMessages,getPeople,helperClass,sendMessage,newChat}
