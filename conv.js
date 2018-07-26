
const ffmpeg = require("fluent-ffmpeg");
const request = require("request");
const fs = require("fs");

ffmpeg()
  .input('./rec/clife.pcm')
  .inputOptions(['-ac 2', '-ar 48000'])
  .inputFormat('s16le')
  .output('./rec/demo.mp3')
  .on('end', function () {
    console.log('file has been converted succesfully');
    var formdata = {
      "mp3": fs.createReadStream('./rec/demo.jpg'),
      "person": "suzuki",
      "timeout": "180000"
    }
    var options = {
      url: "http://localhost/enter.php", formData: formdata
    }
    request.post(options, function (err, response, body) {
      if (!err && response.statusCode == 200) {
        console.log(JSON.parse(body).msg);
      } else {
        console.log(err);
      }
    })

    //    const options = {
    //      url: "",
    //      method: "POST",
    //headers: { "Content-Type":"multipart/form-data"}, //Content-Disposition: form-data
    //      contentType: false,
    //      processData: false,
    //      formData: formdata,

    //    }






  })

  .on('error', function (err) {
    console.log('an error happened: ' + err.message);
  })
  .run()