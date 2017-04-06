const express = require('express')
const app = express()

app.use('/static', express.static('public'))

app.get('/static/data/samuel-64.tsdf', function (req, res) {
    console.log("hi");
    res.setHeader("Content-Encoding", "gzip");
    res.sendFile('public/data/samuel-64.tsdf.gz', {root: "."});
});
app.get('/static/data/test.txt', function (req, res) {
    console.log(req.headers);
    res.setHeader("Content-Encoding", "gzip");
    res.sendFile('public/data/test.txt.gz', {root: "."});
});

app.listen(3000, function () {
    console.log('listening on port 3000')
});
