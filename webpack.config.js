var path = require('path');

module.exports = {
  entry: './example/samuel.js',
  output: {
    filename: 'bundle.js',
    publicPath: '/dist/',
    path: path.resolve(__dirname, 'public/dist/')
  }
};
