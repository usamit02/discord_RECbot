const Discord = require("discord.js");
const fs = require('fs-extra');
const client = new Discord.Client();
const mysql = require('mysql');

const mainChannelId = "472344675676585985";
const subChannelId = "";
const radioChannelId = "472264910223704074";

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'kx125l1',
  database: 'recbot',
  supportBigNumbers: true,
  bigNumberStrings: true
});
var caster = [];
class _program {
  constructor() {
    this.start = new Date();
    this.end = new Date();
    this.summary = [];
  }
}
class _caster {
  constructor(id) {
    this.id = id;
    this.count = 0;
    this.program = {};
  }
  addProgram() {
    this.program[this.count] = new _program;
  }
}
var recording = "";
db.connect((err) => {
  if (err) throw err;
  db.query("SELECT id FROM t01caster WHERE stop = 0;", (err, row) => {
    if (err) throw err;
    for (var i = 0; i < row.length; i++) {
      caster[i] = new _caster(row[i].id);
    }
    //Object.assign(caster, row);
  });
});

client.on('message', msg => {
  if (msg.content.startsWith('rec')) {
    let [command, ...channelName] = msg.content.split(" ");
    if (!msg.guild) {
      return msg.reply('no private service is available in your area at the moment. Please contact a service representative for more details.');
    }
    const voiceChannel = msg.guild.channels.find("name", "General");//channelName.join(" "));
    //console.log(voiceChannel.id);
    if (!voiceChannel || voiceChannel.type !== 'voice') {
      return msg.reply(`I couldn't find the channel ${channelName}. Can you spell?`);
    }
    voiceChannel.join()
      .then(conn => {
        msg.reply('ready!');
        var receiver = conn.createReceiver();
        conn.on('speaking', (user, speaking) => {
          if (speaking) {
            var outputStream = fs.createWriteStream(`./rec/record-3.pcm`, { 'flags': 'a' });// pipe our audio data into the file stream
            msg.channel.sendMessage(`RECroding to ${user}`);// this creates a 16-bit signed PCM, stereo 48KHz PCM stream.
            const audioStream = receiver.createPCMStream(user);// create an output stream so we can dump our data in a file
            audioStream.pipe(outputStream);
            //outputStream.on("data", console.log);
            audioStream.on('end', () => {// when the stream ends (the user stopped talking) tell the user
              msg.channel.sendMessage(`RECroding stop ${user}`);
              outputStream.end();
            });
          }
        });
      })
      .catch(console.log);
  }
  if (msg.content.startsWith('stop')) {
    let [command, ...channelName] = msg.content.split(" ");
    let voiceChannel = msg.guild.channels.find("name", channelName.join(" "));
    voiceChannel.leave();
  }
  if (msg.isMemberMentioned(client.user) && msg.member.voiceChannel) {
    msg.member.voiceChannel.join().then(connection => {
      const dispatcher = connection.playFile('./rec/r3.ogg');
      dispatcher.on('end', reason => {
        connection.disconnect();
      });
    })
      .catch(console.log);
    return;
  }
});
client.on('voiceStateUpdate', (oldMember, newMember) => {
  var recorder = caster.filter(function (i) { if (i.id == newMember.id) return true; });
  if (recorder.length) {//新しくボイスチャンネルに入った人がキャスター一覧にあったとき
    if (oldMember.voiceChannelID !== newMember.voiceChannelID && newMember.voiceChannelID === radioChannelId && !newMember.mute && !recording) {
      newMember.voiceChannel.join()//ブロギルラジオチャンネルが録音していなくてミュート解除状態で入ったらボット録音開始
        .then(conn => {
          var receiver = conn.createReceiver();
          recording = newMember.id;
          recorder[0].count++;
          let toDay = new Date;
          let path = './rec/' + String(toDay.getFullYear()) + "0" + String(toDay.getMonth() + 1).slice(-2) + '/' + String(toDay.getDate());
          fs.mkdirs(path);
          var recfile = path + '/' + recording + '_' + recorder[0].count + '.pcm';
          newMember.guild.channels.get(mainChannelId).send(recfile + "録音はじめ、" + newMember.displayName + "ガンバ！");

          conn.on('speaking', (user, speaking) => {
            if (speaking) {
              var outputStream = fs.createWriteStream(recfile, { 'flags': 'a' });// pipe our audio data into the file stream
              const audioStream = receiver.createPCMStream(user);// create an output stream so we can dump our data in a file
              audioStream.pipe(outputStream);
              audioStream.on('end', () => {
                outputStream.end();
              });
            }
          });
        })
        .catch(console.log);
    } else if (oldMember.voiceChannelID === radioChannelId && oldMember.id === recording) {
      oldMember.voiceChannel.leave();
      oldMember.guild.channels.get(mainChannelId).send("録音おわり、" + newMember.displayName + "乙");
      recording = "";
    }
  }
})

client.login('NDY1NzQ1ODc4NDk0MjE2MjA0.DiR_Mw.Zcr7SkOwKq1MaJU1u4wrFRx2j4E');

client.on('ready', () => {
  console.log('ready!');
});