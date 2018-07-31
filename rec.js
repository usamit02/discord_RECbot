const Discord = require("discord.js");
const fs = require('fs-extra');
const mysql = require('mysql');

const mainChannelId = "472344675676585985";//メインラウンジ
const subChannelId = "";//放送内容共有メモ
const radioChannelId = "472264910223704074";//ブロギルラジオ
const maxRECmin = 30;//最大録音可能時間（分）
const dbString = {
  host: 'localhost',
  user: '',
  password: '',
  database: '',
  supportBigNumbers: true,
  bigNumberStrings: true
}
const client = new Discord.Client();
var caster = [];//登録済パーソナリティ
class _caster {
  constructor(id) {
    this.id = id;
    this.program = [];
  }
  addProgram() {
    this.program[this.program.length] = new _program;
  }
  addSummary(author, txt) {
    if (this.program.length) {
      return this.program[this.program.length - 1].addSummary(author, txt);
    }
    return false;
  }
  getRECtime() {
    if (this.program.length) {
      return this.program[this.program.length - 1].end - this.program[this.program.length - 1].start;
    }
    return false;
  }
}
class _program {//ラジオ番組}
  constructor() {
    this.start = new Date();
    this.end = new Date();
    this.summary = [];
    this.fault = false;
    this.sync = false;
  }
  addSummary(author, txt) {
    var l = this.summary.length;
    this.summary[l] = new _summary(l, author, txt);
    return l;
  }
}
class _summary {//まとめ
  constructor(id, author, txt) {
    this.id = id;
    this.upd = new Date();
    this.author = author;
    this.txt = txt;
  }
}
//初期設定
var recording = ""; var recPath = ""; var recFile = "";
var db = mysql.createConnection(dbString);
db.connect((err) => {
  if (err) throw err;
  db.query("SELECT id FROM t01caster WHERE stop = 0;", (err, row) => {
    if (err) throw err;
    for (var i = 0; i < row.length; i++) {
      caster[i] = new _caster(row[i].id);
    }
    db.end();
  });
});
function saveSQL(recorder) {//配信サーバー同期用SQLファイル作成
  var sql = ""; recording = ""; recFile = "";
  function escTxt(txt) {
    return txt
      .replace("'", '"')
      .replace("`", "");
  }
  function dateFormat(date) {//MySQL用日付文字列作成'yyyy-M-d H:m:s'
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var d = date.getDate();
    var h = date.getHours();
    var min = date.getMinutes();
    var sec = date.getSeconds();
    return "'" + y + "-" + m + "-" + d + " " + h + ":" + min + ":" + sec + "'";
  }
  for (var i = 0; i < recorder.program.length; i++) {
    if (!recorder.program[i].fault && !recorder.program[i].sync) {
      sql += "INSERT INTO t02program (cid,id,start,end) VALUES (";
      sql += recorder.id + "," + i + "," + dateFormat(recorder.program[i].start) + ","
        + dateFormat(recorder.program[i].end) + ");\r\n";
      var summary = recorder.program[i].summary
      summary.sort(function (a, b) {
        if (a.author < b.author) return -1;
        if (a.author > b.author) return 1;
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0
      });
      summary.push({ id: 0 });
      var txt = "";
      for (var j = 0; j < summary.length - 1; j++) {
        if (summary[j].author === summary[j + 1].author) {
          txt += escTxt(summary[j].txt) + "<br>";
        } else {
          txt += escTxt(summary[j].txt);
          txt = txt.length > 1500 ? txt.slice(0, 1500) : txt;
          sql += "INSERT INTO t12summary (cid,pid,id,txt) VALUES (";
          sql += recorder.id + "," + i + "," + summary[j].author + ",'" + txt + "');\r\n";
          txt = "";
        }
      }
    }
  }
  fs.appendFile(recPath + "/sync.sql", sql, err => {
    if (err) { throw err; }
    for (var i = 0; i < recorder.program.length; i++) {
      recorder.program[i].sync = true;
      delete recorder.program[i].summary;
    }
  });
}
client.on('message', msg => {
  if (msg.isMemberMentioned(client.user)) {
    if (recording) {//録音中にメンション飛ばすと番組中投稿保存モードになる
      let i = msg.content.indexOf(">");
      var txt = i > 1 ? msg.content.substr(i + 2) : "";
      var recorder = caster.filter(i => { if (i.id === recording) return true; });
      recorder[0].addSummary(msg.author.id, txt);
      msg.channel.send("これからの投稿はメモっとくよ、" + msg.author.username + "。");
    } else {//録音中しか反応しない
      msg.channel.send("ZZZ...");
    }
    return;
  } else {
    if (recording && (msg.channel.id === mainChannelId || msg.channel.id === subChannelId)) {
      var recorder = caster.filter(i => { if (i.id === recording) return true; });
      var author = recorder[0].program[recorder[0].program.length - 1].summary.filter(i => { if (i.author === msg.author.id) return true; });
      if (author.length) {//投稿者名義の書き込みが既存していれば番組中の投稿は全て記録される
        recorder[0].addSummary(msg.author.id, msg.content);
      }
    }
  }
});
client.on('voiceStateUpdate', (oldMember, newMember) => {//ボイスチャンネルに誰か出入りしたとき発火
  var recorder = caster.filter(i => { if (i.id === newMember.id) return true; });
  if (recorder.length) {//新しくボイスチャンネルに入った人がキャスター一覧にあったとき
    if (oldMember.voiceChannelID !== newMember.voiceChannelID && newMember.voiceChannelID === radioChannelId && !newMember.mute && !recording) {
      newMember.voiceChannel.join()//ブロギルラジオチャンネルが録音していなくてミュート解除状態で入ったらボット録音開始
        .then(conn => {
          var receiver = conn.createReceiver();
          recording = newMember.id;
          recorder[0].addProgram();
          let toDay = new Date;
          recPath = './rec/' + String(toDay.getFullYear()) + "0" + String(toDay.getMonth() + 1).slice(-2) + '/' + String(toDay.getDate());
          fs.mkdirs(recPath);
          recFile = recPath + '/' + recording + '_' + (recorder[0].program.length) + '.pcm';
          var msg = newMember.guild.channels.get(mainChannelId);
          msg.send("録音はじめ、" + newMember.displayName + "ガンバ！");

          conn.on('speaking', (user, speaking) => {
            if (speaking) {
              var outputStream = fs.createWriteStream(recFile, { 'flags': 'a' });// pipe our audio data into the file stream
              const audioStream = receiver.createOpusStream(user);// create an output stream so we can dump our data in a file
              audioStream.pipe(outputStream);
              audioStream.on('end', () => {
                outputStream.end();
                recorder[0].program[recorder[0].program.length - 1].end = new Date;//番組終了時刻を記録
                if (recorder[0].getRECtime() > maxRECmin * 60000) {//maxRECmin以上経過で強制終了
                  newMember.voiceChannel.leave();
                  msg.send("長いよ" + newMember.displayName + "、" + maxRECmin + "分が限界。");
                  saveSQL(recorder[0]);
                }
              });
            }
          });
        })
        .catch(console.log);
    } else if (oldMember.voiceChannelID === radioChannelId && oldMember.id === recording) {//キャスターがブロギルラジオチャンネルから抜けたとき
      oldMember.voiceChannel.leave();//RECbotも抜ける
      let rectime = recorder[0].getRECtime();
      let min = Math.floor(rectime / 60000); let sec = Math.floor((rectime - min * 60000) / 1000);
      var msg = oldMember.guild.channels.get(mainChannelId);
      if (1) {
        msg.send("録音おわり" + min + "分" + sec + "秒、" + newMember.displayName + "乙");
      } else {//録音時間が１分以下のときは記録しない
        msg.send("1分以上しゃべってくれないと困るなー、たった" + sec + "秒だよ" + newMember.displayName + "。");
        recorder[0].program[recorder[0].program.length - 1].fault = true;
        if (recFile) {
          fs.unlink(recFile, function (err) {
            if (err) { console.log(err); }
          });
        }
      }
      saveSQL(recorder[0]);
    }
  }
})

client.login('please enter your bot token');

client.on('ready', () => {
  console.log('RECbot on ready!');
});