const Discord = require("discord.js");
const fs = require('fs');
const client = new Discord.Client();

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
            var outputStream = fs.createWriteStream(`./recordings/record-${Date.now()}.opus`);// pipe our audio data into the file stream
            msg.channel.sendMessage(`RECroding to ${user}`);// this creates a 16-bit signed PCM, stereo 48KHz PCM stream.
            const audioStream = receiver.createOpusStream(user);// create an output stream so we can dump our data in a file
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
});

client.login('NDY1NzQ1ODc4NDk0MjE2MjA0.DiR_Mw.Zcr7SkOwKq1MaJU1u4wrFRx2j4E');

client.on('ready', () => {
  console.log('ready!');
});