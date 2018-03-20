// const os = require('os');
import optimist from 'optimist';
import shelljs from 'shelljs';
import fs from 'fs';
import { fork } from 'child_process';
import websocketProxyServer from './util/websocketProxyServer';
import webhookServer from './util/webhookServer';
import wechatServer from './util/wechatServer';
import isWindows from 'is-windows';
var kill = require('tree-kill')
var path = require('path');

// var killPort = require('killport2');

const isWin = isWindows();

const argv = optimist
    .argv;
// console.log(argv);
// process.exit(0);

// var ifaces = os.networkInterfaces();

function showHelp() {
    console.log([
        'usage: webhook-c [options] --start-cmd "cmd"',
        '',
        'options:',
        '  --start-cmd "exec"     应用启动运行命令，例如 "mvn spring-boot:run"、"npm start" 等  ,前后必须加上双引号，该参数必须填写',
        // '  --stop-cmd "exec"      停止应用命令， 例如 "tomcat stop"、"ps -ef | grep java | kill -9"',
        // '  --cwd path             工作目录，默认当前目录',
        '  --pa  wsAddress        跳板服务器的地址（ws(s)://域名:端口） websocket 地址',
        '  --a host               webhook 侦听的域名 默认 0.0.0.0',
        '  --p port               webhook 侦听的端口 默认 8008',
        '  --wechat-server url    微信服务器地址 ',
        '  -h --help              Print this list and exit.',

    ].join('\n'));
    process.exit();
}

if (argv.h || argv.help) {
    showHelp();
}

const port = argv.p || parseInt(process.env.CTRL_PORT, 10) || 8008,
    cwdPath = argv.cwd || process.cwd(),
    host = argv.a || '0.0.0.0',
    serverStartCmd = argv['start-cmd'],
    serverStopCmd = argv['stop-cmd'],
    wechatServerUrl = argv['wechat-server'],
    proxyAddress = argv.pa; // || 'git-webhook-proxy-server-front-server.193b.starter-ca-central-1.openshiftapps.com'

if (!serverStartCmd) {
    showHelp();
}

if (!shelljs.which('git')) {
    shelljs.echo('Sorry, this script requires git');
    shelljs.exit(1);
}

if (!fs.existsSync('.git')) {
    shelljs.echo('Sorry, current path is not git repo');
    shelljs.exit(1);
}

// shelljs.config.silent = true; // todo 

let branch = shelljs.exec('git symbolic-ref --short -q HEAD').trim();
let projectNameGitUrl = shelljs.exec('git config --get remote.origin.url').trim();
let repository = /.*\/([^\/]*).git$/.exec(projectNameGitUrl)[1];


// console.log(repository);
// process.exit();


let stopingPromise = null;
let p;
let webhookServerCtl;
let wechatCtl;
let nginxP;

async function start() {
    if (stopingPromise) {
        await stopingPromise;
    }
    p = fork(`${__dirname}/util/startAppServer`, [serverStartCmd], {silent: true});
	global.p = p;
    console.log("应用启动成功");
    p.stdout.on('data', (chunk) => {
	  webhookServerCtl.boardcast('start', null, chunk.toString());
	});
	p.stderr.on('data', (chunk) => {
	  webhookServerCtl.boardcast('start:err', null, chunk.toString());
	});
	p.on('close', (code) => {
	  webhookServerCtl.boardcast('start:exit', null, code);
	});
    // return p;
}

// mkdir -p dist_history && tar cvf dist_history/dist_`date +%Y%m%d%H%M%S`.tar dist

async function startNginx() {
    if(nginxP){
        await (new Promise((resolve, reject) => {
            kill(nginxP.pid, 'SIGKILL', function(err) {
                nginxP = null;                        
                if(err){
                    reject(err);
                }else{
                    console.log("停止服务完成");
                    resolve();
                }
            });
        }));
        nginxP = null;
    }
    nginxP = fork(`${__dirname}/util/nginx`,[''] , {silent: false});
	global.nginxP = nginxP;
    console.log("代理应用启动成功");
    // p.stdout.on('data', (chunk) => {
	//   webhookServerCtl.boardcast('start', null, chunk.toString());
	// });
	// p.stderr.on('data', (chunk) => {
	//   webhookServerCtl.boardcast('start:err', null, chunk.toString());
	// });
	// p.on('close', (code) => {
	//   webhookServerCtl.boardcast('start:exit', null, code);
	// });
    // return p;
}
let execRunedMap = {}
async function exec(shell, id) {
    if (execRunedMap[shell]) {
        await execRunedMap[shell];
    }
    execRunedMap[shell] = new Promise((resolve, reject) => {
        console.log("执行命令：" + shell);    
        let p2 = fork(`${__dirname}/util/startAppServer`, [shell], {silent: true});
        p2.stdout.on('data', (chunk) => {
            webhookServerCtl.boardcast('exec', id, chunk.toString());
        });
        p2.on('close', (code) => {
            if(execRunedMap[shell]){
                delete execRunedMap[shell];
                resolve(code);
            }
            webhookServerCtl.boardcast('exec:exit', id, code);
        });
        p2.stderr.on('data', (chunk) => {
            if(execRunedMap[shell]){
                delete execRunedMap[shell];
                reject(chunk);
            }
            webhookServerCtl.boardcast('exec:err', id, chunk.toString());
        });
    });
    return (await execRunedMap[shell]);
    // p.
    // webhookServerCtl.boardcast("执行命令：" + shell);
}

async function stop() {
    if (stopingPromise) {
        return stopingPromise;
    }
    let curP = global.p;
    serverStopCmd && shelljs.exec(serverStopCmd);
    if (curP.killed) {
        return Promise.resolve({});
    } else {
        if (!stopingPromise) {
            stopingPromise = new Promise((resolve, reject) => {
                kill(curP.pid, 'SIGKILL', function(err) {
                    stopingPromise = null;                        
                    if(err){
                        reject(err);
                    }else{
                        console.log("停止服务完成");
                        resolve();
                    }
                });
            });
        }
        return stopingPromise;
    }
}

stop.isStoping = () => {
    console.log(!!stopingPromise);
    if (stopingPromise) {
        return true;
    } else {
        return false;
    }
}


async function pull() {
    shelljs.exec(`git clean -f`);
    // shelljs.exec(`git fetch --all`);
    shelljs.exec(`git reset --hard origin/${branch}`);
    // shelljs.exec(`git checkout ${branch}`);
    shelljs.exec(`git pull origin ${branch} --force`);
}

// async function build() {
//     shelljs.exec('mkdir -p dist_history && tar cvf dist_history/dist_`date +%Y%m%d%H%M%S`.tar dist && npm run build');
// }


if (wechatServerUrl) {
    wechatCtl = wechatServer({
        wechatServerUrl,
    });
}

webhookServerCtl = webhookServer({
    host,
    port,
    proxyAddress,
    cmder: {
        start,
        stop,
        pull,
        exec,
    },
    wechatCtl,
    branch,
});

if (proxyAddress) {
    websocketProxyServer({
        hookPort: port,
        proxyAddress,
        hookHost: host === '0.0.0.0' ? 'localhost' : host,
        branch,
        repository,
    });
}


Promise.all([start(), startNginx()]).then(()=>{
    console.log(`webhook启动完成，控制台请访问： http://${host==='0.0.0.0' ? 'localhost' : host}:${port}/`);
});

const clean = function () {
    stop();
    if (!nginxP.killed) {
        kill(nginxP.pid, 'SIGKILL');
    }
    shelljs.exec(`${path.join(__dirname, '../node_modules/.bin/killport')} ${port}`);
  }

  process.on('exit', function () {
    try {
      clean();
    } catch (e) {
    }
  });

  process.on('SIGINT', function () {
    try {
      clean();
    } catch (e) {
    }
    // process.exit(0);
  });
