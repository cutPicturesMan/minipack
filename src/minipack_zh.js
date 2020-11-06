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

// 从入口文件开始提取依赖，再从依赖文件中提取该文件的依赖，直到找出应用中每个模块的依赖关系，即创建整体依赖图表
function createGraph(entry) {
  // 解析入口文件
  const mainAsset = createAsset(entry);

  // 数组用来存放每个文件的资源图，第一个是入口文件的资源图
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
      // 为每个依赖文件的路径与其资源图id创建映射关系，方便在js源码中出现require该路径的时候，快速找到对应的资源图
      asset.mapping[relativePath] = child.id;
      // 将依赖文件的资源图也放入到队列中，这样该文件的依赖也会被循环解析
      queue.push(child);
    });
  }

  return queue;
}

// 创建一个能够在浏览器执行的自执行函数，将所有模块捆绑在一起
function bundle(graph) {
  let modules = '';

  // 循环整体依赖图，为每个依赖创建key:value形式，key为资源图id，value为[fn, mapping]
  // fn表示包裹js源码的函数（每个模块都应该有个单独的作用域，防止变量互相影响）。由于模块使用CommonJS模块系统，需要三个参数：require、module、exports。这3个参数在浏览器端正常情况下都是不可用的，因此要自己实现并注入到包裹函数fn中
  // mapping记录了该模块依赖文件的相对路径与依赖文件资源图id的对应关系
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
        // 找到模块id对应的资源图
        const [fn, mapping] = modules[id];

        function localRequire(name) {
          return require(mapping[name]);
        }

        const module = { exports : {} };

        // 执行模块内的代码，加载依赖文件
        fn(localRequire, module, module.exports);

        return module.exports;
      }

      // 手动加载入口文件，剩余的依赖会自动循环加载
      require(0);
    })({${modules}})
  `;

  return result;
}

const graph = createGraph('./example/entry.js');
const result = bundle(graph);

fs.writeFileSync('./bundle.js', result);
