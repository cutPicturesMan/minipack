const fs = require('fs');
const path = require('path');
const babylon = require('babylon');
const traverse = require('babel-traverse').default;
const {transformFromAst} = require('babel-core');

let ID = 0;

// 读取文件内容，并提取依赖
function createAsset(filename) {
  const content = fs.readFileSync(filename, 'utf-8');
  // 将js代码用ast表示
  const ast = babylon.parse(content, {
    sourceType: 'module',
  });
  // 记录依赖文件的相对路径
  const dependencies = [];

  // 处理代码中的import依赖
  traverse(ast, {
    ImportDeclaration: ({node}) => {
      dependencies.push(node.source.value);
    },
  });

  // 为每个模块指定一个唯一的id
  const id = ID++;
  // es6语法转成es5
  const {code} = transformFromAst(ast, null, {
    presets: ['env'],
  });

  // 返回该模块的所有信息
  return {
    id,
    filename,
    dependencies,
    code,
  };
}

// 创建整体图表
function createGraph(entry) {
  const mainAsset = createAsset(entry);
  const queue = [mainAsset];

  for (const asset of queue) {
    asset.mapping = {};
    // 获取入口文件所处的目录名称
    const dirname = path.dirname(asset.filename);

    asset.dependencies.forEach(relativePath => {
      // 生成每个依赖文件的绝对路径
      const absolutePath = path.join(dirname, relativePath);
      // 为每个依赖文件创建资源图
      const child = createAsset(absolutePath);
      // 将每个依赖的路径与其资源图id的映射添加到入口文件资源图上
      asset.mapping[relativePath] = child.id;
      queue.push(child);
    });
  }

  return queue;
}

function bundle(graph) {
  let modules = '';

  graph.forEach(mod => {
    modules += `${mod.id}: [
      function (require, module, exports) {
        ${mod.code}
      },
      ${JSON.stringify(mod.mapping)},
    ],`;
  });

  const result = `
    (function(modules) {
      function require(id) {
        const [fn, mapping] = modules[id];

        function localRequire(name) {
          return require(mapping[name]);
        }

        const module = { exports : {} };

        fn(localRequire, module, module.exports);

        return module.exports;
      }

      require(0);
    })({${modules}})
  `;

  return result;
}

const graph = createGraph('./example/entry.js');
const result = bundle(graph);

fs.writeFileSync('./bundle.js', result);
