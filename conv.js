
const ffmpeg = require("fluent-ffmpeg");
const request = require("request");
const fs = require("fs");

ffmpeg()
  .input('./rec/clife.pcm')
  .inputOptions(['-ac 2', '-ar 48000'])
  .inputFormat('s16le')
  .output('./rec/demo1.mp3')
  .outputOptions(['-ab 64k'])
  .on('end', function () {
    console.log('file has been converted succesfully');
    var formData = {
      "mp3": fs.createReadStream("./rec/demo1.mp3"),
      "person": "suzuki"
    }
    var options = {
      url: "http://localhost/enter.php", formData: formData
    }
    request.post(options, function (err, response, body) {
      if (!err && response.statusCode == 200) {
        console.log(JSON.parse(body).msg);
      } else {
        console.log(err);
      }
    })
  })

  .on('error', function (err) {
    console.log('an error happened: ' + err.message);
  })
  .run()