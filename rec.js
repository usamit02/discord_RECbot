const Discord = require("discord.js");
const fs = require('fs-extra');
const mysql = require('mysql');

const mainChannelId = "464230714167263237";//ブロギル メインラウンジ
const botChannelId = "464247144942010378";//ブロギルbot
//const mainChannelId = "472344675676585985";//myメインラウンジ
const subChannelId = "";//放送内容共有メモ
//const botChannelId = "477074086921502720";//my33
const radioChannelId = "464711497768108032";//ブロギルラジオ
//const radioChannelId = "466760177517985815";//ブロギルテスト用
//const radioChannelId = "472264910223704074";//myラジオ
const craigId = "272937604339466240";
const maxRECmin = 100;//最大録音可能時間（分）
const dbString = {
  host: 'localhost',
  user: 'root',
  password: 'kx125l1',
  database: 'recbot',
  supportBigNumbers: true,
  bigNumberStrings: true
}
const client = new Discord.Client();
var caster = [];//登録済パーソナリティ
class _caster {
  constructor(id, imgurl, twitter) {
    this.id = id;
    this.imgurl = imgurl;
    this.twitter = twitter;
    this.program = [];
  }
  addProgram() {//番組スタート時刻hhmmを返す
    var l = this.program.length;
    this.program[l] = new _program(this.id);
    return ("0" + this.program[l].start.getHours()).slice(-2) + ("0" + this.program[l].start.getMinutes()).slice(-2);
  }
  addSummary(id, author, imgurl, txt) {
    if (this.program.length) {
      return this.program[this.program.length - 1].addSummary(id, author, imgurl, txt);
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
  constructor(cid) {
    this.start = new Date();
    this.end = new Date();
    this.summary = [];
    db.query("SELECT title FROM t02program WHERE cid=" + cid + " AND stop = 0;", (err, r) => {
      if (err) throw err;
      this.title = r.length ? r[0].title : "とくになし";
    });
    this.na = "";
  }
  addSummary(id, author, imgurl, txt) {
    var start = this.start;
    var l = this.summary.length;
    this.summary[l] = new _summary(start, id, author, imgurl, l, txt);
    return l;
  }
}
class _summary {//まとめ
  constructor(start, id, author, imgurl, num, txt) {
    this.start = start;
    this.id = id;
    this.author = author;
    this.imgurl = imgurl;
    this.num = num;
    this.txt = txt;
  }
}
//初期設定
var recording = ""; var recPath = ""; var recFile = "";
var db = mysql.createConnection(dbString);
db.query("SELECT id,imgurl,twitter FROM t01caster WHERE stop = 0;", (err, row) => {
  if (err) throw err;
  for (var i = 0; i < row.length; i++) {
    caster[i] = new _caster(row[i].id, row[i].imgurl, row[i].twitter);
  }
});
function dateFormat(date = new Date()) {//MySQL用日付文字列作成'yyyy-M-d H:m:s'
  var y = date.getFullYear();
  var m = date.getMonth() + 1;
  var d = date.getDate();
  var h = date.getHours();
  var min = date.getMinutes();
  var sec = date.getSeconds();
  return "'" + y + "-" + m + "-" + d + " " + h + ":" + min + ":" + sec + "'";
}
function saveSQL(recorder, member) {//配信サーバー同期用SQLファイル作成
  var sql = ""; recording = ""; recFile = "";
  function escTxt(txt) {
    return txt
      .replace("'", '"')
      .replace("`", "");
  }
  for (var i = 0; i < recorder.program.length; i++) {
    sql += "INSERT INTO t05record (cid,start,end,title,na,sync) VALUES (";
    sql += recorder.id + "," + dateFormat(recorder.program[i].start) + "," + dateFormat(recorder.program[i].end) + ",'" + recorder.program[i].title + "','" + recorder.program[i].na + "',syncdate);\r\n";
    var summary = recorder.program[i].summary
    summary.sort(function (a, b) {
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      if (a.num < b.num) return -1;
      if (a.num > b.num) return 1;
      return 0
    });
    summary.push({ id: 0 });//ダミーデータ
    var txt = "";
    for (var j = 0; j < summary.length - 1; j++) {
      if (summary[j].id === summary[j + 1].id) {
        txt += escTxt(summary[j].txt) + "<br>";
      } else {
        let val = summary[j].id + ",'" + summary[j].author + "','" + summary[j].imgurl + "',syncdate";
        let up = "na='" + summary[j].author + "',imgurl='" + summary[j].imgurl + "',sync=syncdate";
        sql += "INSERT INTO t11summaer (id,na,imgurl,sync) VALUES (" + val + ") ON DUPLICATE KEY UPDATE " + up + ";\r\n";
        txt += escTxt(summary[j].txt);
        txt = txt.length > 2500 ? txt.slice(0, 2500) : txt;
        sql += "INSERT INTO t12summary (cid,start,id,txt,sync) VALUES (";
        sql += recorder.id + "," + dateFormat(summary[j].start) + "," + summary[j].id + ",'" + txt + "',syncdate);\r\n";
        txt = "";
      }
    }
  }
  if (member.user.avatarURL != recorder.imgurl) {
    let s = "UPDATE t01caster SET imgurl='" + member.user.avatarURL + "' WHERE id=" + recorder.id + ";";
    sql += s + "\r\n";
    recorder.imgurl = member.user.avatarURL;
    db.query(s, err => {
      if (err) { throw err; };
    });
  }
  fs.appendFile(recPath + "/sync.sql", sql, err => {
    if (err) { throw err; }
    recorder.program.splice(0, recorder.program.length);
  });
}
client.on('message', msg => {
  if (msg.isMemberMentioned(client.user)) {
    if (recording) {
      let i = msg.content.indexOf(">");
      var txt = i > 1 ? msg.content.substr(i + 2) : "";
      var recorder = caster.filter(i => { if (i.id === recording) return true; });
      if (msg.author.id === recording) {//録音中に本人がメンション飛ばすと題を保存
        recorder[0].program[recorder[0].program.length - 1].na = txt;
        msg.channel.send("今日のお題は「" + txt + "」");
      } else if (msg.author.id === craigId) {
        fs.appendFile(recPath + "/file.txt", recFile.replace("pcm", "mp3") + ":" + txt.slice(txt.indexOf("link:"), -1) + "\r\n");
      } else {//録音中に他人がメンション飛ばすと番組中投稿保存モードになる
        recorder[0].addSummary(msg.author.id, msg.author.username, msg.author.avatarURL, txt);
        msg.channel.send("これからの投稿はメモっとくよ、" + msg.author.username + "。");
      }
    } else {//録音中しか反応しない
      if (msg.author.id !== craigId) {
        if (msg.content.indexOf("leave") === -1) {
          msg.channel.send("ZZZ...");
        } else {
          msg.channel.send(":craig:,leave");
        }
      }
    }
    return;
  } else {
    if (recording && (msg.channel.id === mainChannelId || msg.channel.id === subChannelId)) {
      var recorder = caster.filter(i => { if (i.id === recording) return true; });
      if (msg.content.length > 500) {
        recorder[0].addSummary(msg.author.id, msg.author.username, msg.author.avatarURL, msg.content);
      } else {
        var author = recorder[0].program[recorder[0].program.length - 1].summary.filter(i => { if (i.id === msg.author.id) return true; });
        if (author.length) {//投稿者名義の書き込みが既存していれば番組中の投稿は全て記録される
          recorder[0].addSummary(msg.author.id, msg.author.username, msg.author.avatarURL, msg.content);
        }
      }
    }
  }
});
client.on('voiceStateUpdate', (oldMember, newMember) => {//ボイスチャンネルに誰か出入りしたとき発火
  var recorder = caster.filter(i => { if (i.id === newMember.id) return true; });
  if (recorder.length) {//新しくボイスチャンネルに入った人がキャスター一覧にあったとき
    // if (oldMember.voiceChannelID !== newMember.voiceChannelID && newMember.voiceChannelID === radioChannelId && !recording) {
    if (oldMember.voiceChannelID !== newMember.voiceChannelID && newMember.voiceChannelID === radioChannelId && !newMember.mute && !recording) {
      newMember.voiceChannel.join()//ブロギルラジオチャンネルが録音していなくてミュート解除状態で入ったらボット録音開始
        .then(conn => {
          var receiver = conn.createReceiver();
          recording = newMember.id;
          let toDay = new Date;
          recPath = './rec/' + String(toDay.getFullYear()) + ("0" + (toDay.getMonth() + 1)).slice(-2) + '/' + String(toDay.getDate());
          fs.mkdirsSync(recPath);
          recFile = recPath + '/' + recording + '_' + recorder[0].addProgram() + '.pcm'; console.log(dateFormat() + recFile);
          var msg = newMember.guild.channels.get(mainChannelId);
          msg.send("録音はじめ、" + newMember.displayName + "ガンバ！");
          msg.send(recorder[0].twitter);
          newMember.guild.channels.get(botChannelId).send(":craig:,join");
          conn.on('speaking', (user, speaking) => {
            if (speaking) {
              let audioStream = receiver.createPCMStream(user);// create an output stream so we can dump our data in a file
              let outputStream = fs.createWriteStream(recFile);// pipe our audio data into the file stream
              audioStream.pipe(outputStream);
              audioStream.on('end', () => {
                outputStream.end();
                recorder[0].program[recorder[0].program.length - 1].end = new Date;//番組終了時刻を記録
                if (recorder[0].getRECtime() > maxRECmin * 60000) {//maxRECmin以上経過で強制終了
                  newMember.voiceChannel.leave();
                  newMember.guild.channels.get(botChannelId).send(":craig:,leave");
                  msg.send("長いよ" + newMember.displayName + "、" + maxRECmin + "分が限界。");
                  saveSQL(recorder[0], newMember);
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
      oldMember.guild.channels.get(botChannelId).send(":craig:,leave");
      if (min) {
        msg.send("録音おわり" + min + "分" + sec + "秒、" + newMember.displayName + "乙");
        msg.send(recorder[0].twitter);
      } else {//録音時間が１分以下のときは記録しない
        msg.send("1分以上聴かせてほしいな、たった" + sec + "秒だよ" + newMember.displayName + "。");
        recorder[0].program.pop();
        if (recFile) {
          fs.unlink(recFile, function (err) {
            if (err) { console.log(dateFormat() + err); }
          });
        }
      }
      saveSQL(recorder[0], oldMember);
    }
  }
})
client.login('NDY1NzQ1ODc4NDk0MjE2MjA0.DkFSbw.awZEGJp5JbfwYt5N3_RUYTO_j9o');
client.on('ready', () => {
  console.log(dateFormat() + 'RECbot on ready!');
});