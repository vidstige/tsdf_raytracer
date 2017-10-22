var path = require('path');

module.exports = {
  entry: './src/raytracer.js',
  output: {
    filename: 'bundle.js',
    publicPath: '/dist/',
    path: path.resolve(__dirname, 'public/dist/')
  }
};
