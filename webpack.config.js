var path = require('path');

module.exports = {
  entry: './lib/js/raytracer.js',
  output: {
    filename: 'bundle.js',
    publicPath: '/dist/',
    path: path.resolve(__dirname, 'public/dist/')
  }
};
