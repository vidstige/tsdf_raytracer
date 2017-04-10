var path = require('path');

module.exports = {
  entry: './lib/js/raytracer.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'public/dist/')
  }
};
