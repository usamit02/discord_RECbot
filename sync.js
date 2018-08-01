
const ffmpeg = require("fluent-ffmpeg");
const request = require("request");
const fs = require("fs");
var toDay = new Date;
toDay.setDate(toDay.getDate());
const paths = String(toDay.getFullYear()) + "0" + String(toDay.getMonth() + 1).slice(-2) + '/' + String(toDay.getDate());
const pathl = './rec/' + paths + '/';
function now() {
  let n = new Date;
  return String(n.getMonth() + 1).slice(-2) + '/' + String(n.getDate()) + ' ' + String(n.getHours()) + ':' + String(n.getMinutes()) + ' ';
}
try {
  //-----------------------------------データーベース更新
  var sqls = fs.readFileSync(pathl + "sync.sql");
  var sql = String(sqls).split("\r\n");
  var fd = {};
  for (var i = 0; i < sql.length; i++) {
    if (sql[i].length > 10) { fd["p" + i] = sql[i]; }
  }
  request.post({
    url: "http://localhost/public_html/down_pay/sync.php",
    headers: {
      "content-type": "application/json"
    },
    form: fd
  }, (err, response, body) => {
    if (!err && response.statusCode == 200) {
      let msg = JSON.parse(body).msg;
      console.log(msg);
      fs.appendFileSync("./rec/log.txt", now() + msg + "\r\n");
    } else {
      console.log(err);
      fs.appendFileSync("./rec/log.txt", now() + err + "\r\n");
    }
  });
  //-------------------------------------mp3ファイル転送
  var files = fs.readdirSync(pathl);
  for (var f of files) {
    (function (f) {
      var file = f.split('.');
      if (file[1] == "pcm") {
        ffmpeg()
          .input(pathl + f)
          .inputOptions(['-ac 2', '-ar 48000'])
          .inputFormat('s16le')
          .output(pathl + file[0] + '.mp3')
          .outputOptions(['-ab 48k'])
          .on('end', function () {
            var fd = {
              'mp3': fs.createReadStream(pathl + file[0] + '.mp3'),
              'path': paths
            }//http://sharecarsblog.s1004.xrea.com/enter.php
            request.post({ url: "http://localhost/public_html/down_pay/enter.php", formData: fd }, function (err, response, body) {
              if (!err && response.statusCode == 200) {
                let msg = JSON.parse(body).msg;
                console.log(msg);
                fs.appendFileSync("./rec/log.txt", now() + msg + "\r\n");

              } else {
                console.log(err);
                fs.appendFileSync("./rec/log.txt", now() + err + "\r\n");
              }
            })
          })
          .on('error', function (err) {
            console.log('ffmpeg error: ' + err.message);
            fs.appendFileSync("./rec/log.txt", now() + err.message + "\r\n");
          })
          .run()
      }
    })(f);
  }
} catch (e) {
  console.log(e);
  fs.appendFileSync("./rec/log.txt", now() + e + "\r\n");
}
