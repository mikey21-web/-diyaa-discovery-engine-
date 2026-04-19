require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: "commonjs",
    esModuleInterop: true,
    baseUrl: ".",
    paths: {
      "@/*": ["*"]
    }
  }
});
require('./test_simulation.ts');
