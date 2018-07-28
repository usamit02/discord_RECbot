
const ffmpeg = require("fluent-ffmpeg");
const request = require("request");
const fs = require("fs");

var toDay = new Date;
//toDay.setDate(toDay.getDate() - 1);
const paths = String(toDay.getFullYear()) + "0" + String(toDay.getMonth() + 1).slice(-2) + '/' + String(toDay.getDate());
const pathl = './rec/' + paths + '/';
try {
  var files = fs.readdirSync(pathl);
  for (var i in files) {
    var file = files[i].split('.');
    if (file[1] == "pcm") {
      ffmpeg()
        .input(pathl + files[i])
        .inputOptions(['-ac 2', '-ar 48000'])
        .inputFormat('s16le')
        .output(pathl + file[0] + '.mp3')
        .outputOptions(['-ab 48k'])
        .on('end', function () {
          console.log('file has been converted succesfully');
          var fd = {
            'mp3': fs.createReadStream(pathl + file[0] + '.mp3'),
            'path': paths
          }//http://accessblog.s1001.xrea.com/enter.php
          request.post({ url: "http://localhost/enter.php", formData: fd }, function (err, response, body) {
            if (!err && response.statusCode == 200) {
              console.log(JSON.parse(body).msg);
            } else {
              console.log(err);
            }
          })
        })

        .on('error', function (err) {
          console.log('ffmpeg error: ' + err.message);
        })
        .run()
    }
  }
} catch (e) {
  console.log(e);
}
