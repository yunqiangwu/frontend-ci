const Koa = require('koa');
const path = require('path');
const serve = require('koa-static');
const proxy = require('koa-proxy');
const route = require('koa-route');
const bodyParser = require('koa-bodyparser');
const websockify = require('koa-websocket');

let wechatTo = process.env.WECHAT_TO || 'Wayne';

export default function(args) {

    const {
        wechatCtl,
        host,
        branch,
    } = args;

    const PORT = args.port;
    const { cmder } = args;
    const app = websockify(new Koa());
    // const app = new Koa();

    app.use(bodyParser());

    if( process.env.WEBHOOK_DEV ){
        app.use(proxy({
            host:  'http://127.0.0.1:9898', // proxy alicdn.com...
            // match: /^\/static\//        // ...just the /static folder
        }));
    } else {
        // app.use(serve(path.join(__dirname, '../../boilerplate/dist')));
        app.use(serve(path.join(__dirname, '../public')));
        // app.use(proxy({
        //     host:  'http://127.0.0.1:9898', // proxy alicdn.com...
        //     // match: /^\/static\//        // ...just the /static folder
        // }));
    }

    app.use(async(ctx, next) => {

        let request = ctx.request;
        // body = ctx.request.body;

        if (ctx.request.url === "/restart") {
            if (cmder.stop.isStoping()) {
                ctx.body = '{"msg": "服务器正在重启"}';
            } else {
                ctx.body = '{"msg": "服务器重启"}';
                await cmder.stop();
                await cmder.start();
                // p.on('error',(message)=>{
                //     wechatCtl.sendMsg(message, wechatTo);
                // });
                // p.on('exit',(message)=>{
                //     wechatCtl.sendMsg(message, wechatTo);
                // });
            }

            if (wechatCtl) {
                let msg = ctx.body;
                wechatCtl.sendMsg(msg, wechatTo);
            }

            return;
        }

        if (ctx.request.url.startsWith("/exec")) {
            console.log(ctx.request.query);
            let msg = Object.assign({}, ctx.request.body, ctx.request.query);
            if (msg.shell) {
                let id = new Date().getTime();
                let shellP = cmder.exec(msg.shell, id);
                ctx.body = `{"id": "${id}"}`;
            } else {
                ctx.body = '{"msg": "参数错误，缺少shell参数"}';
            }
            return;
        }

        if (ctx.request.url.startsWith("/hook")) {
            let headers = JSON.parse(JSON.stringify(ctx.request.header).toLowerCase());
            let gitEvent = headers['x-github-event'] || headers['x-gitlab-event'];
            gitEvent = gitEvent && gitEvent.replace('hook', '').trim();
            console.log(ctx.request.body);
            if (gitEvent === 'push') {
                if (wechatCtl) {
                    let pushData = ctx.request.body.payload ? JSON.parse(ctx.request.body.payload) : ctx.request.body;
                    let commitObj = pushData.head_commit || pushData.commits[pushData.commits.length - 1];
                    let pusher = pushData.user_name || commitObj.author.name;
                    let commitMsg = commitObj.message;
                    let diffMsg = '';
                    if (commitObj.added && commitObj.added.length) {
                        diffMsg += "添加文件：" + commitObj.added.join(' , ') + '\n';
                    }
                    if (commitObj.modified && commitObj.modified.length) {
                        diffMsg += "修改文件：" + commitObj.modified.join(' , ') + '\n';
                    }
                    if (commitObj.commitMsg && commitObj.commitMsg.length) {
                        diffMsg += "删除文件：" + commitObj.commitMsg.join(' , ') + '\n';
                    }

                    let msg = `${pusher} 提交修改到 ${branch} 分支，文件变动如下

${diffMsg}
提交的注释：${commitMsg}

服务器已经自动pull了代码。
预览地址: http://${host==='0.0.0.0'?('{服务器ip}'):(host)}
如果此次修改不支持热更新，可以打开 http://${host==='0.0.0.0'?('{服务器ip}'):('ctrl.'+host)} 重启服务
            `;
                    wechatCtl.sendMsg(msg, wechatTo);
                }
                cmder.pull();
            }
            ctx.body = '{"msg": "client收到hook请求"}';
            return;
        }

        if (wechatCtl && ctx.request.url == "/notice") {
            let msg = ctx.request.body;
            msg = JSON.stringify(msg);
            wechatCtl.sendMsg(msg);
            ctx.body = '{"msg": "消息转发微信"}';
            return;
        }

        await next();

    });

    const redirect = ctx => {
        ctx.response.redirect('/index.html');
        ctx.response.body = '<a href="/index.html">Index Page</a>';
    };

    app.use(route.get('/', redirect));

    global.app = app;

    app.listen(PORT);

    function broadcast(data) {
        app.ws.server.clients.forEach(function each(client) {
            if (client.readyState === 1) {
              client.send(JSON.stringify(data));
            }
        });
    };

    return {
        boardcast: (type, id, data) => {
            if (type.startsWith('start')) {
              broadcast({
                type,
                data,
              });
                // console.log(type, data);
            }
            if (type.startsWith('exec')) {
                // console.log(type + '#' + id, data);
              broadcast({
                type,
                id,
                data,
              });
            }
        },
    };
}

// "devDependencies": {
//   "babel-plugin-syntax-async-functions": "^6.13.0",
//   "babel-plugin-transform-async-to-generator": "^6.24.1",
//   "babel-preset-es2015": "^6.24.1",
//   "babel-preset-stage-2": "^6.24.1",
//   "babel-register": "^6.26.0"
// }

//  {
//    "presets": [
//      "es2015",
//      "stage-3"
//    ],
//    "plugins": ["syntax-async-generators","transform-async-to-generator","syntax-async-functions","transform-koa2-async-to-generator"]
// }
