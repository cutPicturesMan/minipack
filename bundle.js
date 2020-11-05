(function(modules) {
  function require(id) {
    const [fn, mapping] = modules[id];

    function localRequire(name) {
      return require(mapping[name]);
    }

    const module = {exports: {}};

    fn(localRequire, module, module.exports);

    return module.exports;
  }

  require(0);
})({
  0: [
    function(require, module, exports) {
      const _message = require('./message.js');

      const _message2 = _interopRequireDefault(_message);

      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {default: obj};
      }

      console.log(_message2.default);
    },
    {'./message.js': 1},
  ],
  1: [
    function(require, module, exports) {
      Object.defineProperty(exports, '__esModule', {
        value: true,
      });

      const _name = require('./name.js');

      exports.default = `hello ${_name.name}!`;
    },
    {'./name.js': 2},
  ],
  2: [
    function(require, module, exports) {
      Object.defineProperty(exports, '__esModule', {
        value: true,
      });
      const name = (exports.name = 'world');
    },
    {},
  ],
});
