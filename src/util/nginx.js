var http = require('http'),
    nodeStatic = require('node-static'),
    httpProxy = require('http-proxy');

const proPort = parseInt(process.env.PRODUCT_PORT, 10) || 8009;
const devPort = parseInt(process.env.PORT, 10) || 8007;
const ctrlPort = parseInt(process.env.CTRL_PORT, 10) || 8008;
// 
// Setup our server to proxy standard HTTP requests 
// 
var devProxy = new httpProxy.createProxyServer({
    target: {
        host: '127.0.0.1',
        port: devPort
    }
});
var ctrlProxy = new httpProxy.createProxyServer({
    target: {
        host: '127.0.0.1',
        port: ctrlPort
    }
});
// console.log(32);
devProxy.on('error', function (err, req, res) {
    res.writeHead(500, {
        'Content-Type': 'text/plain'
    });

    res.end('Something went wrong. And we are reporting a custom error message.');
});

ctrlProxy.on('error', function (err, req, res) {
    res.writeHead(500, {
        'Content-Type': 'text/plain'
    });

    res.end('Something went wrong. And we are reporting a custom error message.');
});

var file = new nodeStatic.Server('./dist');
var proxyServer = http.createServer(function (req, res) {
    let host = req.host || req.headers.host;
    
    // console.log(req);
    if(host.startsWith('ctrl.')){
        ctrlProxy.web(req, res);
    }else if(host.startsWith('dev.')){
        devProxy.web(req, res);
    }else if(host.startsWith('product.')){
        req.addListener('end', function () {
            //
            // Serve files!
            //
            file.serve(req, res);
        }).resume();
    }else{
        devProxy.web(req, res);
    }
});

// 
// Listen to the `upgrade` event and proxy the 
// WebSocket requests as well. 
// 
proxyServer.on('upgrade', function (req, socket, head) {
    let host = req.host || req.headers.host;
    // console.log(req);
    if(host.startsWith('ctrl.')){
        ctrlProxy.ws(req, socket, head);
    }else if(host.startsWith('dev.')){
        devProxy.ws(req, socket, head);
    }else{
        devProxy.ws(req, socket, head);
    }
});

proxyServer.listen(proPort);
console.log(`nginx 已经运行在 ${proPort} 号端口`);