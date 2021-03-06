require('dotenv').config()

const express = require("express");   
const socketio = require("socket.io"); 
const http = require("http");
const { ExpressPeerServer } = require('peer');


const twilioObj = {
    username : null,
    cred : null 
}

// Comment if not required => below code is used to change creadentials for TURN server 
//======================================================================================
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
client.tokens.create().then(token => {
    twilioObj.username = token.username;
    twilioObj.cred = token.password;
});
const schedule = require('node-schedule');
let rule = new schedule.RecurrenceRule();
rule.hour = 12;
schedule.scheduleJob(rule,()=>{
    console.log("running"); 
    const client = require('twilio')(process.env.accountSid, process.env.authToken);
    client.tokens.create().then(token => {
        twilioObj.username = token.username;
        twilioObj.cred = token.password; 
    });
})
//========================================================================
const fs = require('fs');

const SSL_CONFIG = {
  cert: fs.readFileSync('./cert.pem'),
  key: fs.readFileSync('./key.pem'),
};
const https = require('https');

const cors = require('cors');
const app = express(); 

const router = require("./controllers/chatController");
//const server = https.createServer(SSL_CONFIG,app);

 const0 server = http.createServer(app);
const io = socketio(server); 

app.use(cors());
app.use(router); 

const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/'
});
app.use('/peerjs', peerServer);

const { 
    addUser,removeUser,getUser,getUsersInRoom,
    getUsersInVoice, addUserInVoice, removeUserInVoice 
} = require("./controllers/userController"); 

io.on('connection', socket => { 

    socket.on('join',({name,room},callBack)=>{ 

        const user = addUser({id:socket.id,name,room});  //destructuring the object 
        if(user.error) return callBack(user.error); 
        socket.join(user.room) //joins a user in a room 
        socket.emit('message',{user:'admin', text:`Welcome ${user.name} in room ${user.room}.`}); //send to user
        socket.emit('usersinvoice-before-join',{users:getUsersInVoice(user.room)});
        socket.broadcast.to(user.room).emit('message',{user:'admin', text:`${user.name} has joined the room`}); //sends message to all users in room except this user
        io.to(user.room).emit('users-online', { room: user.room, users: getUsersInRoom(user.room) });
        //console.log(getUsersInRoom(user.room)); 
        callBack(twilioObj); // passing no errors to frontend for now 
        //callBack(); 
    }); 

    
    socket.on('user-message',(message,callBack)=>{ //receive an message with eventName user-message 
        const user = getUser(socket.id); 
        io.to(user.room).emit('message',{user:user.name, text:message }); //send this message to the room 
        
        callBack(); 
    }); 

    socket.on('join-voice',({name,room},callBack)=>{
        io.to(room).emit('add-in-voice',{id:socket.id,name:name}); 
        addUserInVoice({id:socket.id,name,room}); 
        callBack(); 
    }); 
    socket.on('leave-voice',({name,room},callBack)=>{

        io.to(room).emit('remove-from-voice',{id:socket.id,name:name}); 
        removeUserInVoice(socket.id); 
        callBack(); 
    }); 

    socket.on('disconnect', () => {
       
        const user = removeUser(socket.id);
        if(user) { 
            io.to(user.room).emit('message',{user:'admin', text:`${user.name} left the chat` }); //send this message to the room 
            io.to(user.room).emit('users-online', { room: user.room, users: getUsersInRoom(user.room) });
            removeUserInVoice(user.id); 
            socket.broadcast.to(user.room).emit('remove-from-voice',{id:socket.id,name:user.name}); 
        }
        //console.log("User left"); 
    });
    

});




const PORT = process.env.PORT || 5000; 
server.listen(PORT, ()=>{
    console.log(`Server started on port ${PORT}`); 
});
