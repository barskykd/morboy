module.exports = {
  entry: './morboy.ts',
  output: {
      path: './',  
      filename: 'bundle.js'
  },
  resolve: {
      // Add `.ts` and `.tsx` as a resolvable extension.
      extensions: ['', '.webpack.js', '.web.js', '.ts', '.tsx', '.js']
  },
  module: {
      loaders: [
          // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
          { test: /\.[tj]sx?$/, loader: 'ts-loader' }
      ]
  },
  devtool: 'source-map'
}